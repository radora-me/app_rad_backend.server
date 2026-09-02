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
        courseId: enrollment.course.id,
        className: enrollment.course.title,
        section: enrollment.course.description || "",
      })),
      studentProfile: this._toProfilePayload(user.studentProfile),
    };
  }

  _toProfilePayload(profile) {
    if (!profile) return null;
    const {
      address, city, state, pincode, parentName, parentEmail,
      parentPhone, parentRelation, dateOfBirth, bloodGroup, emergencyPhone,
    } = profile;
    return {
      address, city, state, pincode, parentName, parentEmail,
      parentPhone, parentRelation, dateOfBirth, bloodGroup, emergencyPhone,
    };
  }

  async findByRollNumber(teacherId, rollNumber, role) {
    const student = role === "admin"
      ? await repo.findStudentByRollNumber(rollNumber)
      : await repo.findStudentByRollNumberForTeacher(teacherId, rollNumber);
    if (!student || student.role !== "student") throw new Error("Student not found");
    return this._toStudentPayload(student);
  }

  async list(teacherId) {
    const students = await repo.findStudentsByTeacher(teacherId);
    return students.map((student) => {
      const teacherCourses = student.enrollments
        .filter((enrollment) => enrollment.course.teacherId === teacherId)
        .map((enrollment) => ({
          courseId: enrollment.course.id,
          className: enrollment.course.title,
          section: enrollment.course.description || "",
        }));
      return {
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        className: student.className || student.class || "",
        profilePhotoUrl: student.profilePhotoUrl || null,
        courses: teacherCourses,
        studentProfile: this._toProfilePayload(student.studentProfile),
      };
    });
  }

  async upsertStudent(teacherId, rollNumber, data) {
    const student = await repo.findStudentByRollNumber(rollNumber);
    if (!student || student.role !== "student") throw new Error("Student not found");
    const updated = await repo.syncStudentCourses({
      studentId: student.id,
      teacherId,
      courseIds: Array.isArray(data.courseIds) ? data.courseIds : [],
    });
    return this._toStudentPayload(updated);
  }

  async updateStudentProfile(teacherId, rollNumber, data, role) {
    const student = role === "admin"
      ? await repo.findStudentByRollNumber(rollNumber)
      : await repo.findStudentByRollNumberForTeacher(teacherId, rollNumber);
    if (!student || student.role !== "student") throw new Error("Student not found");
    const updated = await repo.upsertStudentProfile(student.id, data);
    return this._toProfilePayload(updated);
  }

  async getFullProfile(teacherId, rollNumber, role) {
    const student = role === "admin"
      ? await repo.findStudentByRollNumber(rollNumber)
      : await repo.findStudentByRollNumberForTeacher(teacherId, rollNumber);
    if (!student || student.role !== "student") throw new Error("Student not found");
    return this._toStudentPayload(student);
  }
}

module.exports = new TeacherStudentsService();
