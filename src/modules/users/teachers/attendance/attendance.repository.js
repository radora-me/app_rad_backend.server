const prisma = require("../../../../core/database/prisma");

class AttendanceRepository {
  normalizeDate(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }

    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  async verifyTeacherCourse(courseId, teacherId) {
    return prisma.course.findFirst({
      where: {
        id: courseId,
        teacherId,
      },
    });
  }

  async upsertAttendance(data) {
    const courseId = data.courseId || null;
    const normalizedDate = this.normalizeDate(data.date);

    // PostgreSQL treats NULL != NULL in unique constraints,
    // so full day (no courseId) needs findFirst + create/update
    if (!courseId) {
      const existing = await prisma.attendance.findFirst({
        where: {
          studentId: data.studentId,
          courseId: null,
          date: normalizedDate,
        },
      });

      if (existing) {
        return prisma.attendance.update({
          where: { id: existing.id },
          data: { status: data.status, mode: data.mode },
        });
      }

      return prisma.attendance.create({
        data: {
          studentId: data.studentId,
          courseId: null,
          date: normalizedDate,
          mode: data.mode,
          status: data.status,
          markedBy: data.markedBy,
        },
      });
    }

    return prisma.attendance.upsert({
      where: {
        studentId_courseId_date: {
          studentId: data.studentId,
          courseId,
          date: normalizedDate,
        },
      },
      update: {
        status: data.status,
        mode: data.mode,
      },
      create: {
        studentId: data.studentId,
        courseId,
        date: normalizedDate,
        mode: data.mode,
        status: data.status,
        markedBy: data.markedBy,
      },
    });
  }

  async getCourseStudents(courseId) {
    return prisma.enrollment.findMany({
      where: {
        courseId,
      },

      include: {
        student: true,
      },
    });
  }

  async getCourseAttendance(courseId, date) {
    const normalizedDate = this.normalizeDate(date);

    return prisma.attendance.findMany({
      where: {
        courseId,
        date: normalizedDate,
      },

      include: {
        student: true,
      },

      orderBy: {
        student: {
          name: "asc",
        },
      },
    });
  }
}

module.exports = new AttendanceRepository();
