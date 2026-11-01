const axios = require('axios')
const { buildEmail, getLogoUrl } = require('./email.logo')

const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL

const td = (label, value, valueStyle) =>
  '<tr>' +
  '<td style="padding:13px 16px;border:1px solid #e5e7eb;font-weight:600;width:120px;color:#374151;">' + label + '</td>' +
  '<td style="padding:13px 16px;border:1px solid #e5e7eb;' + (valueStyle || 'color:#111827;') + '">' + value + '</td>' +
  '</tr>'

const sendHomeworkEmail = async ({
  to, parentName, studentName, className, homeworkTitle,
  description, instructions, dueAt, teacherName, courseName, attachments = [],
}) => {
  const dueDateLabel = dueAt
    ? new Date(dueAt).toLocaleDateString('en-IN', { dateStyle: 'long' })
    : 'No due date'
  const logoUrl = await getLogoUrl()
  const recipientName = parentName || studentName

  const attachmentRows = attachments.map((a) =>
    '<tr><td style="padding:11px 14px;border:1px solid #e5e7eb;">' +
    '<a href="' + a.publicUrl + '" target="_blank" style="color:#3b33c4;font-weight:600;text-decoration:none;">&#128206; ' + a.fileName + '</a>' +
    '</td></tr>'
  ).join('\n')

  const attachmentsSection = attachments.length
    ? '<p style="margin:24px 0 8px;font-size:14px;font-weight:700;color:#111827;">Attachments</p>' +
      '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">' + attachmentRows + '</table>'
    : ''

  const content = [
    '<p style="font-size:20px;font-weight:700;color:#111827;margin:0 0 10px;">Dear ' + recipientName + ' &#128075;</p>',
    '<p style="font-size:15px;color:#6b7280;line-height:1.7;margin:0 0 28px;">A new homework has been assigned to <strong style="color:#111827;">' + studentName + '</strong>.</p>',

    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 4px;">',
    td('Student', studentName),
    td('Class', className || courseName || ''),
    td('Subject', courseName || ''),
    td('Homework', homeworkTitle, 'color:#3b33c4;font-weight:700;'),
    td('Due Date', dueDateLabel),
    td('Teacher', teacherName),
    description ? td('Description', description) : '',
    instructions ? td('Instructions', instructions) : '',
    '</table>',

    attachmentsSection,
  ].join('\n')

  const htmlContent = buildEmail({
    title: 'New Homework Assigned',
    subtitle: 'New Homework Assigned',
    contentHtml: content,
    fromName: MAIL_FROM_NAME,
    logoUrl,
  })

  const payload = {
    sender: { name: MAIL_FROM_NAME, email: MAIL_FROM_EMAIL },
    to: [{ email: to, name: recipientName }],
    subject: 'New Homework: ' + homeworkTitle + ' \u2022 Due ' + dueDateLabel,
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
