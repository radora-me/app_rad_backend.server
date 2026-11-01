const Joi = require("joi");

const futureDate = Joi.date().iso().custom((value, helpers) => {
  if (value.getTime() <= Date.now()) return helpers.error("date.future");
  return value;
}).messages({
  "date.future": "Date and time must be in the future",
});

const question = Joi.object({
  prompt: Joi.string().trim().min(2).max(4000).required(),
  options: Joi.array().items(Joi.string().trim().min(1).max(500)).min(2).max(6).required(),
  correctOption: Joi.string().trim().required(),
  marks: Joi.number().integer().min(1).max(100).default(1),
});

exports.createTestSchema = Joi.object({
  courseId: Joi.string().uuid().required(),
  title: Joi.string().trim().min(2).max(180).required(),
  description: Joi.string().trim().max(3000).allow("").optional(),
  instructions: Joi.string().trim().max(10000).allow("").optional(),
  durationMinutes: Joi.number().integer().min(1).max(480).required(),
  availableFrom: futureDate.allow(null).optional(),
  dueAt: futureDate.required(),
  maxViolations: Joi.number().integer().min(1).max(10).default(3),
  status: Joi.string().valid("DRAFT", "PUBLISHED", "CLOSED").default("DRAFT"),
  questions: Joi.array().items(question).min(1).max(100).required(),
}).custom((value, helpers) => {
  const validOptions = value.questions.every((item) => item.options.includes(item.correctOption));
  if (!validOptions) return helpers.error("any.invalid");
  if (value.availableFrom && new Date(value.dueAt) <= new Date(value.availableFrom)) return helpers.error("date.order");
  return value;
}).messages({
  "any.invalid": "Every correct option must exist in its question options",
  "date.order": "Due date must be after the availability date",
});

exports.updateTestSchema = Joi.object({
  title: Joi.string().trim().min(2).max(180),
  description: Joi.string().trim().max(3000).allow(""),
  instructions: Joi.string().trim().max(10000).allow(""),
  durationMinutes: Joi.number().integer().min(1).max(480),
  availableFrom: futureDate.allow(null),
  dueAt: futureDate,
  maxViolations: Joi.number().integer().min(1).max(10),
  questions: Joi.array().items(question).min(1).max(100),
}).min(1);

exports.answerSchema = Joi.object({
  answers: Joi.array().items(Joi.object({
    questionId: Joi.string().uuid().required(),
    selectedOption: Joi.string().trim().max(500).allow(null, "").optional(),
  })).max(100).required(),
});

exports.eventSchema = Joi.object({
  type: Joi.string().valid("TAB_HIDDEN", "WINDOW_BLUR", "FULLSCREEN_EXIT", "COPY", "PASTE", "CONTEXT_MENU", "SHORTCUT_BLOCKED", "NETWORK_OFFLINE").required(),
  metadata: Joi.object().unknown(true).optional(),
});

exports.gradeSchema = Joi.object({
  marks: Joi.number().integer().min(0).max(100000).required(),
  feedback: Joi.string().trim().max(5000).allow("").optional(),
});
