const router = require("express").Router();
const controller = require("./dashboard.controller");
const auth = require("../../../shared/middlewares/auth.middleware");
const role = require("../../../shared/middlewares/role.middleware");

router.get("/overview", auth, role(["admin"]), (req, res) => controller.overview(req, res));

module.exports = router;
