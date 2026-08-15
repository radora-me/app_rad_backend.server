const router = require("express").Router();
const controller = require("./timetable.controller");
const auth = require("../../shared/middlewares/auth.middleware");
const role = require("../../shared/middlewares/role.middleware");

router.use(auth);
router.get("/me", role(["student", "teacher"]), (req, res) => controller.listMine(req, res));
router.get("/admin/courses", role(["admin"]), (req, res) => controller.listCourses(req, res));
router.get("/admin", role(["admin"]), (req, res) => controller.listAdmin(req, res));
router.post("/admin", role(["admin"]), (req, res) => controller.create(req, res));
router.put("/admin/:id/assign", role(["admin"]), (req, res) => controller.assign(req, res));
module.exports = router;
