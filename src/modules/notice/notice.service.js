const path = require("path");
const repo = require("./notice.repository");
const {
  uploadBuffer,
  deleteFile,
  getAttachmentDownloadUrl,
} = require("../../core/storage/cloudinary");
const prisma = require("../../core/database/prisma");
const { isAllowedAttachmentType } = require("../../core/storage/fileTypePolicy");
const { sendNoticeEmail } = require("../../shared/utils/send.notice.email");

const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

class NoticeService {
  async _sendNoticeEmails(notice) {
    try {
      const students = await prisma.user.findMany({
        where: { role: 'student' },
        select: {
          name: true,
          studentProfile: { select: { parentEmail: true, parentName: true } },
        },
      })

      for (const student of students) {
        const parentEmail = student.studentProfile?.parentEmail
        if (!parentEmail) continue

        sendNoticeEmail({
          to: parentEmail,
          parentName: student.studentProfile?.parentName || null,
          studentName: student.name,
          noticeTitle: notice.title,
          content: notice.content || null,
          postedBy: notice.createdBy?.name || MAIL_FROM_NAME,
          postedAt: notice.createdAt,
          attachments: notice.attachments || [],
        }).catch(() => {})
      }
    } catch {
      // never break notice creation
    }
  }

  async listNotices() {
    const notices = await repo.list();
    return notices.map((n) => this._toPayload(n));
  }

  async createNotice(adminId, data) {
    const uploadedFiles =
      Array.isArray(data.attachments) && data.attachments.length
        ? await this._uploadAttachments(data.attachments)
        : [];

    const created = await repo.transaction(async (tx) => {
      const notice = await tx.notice.create({
        data: {
          title: data.title.trim(),
          content: data.content?.trim() || null,
          createdById: adminId,
        },
      });

      if (uploadedFiles.length) {
        await this._saveAttachments(tx, adminId, notice.id, uploadedFiles);
      }

      const result = await tx.notice.findUnique({
        where: { id: notice.id },
        include: repo.include(),
      });

      return this._toPayload(result);
    });

    this._sendNoticeEmails(created).catch(() => {});
    return created;
  }

  async deleteNotice(adminId, noticeId) {
    const notice = await repo.findById(noticeId);

    if (!notice) throw new Error("Notice not found");

    await repo.transaction(async (tx) => {
      for (const attachment of notice.attachments) {
        try {
          await deleteFile(attachment.file.storagePath);
        } catch (err) {
          console.error(err);
        }
        await tx.file.delete({ where: { id: attachment.file.id } });
      }
      await tx.noticeAttachment.deleteMany({ where: { noticeId } });
      await tx.notice.delete({ where: { id: noticeId } });
    });

    return { message: "Notice deleted successfully" };
  }

  async getDownload(noticeId, fileId) {
    const notice = await repo.findById(noticeId);
    if (!notice) throw new Error("Notice not found");

    const attachment = notice.attachments.find((a) => a.file.id === fileId);
    if (!attachment) throw new Error("Attachment not found");

    return {
      url: getAttachmentDownloadUrl(attachment.file.publicUrl),
      fileName: attachment.file.originalName,
      mimeType: attachment.file.mimeType,
    };
  }

  async _uploadAttachments(attachments) {
    if (attachments.length > MAX_ATTACHMENTS)
      throw new Error("Maximum 10 attachments allowed");

    const uploaded = [];

    for (const attachment of attachments) {
      if (!attachment.fileName) throw new Error("Attachment filename is required");
      if (!attachment.base64) throw new Error("Attachment content is missing");
      if (!isAllowedAttachmentType(attachment.fileName, attachment.mimeType))
        throw new Error("Unsupported attachment type");

      const buffer = Buffer.from(attachment.base64, "base64");
      if (buffer.length > MAX_FILE_SIZE)
        throw new Error("Attachment size cannot exceed 10 MB");

      const safeName = this._safeFileName(attachment.fileName);
      const result = await uploadBuffer(buffer, {
        folder: "notices",
        public_id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`,
        resource_type: "raw",
        format: path.extname(attachment.fileName).slice(1) || undefined,
        use_filename: false,
      });

      uploaded.push({
        originalName: attachment.fileName,
        mimeType: attachment.mimeType || "application/octet-stream",
        extension: path.extname(attachment.fileName) || null,
        size: buffer.length,
        publicId: result.public_id,
        secureUrl: result.secure_url,
      });
    }

    return uploaded;
  }

  async _saveAttachments(tx, uploadedById, noticeId, uploadedFiles) {
    for (const item of uploadedFiles) {
      const file = await tx.file.create({
        data: {
          fileName: item.publicId,
          originalName: item.originalName,
          mimeType: item.mimeType,
          extension: item.extension,
          size: item.size,
          storagePath: item.publicId,
          publicUrl: item.secureUrl,
          uploadedById,
        },
      });
      await tx.noticeAttachment.create({ data: { noticeId, fileId: file.id } });
    }
  }

  _safeFileName(fileName) {
    return (
      fileName
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 160) || "attachment"
    );
  }

  _toPayload(notice) {
    return {
      id: notice.id,
      title: notice.title,
      content: notice.content,
      createdAt: notice.createdAt,
      updatedAt: notice.updatedAt,
      createdBy: notice.createdBy,
      attachments: (notice.attachments ?? []).map((a) => ({
        id: a.file.id,
        fileName: a.file.originalName,
        mimeType: a.file.mimeType,
        size: a.file.size,
        publicUrl: a.file.publicUrl,
      })),
    };
  }
}

module.exports = new NoticeService();
