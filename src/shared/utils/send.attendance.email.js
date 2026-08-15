const axios = require('axios')
const { buildEmail, getLogoUrl } = require('./email.logo')

const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://next.radora.tech'

// Mirrors the AttendanceStatus enum in schema.prisma exactly
const STATUS_CONFIG = {
  PRESENT: { color: '#16a34a', bg: '#dcfce7', label: 'Present' },
  ABSENT:  { color: '#dc2626', bg: '#fee2e2', label: 'Absent' },
  LEAVE:   { color: '#2563eb', bg: '#dbeafe', label: 'On Leave' },
}

const formatDate = (isoDateStr) => {
  const [year, month, day] = isoDateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { dateStyle: 'long' })
}

const td = (label, value) =>
  '<tr>' +
  '<td style="padding:13px 16px;border:1px solid #e5e7eb;font-weight:600;width:120px;color:#374151;">' + label + '</td>' +
  '<td style="padding:13px 16px;border:1px solid #e5e7eb;color:#111827;">' + value + '</td>' +
  '</tr>'

const sendAttendanceUpdateEmail = async ({ to, studentName, className, section, attendanceDate, status }) => {
  const currentStatus = STATUS_CONFIG[status] ?? { color: '#111827', bg: '#f3f4f6', label: status }
  const parts = [className, section].filter(Boolean)
  const classLabel = parts.length ? parts.join(' - ') : 'Not assigned'
  const formattedDate = formatDate(attendanceDate)
  const logoUrl = await getLogoUrl()

  const statusBadge =
    '<span style="display:inline-block;padding:5px 14px;border-radius:999px;' +
    'background:' + currentStatus.bg + ';color:' + currentStatus.color + ';' +
    'font-weight:700;font-size:13px;">' + currentStatus.label + '</span>'

  const content = [
    '<p style="font-size:20px;font-weight:700;color:#111827;margin:0 0 10px;">Hello, ' + studentName + ' &#128075;</p>',
    '<p style="font-size:15px;color:#6b7280;line-height:1.7;margin:0 0 28px;">Your attendance has been updated by your class teacher.</p>',

    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px;">',
    td('Student', studentName),
    td('Class', classLabel),
    td('Date', formattedDate),
    td('Status', statusBadge),
    '</table>',

    '<p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 28px;">If you believe this record is incorrect, please contact your class teacher or school administration.</p>',

    '<div style="text-align:center;">',
    '  <a href="' + FRONTEND_URL + '" target="_blank"',
    '     style="display:inline-block;padding:14px 32px;background:#3b33c4;color:#ffffff;',
    '            text-decoration:none;border-radius:12px;font-size:14px;font-weight:700;">',
    '    View Attendance &#8594;',
    '  </a>',
    '</div>',
  ].join('\n')

  const htmlContent = buildEmail({
    title: 'Attendance Update',
    subtitle: 'Daily Attendance Update',
    contentHtml: content,
    fromName: MAIL_FROM_NAME,
    logoUrl,
  })

  const payload = {
    sender: { name: MAIL_FROM_NAME, email: MAIL_FROM_EMAIL },
    to: [{ email: to, name: studentName || 'Student' }],
    subject: 'Attendance Update \u2022 ' + formattedDate,
    htmlContent,
    textContent: 'Hello ' + studentName + ',\n\nYour attendance has been updated.\n\nStudent: ' + studentName + '\nClass: ' + classLabel + '\nDate: ' + formattedDate + '\nStatus: ' + currentStatus.label + '\n\nView Attendance: ' + FRONTEND_URL + '\n\nRegards,\n' + MAIL_FROM_NAME,
  }

  try {
    const response = await axios.post(BREVO_URL, payload, {
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    })
    console.log('ATTENDANCE EMAIL SENT:', response.data?.messageId)
    return response.data
  } catch (error) {
    console.error('Brevo attendance email failed:', error.response?.data || error.message)
  }
}

module.exports = { sendAttendanceUpdateEmail }
