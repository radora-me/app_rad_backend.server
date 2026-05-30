const prisma = require("../../core/database/prisma");

class AuthRepository {
  async create(data) {
    return prisma.user.create({ data });
  }

  async findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByRollNumber(rollNumber) {
    return prisma.user.findUnique({ where: { rollNumber } });
  }

  async findById(id) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findTeacherByEmail(email) {
    return prisma.user.findFirst({
      where: {
        email,
        role: "teacher",
      },
    });
  }

  async findTeacherCourseByClass(teacherId, className, section) {
    return prisma.course.findFirst({
      where: {
        teacherId,
        title: className,
        description: section,
      },
    });
  }

  async createTeacherCourse({ teacherId, className, section }) {
    return prisma.course.create({
      data: {
        teacherId,
        title: className,
        description: section,
      },
    });
  }

  async updateTeacherCourse(courseId, { className, section }) {
    return prisma.course.update({
      where: { id: courseId },
      data: {
        title: className,
        description: section,
      },
    });
  }

  async listTeacherCourses(teacherId) {
    return prisma.course.findMany({
      where: { teacherId },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async createHoliday({ title, date, createdBy }) {
    const normalizedDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    return prisma.holiday.upsert({
      where: { date: normalizedDate },
      update: {
        title,
        createdBy,
      },
      create: {
        title,
        date: normalizedDate,
        createdBy,
      },
    });
  }

  async listHolidays() {
    return prisma.holiday.findMany({
      orderBy: { date: "asc" },
    });
  }
}

module.exports = new AuthRepository();
