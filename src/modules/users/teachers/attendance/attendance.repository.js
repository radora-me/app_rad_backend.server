const prisma = require("../../../../core/database/prisma");

class AttendanceRepository {
  normalizeDate(dateInput) {
    let year;
    let month;
    let day;

    if (dateInput instanceof Date) {
      year = dateInput.getFullYear();
      month = dateInput.getMonth();
      day = dateInput.getDate();
    } else if (
      typeof dateInput === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
    ) {
      const [rawYear, rawMonth, rawDay] = dateInput.split("-").map(Number);
      year = rawYear;
      month = rawMonth - 1;
      day = rawDay;
    } else {
      const date = new Date(dateInput);

      if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid date");
      }

      year = date.getFullYear();
      month = date.getMonth();
      day = date.getDate();
    }

    const normalized = new Date(year, month, day);

    if (Number.isNaN(normalized.getTime())) {
      throw new Error("Invalid date");
    }

    return normalized;
  }

  isSameNormalizedDate(left, right) {
    return (
      this.normalizeDate(left).getTime() === this.normalizeDate(right).getTime()
    );
  }

  isWithinEditWindow(createdAt, hours = 48) {
    const createdTime = new Date(createdAt).getTime();
    if (Number.isNaN(createdTime)) {
      return false;
    }

    return Date.now() - createdTime <= hours * 60 * 60 * 1000;
  }

  getTodayNormalized() {
    return this.normalizeDate(new Date());
  }

  async getHolidayByDate(dateInput) {
    const normalizedDate = this.normalizeDate(dateInput);

    return prisma.holiday.findFirst({
      where: {
        date: normalizedDate,
      },
    });
  }

  async listHolidays() {
    return prisma.holiday.findMany({
      orderBy: {
        date: "asc",
      },
    });
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
    const today = this.getTodayNormalized();

    if (!this.isSameNormalizedDate(normalizedDate, today)) {
      throw new Error("Attendance can only be marked for today");
    }

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
        if (!this.isWithinEditWindow(existing.createdAt)) {
          throw new Error("Attendance can only be edited within 48 hours");
        }

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

    const existing = await prisma.attendance.findUnique({
      where: {
        studentId_courseId_date: {
          studentId: data.studentId,
          courseId,
          date: normalizedDate,
        },
      },
    });

    if (existing) {
      if (!this.isWithinEditWindow(existing.createdAt)) {
        throw new Error("Attendance can only be edited within 48 hours");
      }

      return prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          mode: data.mode,
        },
      });
    }

    return prisma.attendance.create({
      data: {
        studentId: data.studentId,
        courseId,
        date: normalizedDate,
        mode: data.mode,
        status: data.status,
        markedBy: data.markedBy,
      },
    });
  }

  async getAttendanceByCourseAndStudents(courseId, date, studentIds) {
    const normalizedDate = this.normalizeDate(date);

    return prisma.attendance.findMany({
      where: {
        courseId,
        date: normalizedDate,
        studentId: {
          in: studentIds,
        },
      },
      select: {
        studentId: true,
        createdAt: true,
        status: true,
        mode: true,
      },
    });
  }

  async getStudentAttendanceByRollNumber(courseId, rollNumber, date) {
    const normalizedDate = this.normalizeDate(date);

    return prisma.attendance.findFirst({
      where: {
        courseId,
        date: normalizedDate,
        student: {
          rollNumber,
        },
      },
      include: {
        student: true,
        course: true,
      },
    });
  }

  async getCourseStudentByRollNumber(courseId, rollNumber) {
    return prisma.enrollment.findFirst({
      where: {
        courseId,
        student: {
          rollNumber,
        },
      },
      include: {
        student: true,
        course: true,
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
