const router = require("express").Router();
const controller = require("./auth.controller");
const auth = require("../../shared/middlewares/auth.middleware");
const role = require("../../shared/middlewares/role.middleware");

// Public
router.post("/register", (req, res) => controller.register(req, res));
router.post("/login/student", (req, res) => controller.studentLogin(req, res));
router.post("/login/teacher", (req, res) => controller.teacherLogin(req, res));
router.post("/refresh", (req, res) => controller.refresh(req, res));
router.post("/forgot-password", (req, res) => controller.forgotPassword(req, res));
router.post("/verify-otp", (req, res) => controller.verifyOtp(req, res));
router.post("/reset-password", (req, res) => controller.resetPassword(req, res));

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
router.get("/admin/search-student", auth, role(["admin"]), (req, res) =>
  controller.searchStudent(req, res),
);
router.post("/admin/create-holiday", auth, role(["admin"]), (req, res) =>
  controller.createHoliday(req, res),
);
router.get("/admin/holidays", auth, role(["admin"]), (req, res) =>
  controller.listHolidays(req, res),
);
router.post("/admin/assign-teacher-class", auth, role(["admin"]), (req, res) =>
  controller.assignTeacherClass(req, res),
);

// Teacher — own profile
router.get("/teacher/me", auth, role(["teacher"]), (req, res) =>
  controller.getTeacher({ ...req, params: { teacherId: req.user.id } }, res),
);

// Admin — teacher management
router.get("/admin/teachers", auth, role(["admin"]), (req, res) =>
  controller.listTeachers(req, res),
);
router.get("/admin/teachers/:teacherId", auth, role(["admin"]), (req, res) =>
  controller.getTeacher(req, res),
);
router.patch("/admin/teachers/:teacherId", auth, role(["admin"]), (req, res) =>
  controller.updateTeacher(req, res),
);

// Admin — own profile
router.get("/admin/profile", auth, role(["admin"]), (req, res) =>
  controller.getAdminProfile(req, res),
);
router.patch("/admin/profile", auth, role(["admin"]), (req, res) =>
  controller.updateAdminProfile(req, res),
);

module.exports = router;
