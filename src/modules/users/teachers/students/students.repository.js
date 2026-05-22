const prisma = require("../../../../core/database/prisma");

class TeacherStudentsRepository {
  async _updateStudentClass(tx, studentId, className) {
    try {
      return await tx.user.update({
        where: { id: studentId },
        data: { className },
      });
    } catch (error) {
      const message = error?.message || "";

      // Compatibility fallback for environments running an older Prisma client
      // where the field is still named `class`.
      if (message.includes("Unknown argument `className`")) {
        return tx.user.update({
          where: { id: studentId },
          data: { class: className },
        });
      }

      throw error;
    }
  }

  async findStudentByRollNumber(rollNumber) {
    return prisma.user.findUnique({
      where: { rollNumber },
      include: {
        enrollments: {
          include: {
            course: true,
          },
        },
      },
    });
  }

  async findStudentsByTeacher(teacherId) {
    return prisma.user.findMany({
      where: {
        role: "student",
        enrollments: {
          some: {
            course: {
              teacherId,
            },
          },
        },
      },
      include: {
        enrollments: {
          include: {
            course: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  async findTeacherCourses(teacherId, courseIds) {
    return prisma.course.findMany({
      where: {
        id: { in: courseIds },
        teacherId,
      },
    });
  }

  async syncStudentCourses({ studentId, teacherId, className, courseIds }) {
    const safeCourseIds = Array.isArray(courseIds) ? courseIds : [];

    return prisma.$transaction(async (tx) => {
      const teacherCourses = await tx.course.findMany({
        where: {
          id: { in: safeCourseIds },
          teacherId,
        },
        select: { id: true },
      });

      if (teacherCourses.length !== safeCourseIds.length) {
        throw new Error(
          "One or more selected courses do not belong to this teacher",
        );
      }

      await this._updateStudentClass(tx, studentId, className);

      const teacherCourseIds = teacherCourses.map((course) => course.id);

      await tx.enrollment.deleteMany({
        where: {
          studentId,
          courseId: {
            in: teacherCourseIds.filter(
              (courseId) => !safeCourseIds.includes(courseId),
            ),
          },
        },
      });

      if (safeCourseIds.length > 0) {
        await tx.enrollment.createMany({
          data: safeCourseIds.map((courseId) => ({ studentId, courseId })),
          skipDuplicates: true,
        });
      }

      return tx.user.findUnique({
        where: { id: studentId },
        include: {
          enrollments: {
            include: {
              course: true,
            },
          },
        },
      });
    });
  }
}

module.exports = new TeacherStudentsRepository();
