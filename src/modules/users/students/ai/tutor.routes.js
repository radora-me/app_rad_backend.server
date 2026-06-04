const router = require("express").Router();

const controller = require("./tutor.controller");
const auth = require("../../../../shared/middlewares/auth.middleware");
const role = require("../../../../shared/middlewares/role.middleware");

router.get("/context", auth, role(["student"]), (req, res) =>
  controller.context(req, res),
);

router.post("/chat", auth, role(["student"]), (req, res) =>
  controller.chat(req, res),
);

module.exports = router;
