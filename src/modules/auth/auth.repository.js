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

  async hasOwnedCourses(teacherId) {
    const count = await prisma.course.count({ where: { teacherId } });
    return count > 0;
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

  async updatePassword(userId, hashedPassword) {
    return prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async updateUser(userId, data) {
    return prisma.user.update({
      where: { id: userId },
      data,
      include: { taughtCourses: true },
    });
  }

  async findTeacherById(id) {
    return prisma.user.findFirst({
      where: { id, role: "teacher" },
      include: { taughtCourses: true },
    });
  }

  async listAllTeachers() {
    return prisma.user.findMany({
      where: { role: "teacher" },
      include: { taughtCourses: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findAdminById(id) {
    return prisma.user.findFirst({
      where: { id, role: "admin" },
    });
  }

  async findByEmailExcluding(email, excludeId) {
    return prisma.user.findFirst({
      where: { email, NOT: { id: excludeId } },
    });
  }
}


module.exports = new AuthRepository();
