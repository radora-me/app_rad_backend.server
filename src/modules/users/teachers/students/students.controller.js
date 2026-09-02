const Joi = require("joi");
const service = require("./students.service");

const upsertSchema = Joi.object({
  courseIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
}).unknown(true);

const profileSchema = Joi.object({
  address: Joi.string().allow("", null),
  city: Joi.string().allow("", null),
  state: Joi.string().allow("", null),
  pincode: Joi.string().allow("", null),
  parentName: Joi.string().allow("", null),
  parentEmail: Joi.string().email().allow("", null),
  parentPhone: Joi.string().allow("", null),
  parentRelation: Joi.string().allow("", null),
  dateOfBirth: Joi.string().isoDate().allow("", null),
  bloodGroup: Joi.string().allow("", null),
  emergencyPhone: Joi.string().allow("", null),
});

class TeacherStudentsController {
  async list(req, res) {
    try {
      const result = await service.list(req.user.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async findByRollNumber(req, res) {
    try {
      const result = await service.findByRollNumber(
        req.user.id,
        req.params.rollNumber,
        req.user.role,
      );
      res.json(result);
    } catch (err) {
      const status = err.message === "Student not found" ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  }

  async upsert(req, res) {
    try {
      const { error } = upsertSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const result = await service.upsertStudent(
        req.user.id,
        req.params.rollNumber,
        req.body,
      );
      res.json(result);
    } catch (err) {
      const status = err.message === "Student not found" ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  }

  async updateProfile(req, res) {
    try {
      const { error, value } = profileSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.message });

      const result = await service.updateStudentProfile(
        req.user.id,
        req.params.rollNumber,
        value,
        req.user.role,
      );
      res.json(result);
    } catch (err) {
      const status = err.message === "Student not found" ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  }

  async getFullProfile(req, res) {
    try {
      const result = await service.getFullProfile(
        req.user.id,
        req.params.rollNumber,
        req.user.role,
      );
      res.json(result);
    } catch (err) {
      const status = err.message === "Student not found" ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  }
}

module.exports = new TeacherStudentsController();
