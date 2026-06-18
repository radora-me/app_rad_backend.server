const service = require("./homework.service")

const {
  createHomeworkSchema,
  updateHomeworkSchema
} = require("./homework.validator")

class HomeworkController {
  async create(req, res) {
    try {
      const { error, value } =
        createHomeworkSchema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        })

      if (error) {
        return res.status(400).json({
    message: "Validation failed",
    errors: error.details.map(item=>item.message)
})
      }

      const result =
        await service.createHomework(
          req.user.id,
          value
        )

      return res.status(201).json(result)
    } catch (err) {
      return this._handleError(res, err)
    }
  }

  async update(req, res) {
    try {
      const { error, value } =
        updateHomeworkSchema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        })

      if (error) {
        return res.status(400).json({
    message: "Validation failed",
    errors: error.details.map(item=>item.message)
})
      }
if (!req.params.homeworkId) {
  return res.status(400).json({
    message: "Validation failed",
    errors: ["Homework ID is required"]
  })
}
      const result =
        await service.updateHomework(
          req.user.id,
          req.params.homeworkId,
          value
        )

      return res.json(result)
    } catch (err) {
      return this._handleError(res, err)
    }
  }

  async delete(req, res) {
    try {
      if (!req.params.homeworkId) {
  return res.status(400).json({
    message: "Validation failed",
    errors: ["Homework ID is required"]
  })
}
      const result =
        await service.deleteHomework(
          req.user.id,
          req.params.homeworkId
        )

      return res.json(result)
    } catch (err) {
      return this._handleError(res, err)
    }
  }
  async listForTeacher(req, res) {
    try {
      const result =
        await service.listForTeacher(
          req.user.id
        )

      return res.json(result)
    } catch (err) {
      return this._handleError(res, err)
    }
  }

  async listForStudent(req, res) {
    try {
      const result =
        await service.listForStudent(
          req.user.id
        )

      return res.json(result)
    } catch (err) {
      return this._handleError(res, err)
    }
  }

  async getHomeworkForTeacher(req, res) {
    try {
      if (!req.params.homeworkId) {
  return res.status(400).json({
    message: "Validation failed",
    errors: ["Homework ID is required"]
  })
}
      const result =
        await service.getHomeworkForTeacher(
          req.user.id,
          req.params.homeworkId
        )

      return res.json(result)
    } catch (err) {
      return this._handleError(res, err)
    }
  }

  async getHomeworkForStudent(req, res) {
    try {
      if (!req.params.homeworkId) {
  return res.status(400).json({
    message: "Validation failed",
    errors: ["Homework ID is required"]
  })
}
      const result =
        await service.getHomeworkForStudent(
          req.user.id,
          req.params.homeworkId
        )

      return res.json(result)
    } catch (err) {
      return this._handleError(res, err)
    }
  }

    async downloadForTeacher(req, res) {
    try {
      if (!req.params.homeworkId) {
  return res.status(400).json({
    message: "Validation failed",
    errors: ["Homework ID is required"]
  })
}
if (!req.params.fileId) {
  return res.status(400).json({
    message: "Validation failed",
    errors: ["File ID is required"]
  })
}
      const file =
        await service.getDownloadForTeacher(
          req.user.id,
          req.params.homeworkId,
          req.params.fileId
        )

      return this._sendDownload(res, file)
    } catch (err) {
      return this._handleError(res, err)
    }
  }

  async downloadForStudent(req, res) {
    try {
      if (!req.params.homeworkId) {
  return res.status(400).json({
    message: "Validation failed",
    errors: ["Homework ID is required"]
  })
}
if (!req.params.fileId) {
  return res.status(400).json({
    message: "Validation failed",
    errors: ["File ID is required"]
  })
}
      const file =
        await service.getDownloadForStudent(
          req.user.id,
          req.params.homeworkId,
          req.params.fileId
        )

      return this._sendDownload(res, file)
    } catch (err) {
      return this._handleError(res, err)
    }
  }

  _sendDownload(res, file) {
    return res.redirect(file.url)
  }

  _handleError(res, err) {
    let status = 400

    switch (err.message) {
      case "Homework not found":
      case "Attachment not found":
      case "Attachment file not found":
        status = 404
        break

      case "Unauthorized course access":
        status = 403
        break

      case "Maximum 10 attachments allowed":
      case "Unsupported attachment type":
      case "Attachment size cannot exceed 10 MB":
      case "Attachment filename is required":
      case "Attachment content is missing":
        status = 400
        break

      default:
  
        status = 500
    }

    return res.status(status).json({
      error: err.message
    })
  }
}

module.exports = new HomeworkController()