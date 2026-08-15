const Joi = require("joi");

const time = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);

exports.createTimetableSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  className: Joi.string().trim().min(1).max(80).required(),
  section: Joi.string().trim().max(40).allow("").optional(),
  courseIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  entries: Joi.array().items(Joi.object({
    dayOfWeek: Joi.number().integer().min(0).max(6).required(),
    startTime: time.required(),
    endTime: time.required(),
    subject: Joi.string().trim().min(1).max(100).required(),
    room: Joi.string().trim().max(60).allow("").optional(),
    teacherId: Joi.string().uuid().optional(),
    courseId: Joi.string().uuid().optional(),
  })).min(1).required(),
});

exports.assignTimetableSchema = Joi.object({
  courseIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
});
