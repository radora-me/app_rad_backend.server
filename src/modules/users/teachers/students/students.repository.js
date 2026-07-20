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
        enrollments: { include: { course: true } },
        studentProfile: true,
      },
    });
  }

  async findStudentsByTeacher(teacherId) {
    return prisma.user.findMany({
      where: {
        role: "student",
        enrollments: { some: { course: { teacherId } } },
      },
      include: {
        enrollments: { include: { course: true } },
        studentProfile: true,
      },
      orderBy: { name: "asc" },
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

  async upsertStudentProfile(studentId, data) {
    return prisma.studentProfile.upsert({
      where: { userId: studentId },
      create: { userId: studentId, ...data },
      update: { ...data },
    });
  }

  async syncStudentCourses({ studentId, teacherId, courseIds }) {
    const safeCourseIds = Array.isArray(courseIds) ? courseIds : [];

    if (safeCourseIds.length !== 1) {
      throw new Error("Select exactly one assigned class.");
    }

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

      const selectedCourse = teacherCourses[0];

      // Check if student is already enrolled in a different class
      const existingEnrollments = await tx.enrollment.findMany({
        where: {
          studentId,
        },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              teacherId: true,
            },
          },
        },
      });

      const hasDifferentEnrollment = existingEnrollments.some(
        (enrollment) => enrollment.courseId !== selectedCourse.id,
      );

      if (hasDifferentEnrollment) {
        throw new Error(
          "Student is already assigned to a class and cannot be added to another one.",
        );
      }

      await this._updateStudentClass(tx, studentId, selectedCourse.title);

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
