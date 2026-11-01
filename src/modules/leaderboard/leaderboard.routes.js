const router = require("express").Router();
const controller = require("./leaderboard.controller");
const auth = require("../../shared/middlewares/auth.middleware");
const role = require("../../shared/middlewares/role.middleware");

router.use(auth);
router.get("/student", role(["student"]), (req, res) => controller.studentData(req, res));
router.get("/teacher/courses", role(["teacher"]), (req, res) => controller.courses(req, res));
router.get("/teacher/overview", role(["teacher"]), (req, res) => controller.teacherOverview(req, res));
router.get("/teacher/:courseId", role(["teacher"]), (req, res) => controller.classData(req, res));
router.get("/admin/courses", role(["admin"]), (req, res) => controller.courses(req, res));
router.get("/admin/overview", role(["admin"]), (req, res) => controller.adminOverview(req, res));
router.get("/admin/:courseId", role(["admin"]), (req, res) => controller.classData(req, res));

module.exports = router;
