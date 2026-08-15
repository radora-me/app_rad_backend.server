const router = require("express").Router();

const controller = require("./notifications.controller");
const auth = require("../../shared/middlewares/auth.middleware");

router.post("/register-device-token", auth, (req, res) =>
  controller.registerDeviceToken(req, res),
);

module.exports = router;
