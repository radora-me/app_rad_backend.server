const Joi = require('joi')

const futureOrTodayDate = Joi.date().custom((value, helpers) => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  if (value.toISOString().slice(0, 10) < tomorrow) return helpers.error('date.future')
  return value
}).messages({
  'date.future': 'Leave dates cannot be in the past',
})

exports.leaveSchema = Joi.object({
  fromDate: futureOrTodayDate.required(),

  toDate: futureOrTodayDate.required(),

  reason: Joi.string().required()
}).custom((value, helpers) => {
  if (value.toDate < value.fromDate) return helpers.error('date.order')
  return value
}).messages({
  'date.order': 'To date must be on or after from date',
})
