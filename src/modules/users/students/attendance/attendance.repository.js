const prisma = require("../../../../core/database/prisma");

class AttendanceRepository {
  async getStudentAttendance(studentId) {
    return prisma.attendance.findMany({
      where: {
        studentId,
      },

      include: {
        course: true,
      },

      orderBy: {
        date: "desc",
      },
    });
  }

  async getHolidays() {
    return prisma.holiday.findMany({
      orderBy: {
        date: "asc",
      },
    });
  }

  async createLeave(data) {
    return prisma.leave.create({
      data,
    });
  }

  async getLeaveHistory(studentId) {
    return prisma.leave.findMany({
      where: {
        studentId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  }
}

module.exports = new AttendanceRepository();
