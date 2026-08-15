const { v2: cloudinary } = require('cloudinary')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

function withAttachmentDownloadUrl(url) {
  if (!url) return url

  try {
    const parsed = new URL(url)
    parsed.searchParams.set('fl_attachment', 'true')
    parsed.searchParams.set('download', '1')
    return parsed.toString()
  } catch {
    return url
  }
}

function getAttachmentDownloadUrl(url) {
  return withAttachmentDownloadUrl(url)
}

function normalizeUploadOptions(options = {}) {
  const normalized = { ...options }

  if (normalized.public_id && !normalized.format) {
    const match = String(normalized.public_id).match(/\.([a-z0-9]+)$/i)
    if (match?.[1]) {
      normalized.format = match[1]
    }
  }

  return normalized
}

async function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const normalizedOptions = normalizeUploadOptions(options)
    const stream = cloudinary.uploader.upload_stream(normalizedOptions, (error, result) => {
      if (error) return reject(error)

      if (result?.secure_url) {
        result.secure_url = withAttachmentDownloadUrl(result.secure_url)
      }

      resolve(result)
    })
    stream.end(buffer)
  })
}

async function deleteFile(publicId) {
  return cloudinary.uploader.destroy(publicId, { resource_type: 'raw' })
}

module.exports = { uploadBuffer, deleteFile, getAttachmentDownloadUrl, withAttachmentDownloadUrl }
