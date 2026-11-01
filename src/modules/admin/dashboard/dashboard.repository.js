const prisma = require("../../../core/database/prisma");

class AdminDashboardRepository {
  async getOverviewData(since, now) {
    const [
      studentCount,
      teacherCount,
      attendanceRecords,
      gradedSubmissions,
      homeworkCount,
      submissionCount,
      gradedSubmissionCount,
      upcomingHomework,
      holidays,
      recentHomework,
      recentAttendance,
      upcomingEvents,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "student" } }),
      prisma.user.count({ where: { role: "teacher" } }),
      prisma.attendance.findMany({
        where: { date: { gte: since } },
        select: { date: true, status: true },
      }),
      prisma.homeworkSubmission.findMany({
        where: { status: "GRADED", marks: { not: null } },
        select: { marks: true, homework: { select: { totalMarks: true } } },
      }),
      prisma.homework.count(),
      prisma.homeworkSubmission.count(),
      prisma.homeworkSubmission.count({ where: { status: "GRADED" } }),
      prisma.homework.findMany({
        where: { status: "PUBLISHED", dueAt: { gte: now } },
        select: { id: true, title: true, dueAt: true, course: { select: { title: true, description: true } } },
        orderBy: { dueAt: "asc" },
        take: 8,
      }),
      prisma.holiday.findMany({
        where: { date: { gte: now } },
        select: { id: true, title: true, date: true },
        orderBy: { date: "asc" },
        take: 8,
      }),
      prisma.homework.findMany({
        select: { id: true, title: true, createdAt: true, teacher: { select: { name: true } }, course: { select: { title: true, description: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.attendance.findMany({
        select: { id: true, date: true, createdAt: true, status: true, markedBy: true, course: { select: { title: true, description: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.event.findMany({
        where: { status: "UPCOMING" },
        select: { id: true, title: true, description: true, location: true, startDate: true, endDate: true, status: true },
        orderBy: { startDate: "asc" },
        take: 10,
      }),
    ]);

    const markerIds = [...new Set(recentAttendance.map((item) => item.markedBy).filter(Boolean))];
    const markers = markerIds.length
      ? await prisma.user.findMany({ where: { id: { in: markerIds } }, select: { id: true, name: true } })
      : [];

    return {
      studentCount,
      teacherCount,
      attendanceRecords,
      gradedSubmissions,
      homeworkCount,
      submissionCount,
      gradedSubmissionCount,
      upcomingHomework,
      holidays,
      recentHomework,
      recentAttendance,
      markers,
      upcomingEvents,
    };
  }
}

module.exports = new AdminDashboardRepository();
