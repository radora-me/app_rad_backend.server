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

exports.updateTeacherSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  email: Joi.string().email().optional(),
  address: Joi.string().allow("").optional(),
});

exports.updateAdminSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  email: Joi.string().email().optional(),
});

exports.forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

exports.verifyOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
});

exports.resetPasswordSchema = Joi.object({
  resetToken: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});
