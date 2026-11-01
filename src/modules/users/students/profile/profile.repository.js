const prisma = require("../../../../core/database/prisma");

class StudentProfileRepository {
  async findById(studentId) {
    return prisma.user.findUnique({
      where: { id: studentId },
      include: {
        enrollments: { include: { course: true } },
        attendanceRecords: true,
        studentProfile: true,
      },
    });
  }
}

module.exports = new StudentProfileRepository();
