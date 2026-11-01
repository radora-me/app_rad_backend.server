const Joi = require("joi");
const { sendWalkthroughEnquiry } = require("./enquiries.service");

const enquirySchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(120).required(),
  workEmail: Joi.string().trim().email({ minDomainSegments: 2 }).max(254).required(),
  organizationName: Joi.string().trim().min(2).max(160).required(),
  contactNumber: Joi.string().trim().pattern(/^\+?[1-9]\d{7,14}$/).required(),
  designation: Joi.string().trim().max(100).allow("").default(""),
  interests: Joi.string().trim().max(1000).allow("").default(""),
  consent: Joi.boolean().valid(true).required(),
});

async function submit(req, res) {
  const { error, value } = enquirySchema.validate(req.body, {
    abortEarly: false,
    convert: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      error: "Please check the required enquiry details and try again.",
    });
  }

  try {
    await sendWalkthroughEnquiry(value);
    return res.status(202).json({ success: true, message: "Enquiry received." });
  } catch (sendError) {
    const status = sendError.statusCode || 502;
    return res.status(status).json({
      success: false,
      error: status === 503
        ? "The enquiry service is not configured yet."
        : "We couldn't send your request. Please try again.",
    });
  }
}

module.exports = { submit };
