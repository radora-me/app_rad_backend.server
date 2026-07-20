const axios = require('axios')

const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://next.radora.tech'

const STATUS_CONFIG = {
  PRESENT: { color: '#16a34a', bg: '#dcfce7', label: 'Present' },
  ABSENT:  { color: '#dc2626', bg: '#fee2e2', label: 'Absent' },
  LATE:    { color: '#d97706', bg: '#fef3c7', label: 'Late' },
  LEAVE:   { color: '#2563eb', bg: '#dbeafe', label: 'On Leave' },
}

const sendAttendanceUpdateEmail = async ({
  to,
  studentName,
  className,
  section,
  attendanceDate,
  status,
}) => {
  const currentStatus = STATUS_CONFIG[status] || {
    color: '#111827',
    bg: '#f3f4f6',
    label: status,
  }

  const classLabel = `${className}${section ? ` - ${section}` : ''}`

  const payload = {
    sender: {
      name: MAIL_FROM_NAME,
      email: MAIL_FROM_EMAIL,
    },

    to: [
      {
        email: to,
        name: studentName || 'Student',
      },
    ],

    subject: `Attendance Update • ${attendanceDate}`,

    htmlContent: `
      <div style="font-family:Inter,Arial,sans-serif;background:#f9fafb;padding:40px;">
        <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:12px;padding:40px;border:1px solid #e5e7eb;">

          <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">
            ${MAIL_FROM_NAME}
          </p>

          <h1 style="margin:0 0 24px;font-size:24px;color:#111827;">
            Daily Attendance Update
          </h1>

          <p style="font-size:15px;color:#374151;line-height:1.7;">
            Hello <strong>${studentName}</strong>,
            <br/><br/>
            Your attendance has been updated by your class teacher.
          </p>

          <table style="width:100%;margin-top:28px;border-collapse:collapse;">
            <tr>
              <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;">Student</td>
              <td style="padding:14px;border:1px solid #e5e7eb;">${studentName}</td>
            </tr>
            <tr>
              <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;">Class</td>
              <td style="padding:14px;border:1px solid #e5e7eb;">${classLabel}</td>
            </tr>
            <tr>
              <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;">Date</td>
              <td style="padding:14px;border:1px solid #e5e7eb;">${attendanceDate}</td>
            </tr>
            <tr>
              <td style="padding:14px;border:1px solid #e5e7eb;font-weight:600;">Status</td>
              <td style="padding:14px;border:1px solid #e5e7eb;">
                <span style="display:inline-block;padding:8px 16px;border-radius:999px;background:${currentStatus.bg};color:${currentStatus.color};font-weight:600;font-size:13px;">
                  ${currentStatus.label}
                </span>
              </td>
            </tr>
          </table>

          <p style="margin-top:28px;font-size:14px;color:#4b5563;line-height:1.7;">
            If you believe this attendance record is incorrect, please contact your class teacher or school administration.
          </p>

          <a
            href="${FRONTEND_URL}"
            target="_blank"
            style="display:inline-block;margin-top:28px;padding:12px 26px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;"
          >
            View Attendance
          </a>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:40px 0;" />

          <p style="font-size:13px;color:#6b7280;line-height:1.7;">
            Regards,<br/>
            <strong>${MAIL_FROM_NAME}</strong><br/>
            This is an automated email. Please do not reply.
          </p>

        </div>
      </div>
    `,

    textContent: `
Hello ${studentName},

Your attendance has been updated.

Student: ${studentName}
Class: ${classLabel}
Date: ${attendanceDate}
Status: ${currentStatus.label}

View Attendance: ${FRONTEND_URL}

Regards,
${MAIL_FROM_NAME}
    `,
  }

  try {
    const response = await axios.post(BREVO_URL, payload, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    })

    console.log('ATTENDANCE EMAIL SENT:', response.data?.messageId)

    return response.data
  } catch (error) {
    console.error(
      'Brevo attendance email failed:',
      error.response?.data || error.message
    )
    // do not throw — email failure should not break attendance marking
  }
}

module.exports = { sendAttendanceUpdateEmail }
