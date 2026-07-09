const router = require("express").Router();

const controller = require("./homework.controller");

const auth = require("../../shared/middlewares/auth.middleware");
const role = require("../../shared/middlewares/role.middleware");

router.post("/teacher", auth, role(["teacher"]), (req, res) =>
  controller.create(req, res),
);

router.get("/teacher", auth, role(["teacher"]), (req, res) =>
  controller.listForTeacher(req, res),
);

router.get("/teacher/:homeworkId", auth, role(["teacher"]), (req, res) =>
  controller.getHomeworkForTeacher(req, res),
);

router.put("/teacher/:homeworkId", auth, role(["teacher"]), (req, res) =>
  controller.update(req, res),
);

router.patch("/teacher/:homeworkId", auth, role(["teacher"]), (req, res) =>
  controller.update(req, res),
);

router.delete("/teacher/:homeworkId", auth, role(["teacher"]), (req, res) =>
  controller.delete(req, res),
);

router.get(
  "/teacher/:homeworkId/attachments/:fileId",
  auth,
  role(["teacher"]),
  (req, res) => controller.downloadForTeacher(req, res),
);

router.get(
  "/teacher/:homeworkId/submissions",
  auth,
  role(["teacher"]),
  (req, res) => controller.listSubmissionsForTeacher(req, res),
);

router.post(
  "/teacher/:homeworkId/resubmissions/reopen",
  auth,
  role(["teacher"]),
  (req, res) => controller.reopenResubmissions(req, res),
);

router.post(
  "/teacher/:homeworkId/submissions/:studentId/grade",
  auth,
  role(["teacher"]),
  (req, res) => controller.gradeSubmission(req, res),
);

router.get(
  "/teacher/:homeworkId/submissions/:studentId/attachments/:fileId",
  auth,
  role(["teacher"]),
  (req, res) => controller.downloadSubmissionForTeacher(req, res),
);

router.get("/student", auth, role(["student"]), (req, res) =>
  controller.listForStudent(req, res),
);

router.get("/student/:homeworkId", auth, role(["student"]), (req, res) =>
  controller.getHomeworkForStudent(req, res),
);

router.get(
  "/student/:homeworkId/submission",
  auth,
  role(["student"]),
  (req, res) => controller.getStudentSubmission(req, res),
);

router.post(
  "/student/:homeworkId/submission",
  auth,
  role(["student"]),
  (req, res) => controller.submitForStudent(req, res),
);

router.get(
  "/student/:homeworkId/attachments/:fileId",
  auth,
  role(["student"]),
  (req, res) => controller.downloadForStudent(req, res),
);

router.get(
  "/student/:homeworkId/submission/attachments/:fileId",
  auth,
  role(["student"]),
  (req, res) => controller.downloadSubmissionForStudent(req, res),
);

module.exports = router;
