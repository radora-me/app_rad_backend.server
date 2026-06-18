const Joi = require('joi')

const notSunday = Joi.date().custom((value, helpers) => {
  if (new Date(value).getDay() === 0) {
    return helpers.error('any.invalid')
  }
  return value
}, 'No Sunday').messages({
  'any.invalid': 'Attendance cannot be marked on Sundays'
})

exports.fullDaySchema = Joi.object({

  date: notSunday.required(),

  students: Joi.array().items(

    Joi.object({

      studentId: Joi.string().required(),

      status: Joi.string()
        .valid('PRESENT', 'ABSENT', 'LEAVE')
        .required()
    })

  ).required()
})

exports.subjectWiseSchema = Joi.object({

  courseId: Joi.string().required(),

  date: notSunday.required(),

  students: Joi.array().items(

    Joi.object({

      studentId: Joi.string().required(),

      status: Joi.string()
        .valid('PRESENT', 'ABSENT', 'LEAVE')
        .required()
    })

  ).required()
})
