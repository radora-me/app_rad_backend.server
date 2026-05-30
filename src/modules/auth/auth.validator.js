const Joi = require("joi");

exports.studentLoginSchema = Joi.object({
  rollNumber: Joi.string().required(),
  password: Joi.string().required(),
});

exports.teacherLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

exports.registerSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid("admin").optional(),
});

exports.createStudentSchema = Joi.object({
  name: Joi.string().min(2).required(),
  rollNumber: Joi.string().min(2).required(),
  password: Joi.string().min(6).required(),
});

exports.createTeacherSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

exports.createHolidaySchema = Joi.object({
  title: Joi.string().min(2).required(),
  date: Joi.date().required(),
});
