const axios = require('axios')

const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL

const sendNoticeEmail = async ({
  to,
  parentName,
  studentName,
  noticeTitle,
  content,
  postedBy,
  postedAt,
  attachments = [],
}) => {
  const dateLabel = postedAt
    ? new Date(postedAt).toLocaleDateString(undefined, { dateStyle: 'long' })
    : new Date().toLocaleDateString(undefined, { dateStyle: 'long' })

  const attachmentRows = attachments.length
    ? attachments
        .map(
          (a) => `
        <tr>
          <td style="padding:12px 14px;border:1px solid #e5e7eb;">
            <a href="${a.publicUrl}" target="_blank"
               style="color:#3b33c4;font-weight:600;text-decoration:none;">
              📎 ${a.fileName}
            </a>
          </td>
        </tr>`
        )
        .join('')
    : ''

  const attachmentsSection = attachments.length
    ? `
      <p style="margin-top:28px;font-size:14px;font-weight:700;color:#111827;">Attachments</p>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        ${attachmentRows}
      </table>`
    : ''

  const htmlContent = `
    <div style="font-family:Inter,Arial,sans-serif;background:#f9fafb;padding:40px;">
      <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:12px;padding:40px;border:1px solid #e5e7eb;">

        <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">${MAIL_FROM_NAME}</p>

        <h1 style="margin:0 0 24px;font-size:24px;color:#111827;">📢 New Notice</h1>

        <p style="font-size:15px;color:#374151;line-height:1.7;">
          Dear <strong>${parentName || studentName}</strong>,
          <br/><br/>
          A new notice has been posted for <strong>${studentName}</strong>.
        </p>

        <div style="margin-top:28px;padding:20px 24px;background:#f5f3ff;border-left:4px solid #3b33c4;border-radius:8px;">
          <p style="margin:0;font-size:18px;font-weight:800;color:#111827;">${noticeTitle}</p>
          ${content ? `<p style="margin:12px 0 0;font-size:14px;color:#374151;line-height:1.7;">${content}</p>` : ''}
        </div>

        <table style="width:100%;margin-top:28px;border-collapse:collapse;">
          <tr>
            <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;width:140px;">Posted By</td>
            <td style="padding:14px;border:1px solid #e5e7eb;">${postedBy}</td>
          </tr>
          <tr>
            <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;">Date</td>
            <td style="padding:14px;border:1px solid #e5e7eb;">${dateLabel}</td>
          </tr>
        </table>

        ${attachmentsSection}

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:40px 0;" />

        <p style="font-size:13px;color:#6b7280;line-height:1.7;">
          Regards,<br/>
          <strong>${MAIL_FROM_NAME}</strong><br/>
          This is an automated email. Please do not reply.
        </p>

      </div>
    </div>
  `

  const payload = {
    sender: { name: MAIL_FROM_NAME, email: MAIL_FROM_EMAIL },
    to: [{ email: to, name: parentName || studentName }],
    subject: `Notice: ${noticeTitle}`,
    htmlContent,
  }

  try {
    const res = await axios.post(BREVO_URL, payload, {
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    })
    console.log('NOTICE EMAIL SENT:', res.data?.messageId)
  } catch (err) {
    console.error('Notice email failed:', err.response?.data || err.message)
  }
}

module.exports = { sendNoticeEmail }
