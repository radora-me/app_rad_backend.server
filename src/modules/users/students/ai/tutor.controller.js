const service = require("./tutor.service");

class StudentAiTutorController {
  async context(req, res) {
    try {
      const result = await service.getContext(req.user.id);
      res.json(result);
    } catch (err) {
      const status = err.message === "Student not found" ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  }

  async chat(req, res) {
    try {
      const result = await service.chat(req.user.id, req.body);
      res.json(result);
    } catch (err) {
      const status = err.message === "Student not found" ? 404 : 500;
      res.status(status).json({ error: err.message });
    }
  }
}

module.exports = new StudentAiTutorController();
