const service = require("./profile.service");

class StudentProfileController {
  async profile(req, res) {
    try {
      const result = await service.getProfile(req.user.id);
      res.json(result);
    } catch (err) {
      const status = err.message === "Student not found" ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  }

  async dashboard(req, res) {
    try {
      const result = await service.getDashboard(req.user.id);
      res.json(result);
    } catch (err) {
      const status = err.message === "Student not found" ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  }
}

module.exports = new StudentProfileController();
