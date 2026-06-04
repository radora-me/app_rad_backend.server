const router = require("express").Router();

const controller = require("./chat.controller");
const auth = require("../../../shared/middlewares/auth.middleware");
const role = require("../../../shared/middlewares/role.middleware");

router.get("/rooms", auth, role(["student", "teacher"]), (req, res) =>
  controller.rooms(req, res),
);

router.get(
  "/rooms/:courseId/messages",
  auth,
  role(["student", "teacher"]),
  (req, res) => controller.messages(req, res),
);

router.post(
  "/rooms/:courseId/messages",
  auth,
  role(["student", "teacher"]),
  (req, res) => controller.sendMessage(req, res),
);

module.exports = router;
