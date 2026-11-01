const path = require("path");

const ALLOWED_MIME_TYPES = Object.freeze([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/octet-stream",
  "binary/octet-stream",
]);

const EXTENSION_ALIASES = Object.freeze({
  ".pdf": ["application/pdf", "application/octet-stream"],
  ".png": ["image/png", "application/octet-stream"],
  ".jpg": ["image/jpeg", "image/jpg", "application/octet-stream"],
  ".jpeg": ["image/jpeg", "image/jpg", "application/octet-stream"],
  ".webp": ["image/webp", "application/octet-stream"],
  ".gif": ["image/gif", "application/octet-stream"],
  ".txt": ["text/plain", "application/octet-stream"],
  ".csv": ["text/csv", "application/csv", "application/vnd.ms-excel", "application/octet-stream"],
  ".doc": ["application/msword", "application/octet-stream"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"],
  ".xls": ["application/vnd.ms-excel", "application/octet-stream"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
  ".ppt": ["application/vnd.ms-powerpoint", "application/octet-stream"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream"],
  ".zip": ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
  ".rar": ["application/x-rar-compressed", "application/vnd.rar", "application/octet-stream"],
});

function normalizeMimeType(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().split(";", 1)[0].trim();
}

function getAllowedMimeTypesForFile(fileName, mimeType) {
  const normalizedMimeType = normalizeMimeType(mimeType);
  const extension = path.extname(String(fileName || "")).toLowerCase();

  if (extension) {
    const mappedTypes = EXTENSION_ALIASES[extension] || [];
    if (mappedTypes.includes(normalizedMimeType)) return true;

    if (normalizedMimeType === "application/octet-stream" || normalizedMimeType === "binary/octet-stream") {
      return mappedTypes.length > 0;
    }
  }

  return ALLOWED_MIME_TYPES.includes(normalizedMimeType);
}

function isAllowedAttachmentType(fileName, mimeType) {
  if (!fileName) return false;
  const normalizedMimeType = normalizeMimeType(mimeType);
  if (!normalizedMimeType) return false;

  if (getAllowedMimeTypesForFile(fileName, normalizedMimeType)) {
    return true;
  }

  const extension = path.extname(String(fileName)).toLowerCase();
  if (!extension) return false;

  const mappedTypes = EXTENSION_ALIASES[extension] || [];
  return mappedTypes.includes(normalizedMimeType) || mappedTypes.includes("application/octet-stream");
}

module.exports = {
  ALLOWED_MIME_TYPES,
  normalizeMimeType,
  isAllowedAttachmentType,
};
