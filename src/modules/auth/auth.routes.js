const router = require("express").Router();
const controller = require("./auth.controller");
const auth = require("../../shared/middlewares/auth.middleware");
const role = require("../../shared/middlewares/role.middleware");

// Public
router.post("/login/student", (req, res) => controller.studentLogin(req, res));
router.post("/login/teacher", (req, res) => controller.teacherLogin(req, res));
router.post("/refresh", (req, res) => controller.refresh(req, res));

// Authenticated
router.post("/logout", auth, (req, res) => controller.logout(req, res));

// Admin only
router.post("/admin/create-student", auth, role(["admin"]), (req, res) =>
  controller.createStudent(req, res),
);
router.post("/admin/create-teacher", auth, role(["admin"]), (req, res) =>
  controller.createTeacher(req, res),
);
router.get("/admin/search-teacher", auth, role(["admin"]), (req, res) =>
  controller.searchTeacher(req, res),
);
router.post("/admin/assign-teacher-class", auth, role(["admin"]), (req, res) =>
  controller.assignTeacherClass(req, res),
);

module.exports = router;
