const service = require("./homework.service");

const {
  createHomeworkSchema,
  updateHomeworkSchema,
  submitHomeworkSchema,
  gradeSubmissionSchema,
} = require("./homework.validator");

class HomeworkController {
  async create(req, res) {
    try {
      const { error, value } = createHomeworkSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.details.map((item) => item.message),
        });
      }

      const result = await service.createHomework(req.user.id, value);

      return res.status(201).json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async update(req, res) {
    try {
      const { error, value } = updateHomeworkSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.details.map((item) => item.message),
        });
      }
      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }
      const result = await service.updateHomework(
        req.user.id,
        req.params.homeworkId,
        value,
      );

      return res.json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async delete(req, res) {
    try {
      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }
      const result = await service.deleteHomework(
        req.user.id,
        req.params.homeworkId,
      );

      return res.json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }
  async listForTeacher(req, res) {
    try {
      const result = await service.listForTeacher(req.user.id);

      return res.json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async listForStudent(req, res) {
    try {
      const result = await service.listForStudent(req.user.id);

      return res.json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async getHomeworkForTeacher(req, res) {
    try {
      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }
      const result = await service.getHomeworkForTeacher(
        req.user.id,
        req.params.homeworkId,
      );

      return res.json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async getHomeworkForStudent(req, res) {
    try {
      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }
      const result = await service.getHomeworkForStudent(
        req.user.id,
        req.params.homeworkId,
      );

      return res.json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async submitForStudent(req, res) {
    try {
      const { error, value } = submitHomeworkSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.details.map((item) => item.message),
        });
      }

      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }

      const result = await service.submitHomework(
        req.user.id,
        req.params.homeworkId,
        value,
      );

      return res.status(201).json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async getStudentSubmission(req, res) {
    try {
      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }

      const result = await service.getStudentSubmission(
        req.user.id,
        req.params.homeworkId,
      );

      return res.json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async listSubmissionsForTeacher(req, res) {
    try {
      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }

      const result = await service.listSubmissionsForTeacher(
        req.user.id,
        req.params.homeworkId,
      );

      return res.json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async reopenResubmissions(req, res) {
    try {
      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }

      const result = await service.reopenResubmissions(
        req.user.id,
        req.params.homeworkId,
      );

      return res.json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async gradeSubmission(req, res) {
    try {
      const { error, value } = gradeSubmissionSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.details.map((item) => item.message),
        });
      }

      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }

      if (!req.params.studentId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Student ID is required"],
        });
      }

      const result = await service.gradeSubmission(
        req.user.id,
        req.params.homeworkId,
        req.params.studentId,
        value,
      );

      return res.json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async downloadForTeacher(req, res) {
    try {
      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }
      if (!req.params.fileId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["File ID is required"],
        });
      }
      const file = await service.getDownloadForTeacher(
        req.user.id,
        req.params.homeworkId,
        req.params.fileId,
      );

      return this._sendDownload(res, file);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async downloadForStudent(req, res) {
    try {
      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }
      if (!req.params.fileId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["File ID is required"],
        });
      }
      const file = await service.getDownloadForStudent(
        req.user.id,
        req.params.homeworkId,
        req.params.fileId,
      );

      return this._sendDownload(res, file);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async downloadSubmissionForTeacher(req, res) {
    try {
      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }

      if (!req.params.studentId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Student ID is required"],
        });
      }

      if (!req.params.fileId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["File ID is required"],
        });
      }

      const file = await service.getSubmissionDownloadForTeacher(
        req.user.id,
        req.params.homeworkId,
        req.params.studentId,
        req.params.fileId,
      );

      return this._sendDownload(res, file);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async downloadSubmissionForStudent(req, res) {
    try {
      if (!req.params.homeworkId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["Homework ID is required"],
        });
      }

      if (!req.params.fileId) {
        return res.status(400).json({
          message: "Validation failed",
          errors: ["File ID is required"],
        });
      }

      const file = await service.getSubmissionDownloadForStudent(
        req.user.id,
        req.params.homeworkId,
        req.params.fileId,
      );

      return this._sendDownload(res, file);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  _sendDownload(res, file) {
    return res.redirect(file.url);
  }

  _handleError(res, err) {
    let status = 400;

    switch (err.message) {
      case "Homework not found":
      case "Attachment not found":
      case "Attachment file not found":
        status = 404;
        break;

      case "Unauthorized course access":
        status = 403;
        break;

      case "Maximum 10 attachments allowed":
      case "Unsupported attachment type":
      case "Attachment size cannot exceed 10 MB":
      case "Attachment filename is required":
      case "Attachment content is missing":
      case "Please add submission text or at least one attachment":
      case "Submission window is closed for this homework":
        status = 400;
        break;

      case "Submission not found":
        status = 404;
        break;

      case "Homework must be published before reopening resubmissions":
        status = 400;
        break;

      case "Assignment has already been submitted":
      case "Submission has already been graded":
        status = 409;
        break;

      default:
        if (
          String(err.message || "").startsWith(
            "Marks cannot exceed total marks",
          )
        ) {
          status = 400;
          break;
        }

        status = 500;
    }

    return res.status(status).json({
      error: err.message,
    });
  }
}

module.exports = new HomeworkController();
