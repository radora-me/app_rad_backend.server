const Joi = require('joi')

exports.fullDaySchema = Joi.object({

  date: Joi.date().required(),

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

  date: Joi.date().required(),

  students: Joi.array().items(

    Joi.object({

      studentId: Joi.string().required(),

      status: Joi.string()
        .valid('PRESENT', 'ABSENT', 'LEAVE')
        .required()
    })

  ).required()
})