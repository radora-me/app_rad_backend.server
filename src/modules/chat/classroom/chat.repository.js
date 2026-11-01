const prisma = require("../../../core/database/prisma");

class ClassroomChatRepository {
  async isSubjectTeacher(teacherId) {
    const count = await prisma.course.count({ where: { teacherId } });
    return count === 0;
  }

  async listTeacherRooms(teacherId) {
    const ownedRooms = await prisma.course.findMany({
      where: { teacherId },
      include: {
        teacher: true,
        _count: {
          select: { enrollments: true, chatMessages: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    if (ownedRooms.length > 0) return ownedRooms;

    return prisma.course.findMany({
      where: {},
      include: {
        teacher: true,
        _count: { select: { enrollments: true, chatMessages: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listStudentRooms(studentId) {
    return prisma.enrollment.findMany({
      where: { studentId },
      include: {
        course: {
          include: {
            teacher: true,
            _count: {
              select: { enrollments: true, chatMessages: true },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findTeacherCourse(courseId, teacherId) {
    const ownedCourse = await prisma.course.findFirst({
      where: {
        id: courseId,
        teacherId,
      },
      include: {
        teacher: true,
        _count: {
          select: { enrollments: true, chatMessages: true },
        },
      },
    });
    if (ownedCourse) return ownedCourse;

    if (!(await this.isSubjectTeacher(teacherId))) return null;

    return prisma.course.findFirst({
      where: { id: courseId },
      include: {
        teacher: true,
        _count: { select: { enrollments: true, chatMessages: true } },
      },
    });
  }

  async findStudentCourse(courseId, studentId) {
    return prisma.enrollment.findFirst({
      where: {
        courseId,
        studentId,
      },
      include: {
        course: {
          include: {
            teacher: true,
            _count: {
              select: { enrollments: true, chatMessages: true },
            },
          },
        },
      },
    });
  }

  async getCourseWithTeacher(courseId) {
    return prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: true,
        _count: {
          select: { enrollments: true, chatMessages: true },
        },
      },
    });
  }

  async listMessages(courseId, limit = 100) {
    return prisma.classroomMessage.findMany({
      where: { courseId },
      include: {
        sender: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async createMessage(data) {
    return prisma.classroomMessage.create({
      data,
      include: {
        sender: true,
      },
    });
  }
}

module.exports = new ClassroomChatRepository();
