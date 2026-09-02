const router = require("express").Router();

const controller = require("./attendance.controller");

const auth = require("../../../../shared/middlewares/auth.middleware");

const role = require("../../../../shared/middlewares/role.middleware");

const prisma = require("../../../../core/database/prisma");

router.get("/my-courses", auth, role(["teacher"]), async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where: { teacherId: req.user.id },
      select: {
        id: true,
        title: true,
        description: true,
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.json(courses.map((course) => ({
      courseId: course.id,
      className: course.title,
      section: course.description || "",
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
