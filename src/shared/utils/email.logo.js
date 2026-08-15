const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Logo URL — resolved once at startup, cached forever.
// Priority:
//   1. LOGO_URL env var  (set this in production to your Cloudinary URL)
//   2. Cloudinary auto-upload on first boot (if credentials present)
//   3. Empty string — logo simply omitted, emails still render fine
// ---------------------------------------------------------------------------
let _logoUrl = process.env.LOGO_URL || 'https://res.cloudinary.com/dcilrqmox/image/upload/v1786789169/icon_acen23.png'
let _uploadAttempted = false

const getLogoUrl = async () => {
  if (_logoUrl) return _logoUrl
  if (_uploadAttempted) return ''
  _uploadAttempted = true

  try {
    const cloudinary = require('../../core/storage/cloudinary')
    const iconPath = path.join(__dirname, '../../assets/icon.png')
    if (!fs.existsSync(iconPath)) return ''

    const result = await cloudinary.uploader.upload(iconPath, {
      public_id: 'radora-next-icon',
      overwrite: false,
      folder: 'brand',
      resource_type: 'image',
    })
    _logoUrl = result.secure_url
    console.log('Logo uploaded to Cloudinary:', _logoUrl)
  } catch (err) {
    console.warn('Logo upload skipped:', err.message)
  }
  return _logoUrl
}

// Synchronous getter — returns whatever is cached (URL or empty string).
// Call ensureLogoReady() once at app startup to warm the cache.
const getLogoUrlSync = () => _logoUrl

const ensureLogoReady = async () => {
  await getLogoUrl()
}

// ---------------------------------------------------------------------------
// HTML building blocks — all return plain strings, zero template literals
// ---------------------------------------------------------------------------

const logoImgTag = (url) => {
  if (!url) return ''
  return (
    '<img src="' + url + '" alt="Radora" width="44" height="44" ' +
    'style="width:44px;height:44px;border-radius:12px;display:block;border:0;" />'
  )
}

/**
 * Gradient header block. Works inside both <div> and <table> layouts.
 * Returns a self-contained HTML string.
 */
const buildHeader = (subtitle, logoUrl) => {
  const img = logoImgTag(logoUrl || getLogoUrlSync())
  const parts = [
    '<div style="background:linear-gradient(135deg,#3b33c4 0%,#6c63ff 100%);padding:32px 40px;text-align:center;">',
    '  <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>',
    img ? '    <td style="vertical-align:middle;padding-right:12px;">' + img + '</td>' : '',
    '    <td style="vertical-align:middle;text-align:left;">',
    '      <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1;">Radora</div>',
    '      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:2px;text-transform:uppercase;margin-top:3px;">Next</div>',
    '    </td>',
    '  </tr></table>',
    subtitle
      ? '  <p style="margin:16px 0 0;font-size:13px;color:rgba(255,255,255,0.75);font-weight:600;letter-spacing:1px;text-transform:uppercase;">' + subtitle + '</p>'
      : '',
    '</div>',
  ]
  return parts.filter(Boolean).join('\n')
}

/**
 * Footer block. Returns a self-contained HTML string.
 */
const buildFooter = (fromName) => [
  '<div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:24px 40px;text-align:center;">',
  '  <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.8;">',
  '    Sent by <strong>' + fromName + '</strong> &middot;',
  '    <a href="https://next.radora.tech" style="color:#3b33c4;text-decoration:none;font-weight:600;">next.radora.tech</a><br/>',
  '    This is an automated email &mdash; please do not reply.',
  '  </p>',
  '</div>',
].join('\n')

/**
 * Full email wrapper. Accepts a content HTML string and returns a complete
 * <!DOCTYPE html> document. All CSS is inline — no <style> injection.
 */
const buildEmail = (opts) => {
  // opts: { title, subtitle, contentHtml, fromName, logoUrl }
  const header = buildHeader(opts.subtitle || '', opts.logoUrl)
  const footer = buildFooter(opts.fromName)

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8"/>',
    '  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>',
    '  <title>' + (opts.title || 'Radora Next') + '</title>',
    '</head>',
    '<body style="margin:0;padding:0;background:#f0f2ff;font-family:Arial,Helvetica,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2ff;padding:40px 16px;box-sizing:border-box;">',
    '<tr><td align="center">',
    '<table cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(59,51,196,0.10);">',
    '<tr><td>' + header + '</td></tr>',
    '<tr><td style="padding:36px 40px;">' + opts.contentHtml + '</td></tr>',
    '<tr><td>' + footer + '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n')
}

module.exports = { ensureLogoReady, getLogoUrl, getLogoUrlSync, buildHeader, buildFooter, buildEmail }
