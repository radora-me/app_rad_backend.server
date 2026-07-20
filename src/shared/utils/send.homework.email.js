const axios = require('axios')

const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL

const sendHomeworkEmail = async ({
  to,
  parentName,
  studentName,
  className,
  homeworkTitle,
  description,
  instructions,
  dueAt,
  teacherName,
  courseName,
  attachments = [],
}) => {
  const dueDateLabel = dueAt
    ? new Date(dueAt).toLocaleDateString(undefined, { dateStyle: 'long' })
    : 'No due date'

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

        <h1 style="margin:0 0 24px;font-size:24px;color:#111827;">New Homework Assigned</h1>

        <p style="font-size:15px;color:#374151;line-height:1.7;">
          Dear <strong>${parentName || studentName}</strong>,
          <br/><br/>
          A new homework has been assigned to <strong>${studentName}</strong>.
        </p>

        <table style="width:100%;margin-top:28px;border-collapse:collapse;">
          <tr>
            <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;width:140px;">Student</td>
            <td style="padding:14px;border:1px solid #e5e7eb;">${studentName}</td>
          </tr>
          <tr>
            <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;">Class</td>
            <td style="padding:14px;border:1px solid #e5e7eb;">${className || courseName}</td>
          </tr>
          <tr>
            <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;">Subject</td>
            <td style="padding:14px;border:1px solid #e5e7eb;">${courseName}</td>
          </tr>
          <tr>
            <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;">Homework</td>
            <td style="padding:14px;border:1px solid #e5e7eb;font-weight:700;color:#3b33c4;">${homeworkTitle}</td>
          </tr>
          <tr>
            <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;">Due Date</td>
            <td style="padding:14px;border:1px solid #e5e7eb;">${dueDateLabel}</td>
          </tr>
          <tr>
            <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;">Teacher</td>
            <td style="padding:14px;border:1px solid #e5e7eb;">${teacherName}</td>
          </tr>
          ${description ? `
          <tr>
            <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;">Description</td>
            <td style="padding:14px;border:1px solid #e5e7eb;">${description}</td>
          </tr>` : ''}
          ${instructions ? `
          <tr>
            <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;">Instructions</td>
            <td style="padding:14px;border:1px solid #e5e7eb;">${instructions}</td>
          </tr>` : ''}
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
    subject: `New Homework: ${homeworkTitle} • Due ${dueDateLabel}`,
    htmlContent,
  }

  try {
    const res = await axios.post(BREVO_URL, payload, {
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    })
    console.log('HOMEWORK EMAIL SENT:', res.data?.messageId)
  } catch (err) {
    console.error('Homework email failed:', err.response?.data || err.message)
  }
}

module.exports = { sendHomeworkEmail }
