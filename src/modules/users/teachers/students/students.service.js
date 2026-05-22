const repo = require("./students.repository");

class TeacherStudentsService {
  _toStudentPayload(user) {
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      rollNumber: user.rollNumber,
      className: user.className || user.class || "",
      profilePhotoUrl: user.profilePhotoUrl || null,
      courses: (user.enrollments || []).map((enrollment) => ({
        id: enrollment.course.id,
        title: enrollment.course.title,
        description: enrollment.course.description,
      })),
    };
  }

  async findByRollNumber(teacherId, rollNumber) {
    const student = await repo.findStudentByRollNumber(rollNumber);

    if (!student || student.role !== "student") {
      throw new Error("Student not found");
    }

    return this._toStudentPayload(student);
  }

  async list(teacherId) {
    const students = await repo.findStudentsByTeacher(teacherId);

    return students.map((student) => {
      const teacherCourses = student.enrollments
        .filter((enrollment) => enrollment.course.teacherId === teacherId)
        .map((enrollment) => ({
          id: enrollment.course.id,
          title: enrollment.course.title,
          description: enrollment.course.description,
        }));

      return {
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        className: student.className || student.class || "",
        profilePhotoUrl: student.profilePhotoUrl || null,
        courses: teacherCourses,
        addedAt: student.createdAt,
      };
    });
  }

  async upsertStudent(teacherId, rollNumber, data) {
    const student = await repo.findStudentByRollNumber(rollNumber);

    if (!student || student.role !== "student") {
      throw new Error("Student not found");
    }

    const updated = await repo.syncStudentCourses({
      studentId: student.id,
      teacherId,
      className: data.className,
      courseIds: Array.isArray(data.courseIds) ? data.courseIds : [],
    });

    return this._toStudentPayload(updated);
  }
}

module.exports = new TeacherStudentsService();
