const service = require("./chat.service");

class ClassroomChatController {
  async rooms(req, res) {
    try {
      const result = await service.listRooms(req.user.id, req.user.role);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async messages(req, res) {
    try {
      const limit = Number.parseInt(req.query.limit || "100", 10);
      const result = await service.getRoomMessages(
        req.user.id,
        req.user.role,
        req.params.courseId,
        Number.isNaN(limit) ? 100 : limit,
      );

      res.json(result);
    } catch (err) {
      const status =
        err.message === "Unauthorized classroom access" ? 403 : 400;
      res.status(status).json({ error: err.message });
    }
  }

  async sendMessage(req, res) {
    try {
      const result = await service.sendMessage(
        req.user.id,
        req.user.role,
        req.params.courseId,
        req.body.content,
      );

      res.status(201).json(result);
    } catch (err) {
      const status =
        err.message === "Unauthorized classroom access" ? 403 : 400;
      res.status(status).json({ error: err.message });
    }
  }
}

module.exports = new ClassroomChatController();
