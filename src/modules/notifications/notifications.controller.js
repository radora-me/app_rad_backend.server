const service = require("./notifications.service");

class NotificationsController {
  async registerDeviceToken(req, res) {
    try {
      const { pushToken, platform } = req.body || {};
      if (!pushToken || !String(pushToken).trim()) {
        return res.status(400).json({ error: "Push token is required" });
      }

      const result = await service.registerDeviceToken(req.user.id, {
        pushToken: String(pushToken).trim(),
        platform: platform || "unknown",
      });

      return res.json({
        message: "Device token registered",
        token: result,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || "Could not register device token" });
    }
  }
}

module.exports = new NotificationsController();
