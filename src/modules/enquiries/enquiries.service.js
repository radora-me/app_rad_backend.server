const axios = require("axios");
const { buildEmail, getLogoUrl } = require("../../shared/utils/email.logo");

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const ENQUIRY_RECIPIENT = "office@radora.tech";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function sendWalkthroughEnquiry(enquiry) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.MAIL_FROM_EMAIL;
  const senderName = process.env.MAIL_FROM_NAME || "Radora";

  if (!apiKey || !senderEmail) {
    const error = new Error("The enquiry email service is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const fields = [
    ["Name", enquiry.fullName],
    ["Work email", enquiry.workEmail],
    ["Organization", enquiry.organizationName],
    ["Contact number", enquiry.contactNumber],
    ["Designation", enquiry.designation || "Not provided"],
    ["Interested in", enquiry.interests || "Not provided"],
  ];

  const rows = fields.map(([label, value]) =>
    '<tr><td style="padding:12px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">' +
    escapeHtml(label) +
    '</td><td style="padding:12px;border:1px solid #e5e7eb;color:#111827;">' +
    escapeHtml(value) +
    "</td></tr>",
  ).join("");

  const htmlContent = buildEmail({
    title: "Product walkthrough enquiry",
    subtitle: "New product walkthrough enquiry",
    fromName: senderName,
    logoUrl: await getLogoUrl(),
    contentHtml: [
      '<p style="font-size:15px;color:#374151;line-height:1.7;">A visitor requested access to the Radora product walkthrough.</p>',
      '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">',
      rows,
      "</table>",
    ].join(""),
  });

  const textContent = [
    "A visitor requested access to the Radora product walkthrough.",
    ...fields.map(([label, value]) => label + ": " + String(value ?? "Not provided")),
  ].join("\n");

  try {
    await axios.post(BREVO_URL, {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: ENQUIRY_RECIPIENT, name: "Radora Office" }],
      replyTo: { email: enquiry.workEmail, name: enquiry.fullName },
      subject: "New Radora product walkthrough enquiry",
      htmlContent,
      textContent,
    }, {
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      timeout: 15000,
    });
  } catch (cause) {
    // Keep contact details and provider response payloads out of application logs.
    console.error("Walkthrough enquiry email failed:", cause.code || "Brevo request failed");
    const error = new Error("The enquiry email could not be sent. Please try again.");
    error.statusCode = 502;
    throw error;
  }
}

module.exports = { sendWalkthroughEnquiry };
