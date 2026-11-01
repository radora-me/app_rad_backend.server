const router = require("express").Router();

const controller = require("./profile.controller");
const auth = require("../../../../shared/middlewares/auth.middleware");
const role = require("../../../../shared/middlewares/role.middleware");

router.get("/profile", auth, role(["student"]), (req, res) =>
  controller.profile(req, res),
);
router.get("/dashboard", auth, role(["student"]), (req, res) =>
  controller.dashboard(req, res),
);

module.exports = router;
