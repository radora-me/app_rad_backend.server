const path = require("path");
const prisma = require("../../core/database/prisma");
const { uploadBuffer, deleteFile } = require("../../core/storage/cloudinary");

const MAX_MEDIA = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif)$/i;
const MIME_TO_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

const include = {
  createdBy: { select: { id: true, name: true } },
  media: { include: { file: true }, orderBy: { createdAt: "asc" } },
};

async function _broadcastNotification(title, body, data = {}) {
  try {
    const tokens = await prisma.deviceToken.findMany({
      where: { isActive: true },
      select: { token: true },
    });
    if (!tokens.length) return;
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: tokens.map((t) => t.token),
        sound: "default",
        title,
        body,
        data,
        ttl: 3600,
      }),
    });
  } catch {
    // never break the main flow
  }
}

async function _uploadMedia(files) {
  if (files.length > MAX_MEDIA) throw new Error(`Maximum ${MAX_MEDIA} media files allowed`);
  const uploaded = [];
  for (const f of files) {
    if (!ALLOWED_MIME.test(f.mimeType)) throw new Error(`Unsupported file type: ${f.mimeType}`);
    const buffer = Buffer.from(f.base64, "base64");
    if (buffer.length > MAX_FILE_SIZE) throw new Error(`${f.fileName} exceeds 10 MB`);
    // Derive format from mime type first, fall back to file extension
    const ext = MIME_TO_EXT[f.mimeType.toLowerCase()] || path.extname(f.fileName).slice(1) || "jpg";
    const publicId = `events/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await uploadBuffer(buffer, {
      public_id: publicId,
      resource_type: "image",
      format: ext,
      overwrite: true,
    });
    uploaded.push({
      originalName: f.fileName,
      mimeType: f.mimeType,
      extension: `.${ext}`,
      size: buffer.length,
      publicId: result.public_id,
      secureUrl: result.secure_url,
      caption: f.caption || null,
    });
  }
  return uploaded;
}

function _toPayload(event) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startDate: event.startDate,
    endDate: event.endDate,
    status: event.status,
    createdBy: event.createdBy,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    media: (event.media || []).map((m) => ({
      id: m.id,
      caption: m.caption,
      fileId: m.file.id,
      url: m.file.publicUrl,
      mimeType: m.file.mimeType,
      fileName: m.file.originalName,
    })),
  };
}

async function list() {
  const events = await prisma.event.findMany({ include, orderBy: { startDate: "desc" } });
  return events.map(_toPayload);
}

async function getOne(eventId) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, include });
  if (!event) throw new Error("Event not found");
  return _toPayload(event);
}

async function create(userId, input) {
  if (!input.title?.trim()) throw new Error("Event title is required");
  if (!input.startDate) throw new Error("Start date is required");
  const startDate = new Date(input.startDate);
  if (isNaN(startDate.getTime())) throw new Error("Invalid start date");
  const endDate = input.endDate ? new Date(input.endDate) : null;

  const uploadedMedia = Array.isArray(input.media) && input.media.length
    ? await _uploadMedia(input.media)
    : [];

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        location: input.location?.trim() || null,
        startDate,
        endDate,
        status: input.status || "UPCOMING",
        createdById: userId,
      },
    });

    for (const m of uploadedMedia) {
      const file = await tx.file.create({
        data: {
          fileName: m.publicId,
          originalName: m.originalName,
          mimeType: m.mimeType,
          extension: m.extension,
          size: m.size,
          storagePath: m.publicId,
          publicUrl: m.secureUrl,
          uploadedById: userId,
        },
      });
      await tx.eventMedia.create({ data: { eventId: created.id, fileId: file.id, caption: m.caption } });
    }

    return tx.event.findUnique({ where: { id: created.id }, include });
  });

  const payload = _toPayload(event);

  _broadcastNotification(
    `📅 New Event: ${payload.title}`,
    payload.description
      ? payload.description.slice(0, 100)
      : `Scheduled for ${new Date(payload.startDate).toLocaleDateString("en-IN")}`,
    { type: "EVENT", eventId: payload.id }
  );

  return payload;
}

async function updateStatus(userId, eventId, status) {
  const valid = ["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"];
  if (!valid.includes(status)) throw new Error("Invalid status");
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  const updated = await prisma.event.update({ where: { id: eventId }, data: { status }, include });
  return _toPayload(updated);
}

async function addMedia(userId, eventId, files) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");

  const existing = await prisma.eventMedia.count({ where: { eventId } });
  if (existing + files.length > MAX_MEDIA) throw new Error(`Maximum ${MAX_MEDIA} media files per event`);

  const uploaded = await _uploadMedia(files);

  await prisma.$transaction(async (tx) => {
    for (const m of uploaded) {
      const file = await tx.file.create({
        data: {
          fileName: m.publicId,
          originalName: m.originalName,
          mimeType: m.mimeType,
          extension: m.extension,
          size: m.size,
          storagePath: m.publicId,
          publicUrl: m.secureUrl,
          uploadedById: userId,
        },
      });
      await tx.eventMedia.create({ data: { eventId, fileId: file.id, caption: m.caption } });
    }
  });

  return getOne(eventId);
}

async function removeMedia(userId, eventId, mediaId) {
  const media = await prisma.eventMedia.findUnique({ where: { id: mediaId }, include: { file: true } });
  if (!media || media.eventId !== eventId) throw new Error("Media not found");
  await deleteFile(media.file.storagePath, "image").catch(() => {});
  await prisma.$transaction(async (tx) => {
    await tx.eventMedia.delete({ where: { id: mediaId } });
    await tx.file.delete({ where: { id: media.file.id } });
  });
  return { message: "Media removed" };
}

async function remove(userId, eventId) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { media: { include: { file: true } } } });
  if (!event) throw new Error("Event not found");
  for (const m of event.media) {
    await deleteFile(m.file.storagePath, "image").catch(() => {});
  }
  await prisma.event.delete({ where: { id: eventId } });
  return { message: "Event deleted" };
}

module.exports = { list, getOne, create, updateStatus, addMedia, removeMedia, remove };
