const Joi = require("joi");

const attachmentSchema = Joi.object({
  fileName: Joi.string().trim().min(1).max(180).required(),

  mimeType: Joi.string().trim().min(3).max(120).required(),

  base64: Joi.string().base64().required(),
});

const submissionAttachmentSchema = attachmentSchema;

exports.createHomeworkSchema = Joi.object({
  courseId: Joi.string().uuid().required(),

  title: Joi.string().trim().min(2).max(160).required(),

  description: Joi.string().trim().max(2000).allow("").optional(),

  instructions: Joi.string().trim().max(10000).allow("").optional(),

  dueAt: Joi.date().iso().allow(null).optional(),

  allowLateSubmission: Joi.boolean().optional(),

  totalMarks: Joi.number().integer().min(1).max(1000).optional(),

  status: Joi.string().valid("DRAFT", "PUBLISHED", "ARCHIVED").optional(),

  attachments: Joi.array().items(attachmentSchema).max(10).optional(),
});

exports.updateHomeworkSchema = Joi.object({
  title: Joi.string().trim().min(2).max(160),

  description: Joi.string().trim().max(2000).allow(""),

  instructions: Joi.string().trim().max(10000).allow(""),

  dueAt: Joi.date().iso().allow(null),

  allowLateSubmission: Joi.boolean(),

  totalMarks: Joi.number().integer().min(1).max(1000),

  status: Joi.string().valid("DRAFT", "PUBLISHED", "ARCHIVED"),

  attachments: Joi.array().items(attachmentSchema).max(10),
}).min(1);

exports.submitHomeworkSchema = Joi.object({
  textSubmission: Joi.string().trim().max(10000).allow("").optional(),

  attachments: Joi.array().items(submissionAttachmentSchema).max(10).optional(),
});

exports.gradeSubmissionSchema = Joi.object({
  marks: Joi.number().integer().min(0).max(1000).required(),

  feedback: Joi.string().trim().max(4000).allow("").optional(),
});
