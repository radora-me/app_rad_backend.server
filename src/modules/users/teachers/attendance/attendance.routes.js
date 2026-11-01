const router = require("express").Router();

const controller = require("./attendance.controller");

const auth = require("../../../../shared/middlewares/auth.middleware");

const role = require("../../../../shared/middlewares/role.middleware");

const repo = require("./attendance.repository");
const { safeClassName } = require("../../../../shared/utils/display-labels");

router.get("/my-courses", auth, role(["teacher", "admin"]), async (req, res) => {
  try {
    const courses = req.user.role === "admin"
      ? await repo.listAllCourses()
      : await repo.listTeacherCourses(req.user.id);
    res.json(courses.map((course) => ({
      id: course.id,
      title: safeClassName(course.title),
      description: course.description || "",
      courseId: course.id,
      className: safeClassName(course.title),
      section: course.description || "",
      _count: { enrollments: course._count.enrollments },
      studentCount: course._count.enrollments,
    })));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.get("/available-classes", auth, role(["teacher", "admin"]), async (req, res) => {
  try {
    const courses = req.user.role === "admin"
      ? await repo.listAllCourses()
      : await repo.listAvailableCourses(req.user.id);
    res.json(courses.map((course) => ({
      id: course.id,
      title: safeClassName(course.title),
      description: course.description || "",
      courseId: course.id,
      className: safeClassName(course.title),
      section: course.description || "",
      _count: { enrollments: course._count.enrollments },
      studentCount: course._count.enrollments,
    })));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.post("/full-day", auth, role(["teacher", "admin"]), (req, res) =>
  controller.fullDay(req, res),
);

router.get(
  "/course/:courseId/attendance",
  auth,
  role(["teacher", "admin"]),
  (req, res) => controller.courseAttendance(req, res),
);

router.get("/holidays", auth, role(["teacher", "admin"]), (req, res) =>
  controller.holidays(req, res),
);

router.get(
  "/course/:courseId/student/:rollNumber/attendance",
  auth,
  role(["teacher", "admin"]),
  (req, res) => controller.studentAttendance(req, res),
);

router.patch(
  "/course/:courseId/student/:rollNumber/attendance",
  auth,
  role(["teacher", "admin"]),
  (req, res) => controller.updateStudentAttendance(req, res),
);

router.post("/subject-wise", auth, role(["teacher", "admin"]), (req, res) =>
  controller.subjectWise(req, res),
);

router.get("/course/:courseId/students", auth, role(["teacher", "admin"]), (req, res) =>
  controller.students(req, res),
);

router.get(
  "/course/:courseId/student/:rollNumber/history",
  auth,
  role(["teacher", "admin"]),
  (req, res) => controller.studentAttendanceHistory(req, res),
);

module.exports = router;
