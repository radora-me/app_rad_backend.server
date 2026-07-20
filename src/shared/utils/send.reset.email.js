const axios = require('axios')

const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://radora.tech'

const sendPasswordResetEmail = async ({ to, name, otp, resetToken }) => {
  const magicLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`

  const htmlContent = `
    <div style="font-family:Inter,Arial,sans-serif;background:#f9fafb;padding:40px;">
      <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:12px;padding:40px;border:1px solid #e5e7eb;">

        <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">${MAIL_FROM_NAME}</p>

        <h1 style="margin:0 0 24px;font-size:24px;color:#111827;">Reset Your Password</h1>

        <p style="font-size:15px;color:#374151;line-height:1.7;">
          Hello <strong>${name}</strong>,
          <br/><br/>
          We received a request to reset your password. Use the OTP below or click the reset link.
        </p>

        <div style="margin:32px 0;text-align:center;">
          <p style="font-size:13px;color:#6b7280;margin:0 0 12px;font-weight:600;letter-spacing:0.5px;">YOUR ONE-TIME PASSWORD</p>
          <div style="display:inline-block;background:#f5f3ff;border:2px dashed #3b33c4;border-radius:16px;padding:20px 40px;">
            <span style="font-size:40px;font-weight:800;color:#3b33c4;letter-spacing:12px;">${otp}</span>
          </div>
          <p style="font-size:13px;color:#9ca3af;margin:12px 0 0;">Valid for 10 minutes. Do not share this with anyone.</p>
        </div>

        <div style="text-align:center;margin:32px 0;">
          <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">Or use the magic link to reset directly:</p>
          <a
            href="${magicLink}"
            target="_blank"
            style="display:inline-block;padding:14px 32px;background:#3b33c4;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700;"
          >
            Reset Password
          </a>
        </div>

        <p style="font-size:13px;color:#6b7280;line-height:1.7;margin-top:32px;">
          If you did not request a password reset, you can safely ignore this email. Your password will not change.
        </p>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;" />

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
    to: [{ email: to, name }],
    subject: `${otp} is your ${MAIL_FROM_NAME} password reset OTP`,
    htmlContent,
  }

  try {
    const res = await axios.post(BREVO_URL, payload, {
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    })
    console.log('PASSWORD RESET EMAIL SENT:', res.data?.messageId)
  } catch (err) {
    console.error('Password reset email failed:', err.response?.data || err.message)
    throw new Error('Failed to send reset email')
  }
}

module.exports = { sendPasswordResetEmail }
