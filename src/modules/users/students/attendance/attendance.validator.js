const Joi = require('joi')

exports.leaveSchema = Joi.object({

  fromDate: Joi.date().required(),

  toDate: Joi.date().required(),

  reason: Joi.string().required()
})