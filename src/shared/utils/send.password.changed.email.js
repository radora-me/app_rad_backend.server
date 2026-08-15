const axios = require('axios')
const { buildEmail, getLogoUrl } = require('./email.logo')

const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL

const sendPasswordChangedEmail = async ({ to, name }) => {
  const logoUrl = await getLogoUrl()
  const time = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })

  const content = [
    '<p style="font-size:20px;font-weight:700;color:#111827;margin:0 0 10px;">Hi, ' + name + ' &#128075;</p>',
    '<p style="font-size:15px;color:#6b7280;line-height:1.7;margin:0 0 28px;">Your Radora Next account password was successfully changed. You can now log in with your new password.</p>',

    // success box
    '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin:0 0 20px;">',
    '  <table cellpadding="0" cellspacing="0" border="0"><tr>',
    '    <td style="font-size:22px;vertical-align:top;padding-right:14px;line-height:1;">&#9989;</td>',
    '    <td>',
    '      <p style="margin:0;font-size:14px;font-weight:700;color:#15803d;">Password updated successfully</p>',
    '      <p style="margin:6px 0 0;font-size:13px;color:#166534;">Changed on ' + time + '</p>',
    '    </td>',
    '  </tr></table>',
    '</div>',

    // warning box
    '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:18px 22px;margin:0 0 28px;">',
    '  <p style="margin:0;font-size:13px;color:#92400e;line-height:1.7;">',
    '    &#9888; <strong>Wasn\'t you?</strong> If you did not make this change, your account may be',
    '    compromised. Contact support at',
    '    <a href="mailto:' + MAIL_FROM_EMAIL + '" style="color:#3b33c4;font-weight:600;">' + MAIL_FROM_EMAIL + '</a> immediately.',
    '  </p>',
    '</div>',

    // CTA
    '<div style="text-align:center;">',
    '  <a href="https://next.radora.tech" target="_blank"',
    '     style="display:inline-block;padding:14px 32px;background:#3b33c4;color:#ffffff;',
    '            text-decoration:none;border-radius:12px;font-size:14px;font-weight:700;">',
    '    Go to Radora Next &#8594;',
    '  </a>',
    '</div>',
  ].join('\n')

  const htmlContent = buildEmail({
    title: 'Password Changed',
    subtitle: 'Password Changed',
    contentHtml: content,
    fromName: MAIL_FROM_NAME,
    logoUrl,
  })

  const payload = {
    sender: { name: MAIL_FROM_NAME, email: MAIL_FROM_EMAIL },
    to: [{ email: to, name }],
    subject: 'Your ' + MAIL_FROM_NAME + ' password has been changed',
    htmlContent,
  }

  try {
    const res = await axios.post(BREVO_URL, payload, {
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    })
    console.log('PASSWORD CHANGED EMAIL SENT:', res.data?.messageId)
  } catch (err) {
    console.error('Password changed email failed:', err.response?.data || err.message)
  }
}

module.exports = { sendPasswordChangedEmail }
