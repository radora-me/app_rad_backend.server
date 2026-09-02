const router = require("express").Router();

const controller = require("./attendance.controller");

const auth = require("../../../../shared/middlewares/auth.middleware");

const role = require("../../../../shared/middlewares/role.middleware");

const repo = require("./attendance.repository");

router.get("/my-courses", auth, role(["teacher"]), async (req, res) => {
  try {
    const courses = await repo.listTeacherCourses(req.user.id);
    res.json(courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description || "",
      courseId: course.id,
      className: course.title,
      section: course.description || "",
      _count: { enrollments: course._count.enrollments },
      studentCount: course._count.enrollments,
    })));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.get("/available-classes", auth, role(["teacher"]), async (req, res) => {
  try {
    const courses = await repo.listAvailableCourses(req.user.id);
    res.json(courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description || "",
      courseId: course.id,
      className: course.title,
      section: course.description || "",
      _count: { enrollments: course._count.enrollments },
      studentCount: course._count.enrollments,
    })));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.post("/full-day", auth, role(["teacher"]), (req, res) =>
  controller.fullDay(req, res),
);

router.get(
  "/course/:courseId/attendance",
  auth,
  role(["teacher"]),
  (req, res) => controller.courseAttendance(req, res),
);

router.get("/holidays", auth, role(["teacher"]), (req, res) =>
  controller.holidays(req, res),
);

router.get(
  "/course/:courseId/student/:rollNumber/attendance",
  auth,
  role(["teacher"]),
  (req, res) => controller.studentAttendance(req, res),
);

router.patch(
  "/course/:courseId/student/:rollNumber/attendance",
  auth,
  role(["teacher"]),
  (req, res) => controller.updateStudentAttendance(req, res),
);

router.post("/subject-wise", auth, role(["teacher"]), (req, res) =>
  controller.subjectWise(req, res),
);

router.get("/course/:courseId/students", auth, role(["teacher"]), (req, res) =>
  controller.students(req, res),
);

module.exports = router;
