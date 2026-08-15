const axios = require('axios')
const { buildEmail, getLogoUrl } = require('./email.logo')

const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL
const PASSWORD_RESET_URL = (process.env.PASSWORD_RESET_URL || 'https://next.radora.tech/reset-password').replace(/\/+$/, '')

const sendPasswordResetEmail = async ({ to, name, otp, resetToken }) => {
  const magicLink = PASSWORD_RESET_URL + '?token=' + encodeURIComponent(resetToken)
  const logoUrl = await getLogoUrl()

  const content = [
    '<p style="font-size:20px;font-weight:700;color:#111827;margin:0 0 10px;">Hello, ' + name + ' &#128075;</p>',
    '<p style="font-size:15px;color:#6b7280;line-height:1.7;margin:0 0 32px;">We received a request to reset your Radora Next account password. Use the OTP below or click the button to set a new password.</p>',

    // OTP label
    '<p style="font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;text-align:center;margin:0 0 14px;">Your One-Time Password</p>',

    // OTP box
    '<div style="background:#f5f3ff;border:2px solid #c4b5fd;border-radius:16px;padding:28px 20px;text-align:center;margin:0 0 10px;">',
    '  <span style="font-size:46px;font-weight:800;color:#3b33c4;letter-spacing:12px;font-family:Georgia,serif;">' + otp + '</span>',
    '</div>',
    '<p style="font-size:12px;color:#9ca3af;text-align:center;margin:0 0 32px;">Valid for <strong>10 minutes</strong> &nbsp;&middot;&nbsp; Never share this with anyone</p>',

    // divider
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">',
    '  <tr>',
    '    <td style="border-bottom:1px solid #e5e7eb;"></td>',
    '    <td style="font-size:12px;color:#9ca3af;padding:0 14px;white-space:nowrap;text-align:center;">or reset via link</td>',
    '    <td style="border-bottom:1px solid #e5e7eb;"></td>',
    '  </tr>',
    '</table>',

    // CTA
    '<div style="text-align:center;margin:0 0 32px;">',
    '  <a href="' + magicLink + '" target="_blank"',
    '     style="display:inline-block;padding:15px 36px;background:#3b33c4;color:#ffffff;',
    '            text-decoration:none;border-radius:12px;font-size:15px;font-weight:700;">',
    '    Reset My Password &#8594;',
    '  </a>',
    '</div>',

    // warning
    '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;">',
    '  <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">',
    '    &#9888; <strong>Didn\'t request this?</strong> You can safely ignore this email.',
    '    Your password will remain unchanged.',
    '  </p>',
    '</div>',
  ].join('\n')

  const htmlContent = buildEmail({
    title: 'Reset Your Password',
    subtitle: 'Password Reset Request',
    contentHtml: content,
    fromName: MAIL_FROM_NAME,
    logoUrl,
  })

  const payload = {
    sender: { name: MAIL_FROM_NAME, email: MAIL_FROM_EMAIL },
    to: [{ email: to, name }],
    subject: otp + ' \u2014 Reset your Radora Next password',
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
