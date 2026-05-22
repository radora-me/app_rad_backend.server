const router = require("express").Router();

const controller = require("./students.controller");
const auth = require("../../../../shared/middlewares/auth.middleware");
const role = require("../../../../shared/middlewares/role.middleware");

router.get("/", auth, role(["teacher"]), (req, res) =>
  controller.list(req, res),
);
router.get("/by-roll/:rollNumber", auth, role(["teacher"]), (req, res) =>
  controller.findByRollNumber(req, res),
);
router.put("/by-roll/:rollNumber", auth, role(["teacher"]), (req, res) =>
  controller.upsert(req, res),
);

module.exports = router;
