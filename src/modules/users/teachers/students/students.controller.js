const Joi = require("joi");
const service = require("./students.service");

const upsertSchema = Joi.object({
  courseIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
}).unknown(true);

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
}

module.exports = new TeacherStudentsController();
