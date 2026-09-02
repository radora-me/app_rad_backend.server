const prisma = require("../../core/database/prisma");

class HomeworkRepository {
  async isSubjectTeacher(teacherId) {
    const count = await prisma.course.count({ where: { teacherId } });
    return count === 0;
  }

  async findTeacherCourse(teacherId, courseId) {
    const ownedCourse = await prisma.course.findFirst({
      where: {
        id: courseId,
        teacherId,
      },
    });
    if (ownedCourse) return ownedCourse;

    if (await this.isSubjectTeacher(teacherId)) {
      return prisma.course.findUnique({ where: { id: courseId } });
    }
    return null;
  }

  create(data) {
    return prisma.homework.create({
      data,
      include: this.include(),
    });
  }

  update(homeworkId, data) {
    return prisma.homework.update({
      where: {
        id: homeworkId,
      },
      data,
      include: this.include(),
    });
  }

  delete(homeworkId) {
    return prisma.homework.delete({
      where: {
        id: homeworkId,
      },
    });
  }

  listForTeacher(teacherId) {
    return this.isSubjectTeacher(teacherId).then((isSubjectTeacher) => prisma.homework.findMany({
      where: isSubjectTeacher ? {} : { teacherId },
      include: this.include(),
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
    }));
  }

  listForStudent(studentId) {
    return prisma.homework.findMany({
      where: {
        course: {
          enrollments: {
            some: {
              studentId,
            },
          },
        },
        status: "PUBLISHED",
      },
      include: this.include(),
      orderBy: [
        {
          dueAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });
  }

  findById(homeworkId) {
    return prisma.homework.findUnique({
      where: {
        id: homeworkId,
      },
      include: this.include(),
    });
  }

  async findAccessibleForTeacher(teacherId, homeworkId) {
    const isSubjectTeacher = await this.isSubjectTeacher(teacherId);
    return prisma.homework.findFirst({
      where: {
        id: homeworkId,
        ...(isSubjectTeacher ? {} : { teacherId }),
      },
      include: this.include(),
    });
  }

  findAccessibleForStudent(studentId, homeworkId) {
    return prisma.homework.findFirst({
      where: {
        id: homeworkId,
        status: "PUBLISHED",
        course: {
          enrollments: {
            some: {
              studentId,
            },
          },
        },
      },
      include: this.include(),
    });
  }

  async findHomeworkWithRosterForTeacher(teacherId, homeworkId) {
    const isSubjectTeacher = await this.isSubjectTeacher(teacherId);
    return prisma.homework.findFirst({
      where: {
        id: homeworkId,
        ...(isSubjectTeacher ? {} : { teacherId }),
      },
      include: this.includeWithRoster(),
    });
  }

  async findSubmissionForTeacher(teacherId, homeworkId, studentId) {
    const isSubjectTeacher = await this.isSubjectTeacher(teacherId);
    return prisma.homeworkSubmission.findFirst({
      where: {
        homeworkId,
        studentId,
        homework: {
          ...(isSubjectTeacher ? {} : { teacherId }),
        },
      },
      include: this.submissionInclude(),
    });
  }

  findSubmissionForStudent(studentId, homeworkId) {
    return prisma.homeworkSubmission.findFirst({
      where: {
        homeworkId,
        studentId,
      },
      include: this.submissionInclude(),
    });
  }

  createFile(data) {
    return prisma.file.create({
      data,
    });
  }

  createHomeworkAttachment(data) {
    return prisma.homeworkAttachment.create({
      data,
    });
  }

  deleteHomeworkAttachments(homeworkId) {
    return prisma.homeworkAttachment.deleteMany({
      where: {
        homeworkId,
      },
    });
  }

  include() {
    return {
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },

      course: {
        select: {
          id: true,
          title: true,
          description: true,
        },
      },

      attachments: {
        include: {
          file: true,
        },
      },

      submissions: {
        include: this.submissionInclude(),
      },
    };
  }

  includeWithRoster() {
    return {
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      course: {
        select: {
          id: true,
          title: true,
          description: true,
          enrollments: {
            select: {
              createdAt: true,
              student: {
                select: {
                  id: true,
                  name: true,
                  rollNumber: true,
                  className: true,
                  profilePhotoUrl: true,
                },
              },
            },
            orderBy: [
              {
                student: {
                  rollNumber: "asc",
                },
              },
              {
                student: {
                  name: "asc",
                },
              },
            ],
          },
        },
      },
      attachments: {
        include: {
          file: true,
        },
      },
      submissions: {
        include: this.submissionInclude(),
      },
    };
  }

  submissionInclude() {
    return {
      student: {
        select: {
          id: true,
          name: true,
          rollNumber: true,
          className: true,
          profilePhotoUrl: true,
        },
      },
      gradedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      attachments: {
        include: {
          file: true,
        },
      },
    };
  }

  transaction(callback) {
    return prisma.$transaction(callback);
  }
}

module.exports = new HomeworkRepository();
