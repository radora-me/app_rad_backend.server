const service = require("./dashboard.service");

class AdminDashboardController {
  async overview(req, res) {
    try {
      res.json(await service.overview());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AdminDashboardController();
