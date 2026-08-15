const router = require("express").Router();

const authRoutes = require("../../modules/auth/auth.routes");
const teacherAttendanceRoutes = require("../../modules/users/teachers/attendance/attendance.routes");
const teacherStudentRoutes = require("../../modules/users/teachers/students/students.routes");
const classroomChatRoutes = require("../../modules/chat/classroom/chat.routes");
const homeworkRoutes = require("../../modules/homework/homework.routes");
const studentAttendanceRoutes = require("../../modules/users/students/attendance/attendance.routes");
const studentProfileRoutes = require("../../modules/users/students/profile/profile.routes");
const studentAiTutorRoutes = require("../../modules/users/students/ai/tutor.routes");
const noticeRoutes = require("../../modules/notice/notice.routes");
const timetableRoutes = require("../../modules/timetable/timetable.routes");
const notificationRoutes = require("../../modules/notifications/notifications.routes");

router.use("/auth", authRoutes);
router.use("/teacher/attendance", teacherAttendanceRoutes);
router.use("/teacher/students", teacherStudentRoutes);
router.use("/chat", classroomChatRoutes);
router.use("/homework", homeworkRoutes);
router.use("/student/attendance", studentAttendanceRoutes);
router.use("/student/ai/tutor", studentAiTutorRoutes);
router.use("/student", studentProfileRoutes);
router.use("/notices", noticeRoutes);
router.use("/timetables", timetableRoutes);
router.use("/notifications", notificationRoutes);

console.log("Main routes loaded");
module.exports = router;
