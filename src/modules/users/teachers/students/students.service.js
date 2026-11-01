const repo = require("./students.repository");
const { uploadBuffer } = require("../../../../core/storage/cloudinary");
const { resolveClassName, safeClassName } = require("../../../../shared/utils/display-labels");

class TeacherStudentsService {
  _toStudentPayload(user) {
    if (!user) return null;

    const payload = {
      name: user.name,
      rollNumber: user.rollNumber,
      className: resolveClassName(user),
      profilePhotoUrl: user.profilePhotoUrl || null,
      courses: (user.enrollments || []).map((enrollment) => ({
        id: enrollment.course.id,
        title: safeClassName(enrollment.course.title),
        description: enrollment.course.description || "",
      })),
      studentProfile: this._toProfilePayload(user.studentProfile),
    };

    return payload;
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

  async list(teacherId, role) {
    const students = role === "admin"
      ? await repo.findAllStudents()
      : await repo.findStudentsByTeacher(teacherId);
    return students.map((student) => {
      const teacherCourses = student.enrollments
        .filter((enrollment) => role === "admin" || enrollment.course.teacherId === teacherId)
        .map((enrollment) => ({
          id: enrollment.course.id,
          title: safeClassName(enrollment.course.title),
          description: enrollment.course.description || "",
        }));
      return {
        name: student.name,
        rollNumber: student.rollNumber,
        className: teacherCourses[0]?.title || resolveClassName(student),
        profilePhotoUrl: student.profilePhotoUrl || null,
        courses: teacherCourses,
        studentProfile: this._toProfilePayload(student.studentProfile),
      };
    });
  }

  async upsertStudent(teacherId, rollNumber, data, role = "teacher") {
    const student = await repo.findStudentByRollNumber(rollNumber);
    if (!student || student.role !== "student") throw new Error("Student not found");
    const updated = await repo.syncStudentCourses({
      studentId: student.id,
      teacherId,
      courseIds: Array.isArray(data.courseIds) ? data.courseIds : [],
      role,
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

  async uploadStudentPhoto(teacherId, rollNumber, file, role = "teacher") {
    if (!file) throw new Error("Profile photo is required");
    const student = role === "admin"
      ? await repo.findStudentByRollNumber(rollNumber)
      : await repo.findStudentByRollNumberForTeacher(teacherId, rollNumber);
    if (!student || student.role !== "student") throw new Error("Student not found");
    const upload = await uploadBuffer(file.buffer, {
      folder: "radora/profile-photos/students",
      public_id: student.id,
      resource_type: "image",
      overwrite: true,
      invalidate: true,
    });
    const updated = await repo.updateStudentPhoto(student.id, upload.secure_url);
    return this._toStudentPayload({ ...student, profilePhotoUrl: updated.profilePhotoUrl });
  }
}

module.exports = new TeacherStudentsService();
