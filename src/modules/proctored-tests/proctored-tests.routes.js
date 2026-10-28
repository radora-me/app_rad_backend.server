const router = require("express").Router();
const controller = require("./proctored-tests.controller");
const auth = require("../../shared/middlewares/auth.middleware");
const role = require("../../shared/middlewares/role.middleware");

router.use(auth);

router.post("/teacher", role(["teacher"]), (req, res) => controller.create(req, res));
router.get("/teacher", role(["teacher"]), (req, res) => controller.listTeacher(req, res));
router.get("/teacher/:testId", role(["teacher"]), (req, res) => controller.getTeacher(req, res));
router.put("/teacher/:testId", role(["teacher"]), (req, res) => controller.update(req, res));
router.post("/teacher/:testId/publish", role(["teacher"]), (req, res) => controller.publish(req, res));
router.post("/teacher/:testId/close", role(["teacher"]), (req, res) => controller.close(req, res));
router.post("/teacher/:testId/results", role(["teacher"]), (req, res) => controller.publishResults(req, res));
router.get("/teacher/:testId/attempts", role(["teacher"]), (req, res) => controller.teacherAttempts(req, res));
router.post("/teacher/attempts/:attemptId/grade", role(["teacher"]), (req, res) => controller.grade(req, res));

router.get("/student", role(["student"]), (req, res) => controller.listStudent(req, res));
router.post("/student/:testId/start", role(["student"]), (req, res) => controller.start(req, res));
router.get("/student/attempts/:attemptId", role(["student"]), (req, res) => controller.studentAttempt(req, res));
router.put("/student/attempts/:attemptId/answers", role(["student"]), (req, res) => controller.saveAnswers(req, res));
router.post("/student/attempts/:attemptId/events", role(["student"]), (req, res) => controller.event(req, res));
router.post("/student/attempts/:attemptId/submit", role(["student"]), (req, res) => controller.submit(req, res));
router.get("/student/attempts/:attemptId/result", role(["student"]), (req, res) => controller.result(req, res));

router.get("/admin", role(["admin"]), (req, res) => controller.listAdmin(req, res));
router.get("/admin/:testId/attempts", role(["admin"]), (req, res) => controller.adminAttempts(req, res));

module.exports = router;
