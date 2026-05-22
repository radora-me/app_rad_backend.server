const repo = require("./attendance.repository");

class AttendanceService {
  async markFullDayAttendance(teacherId, data) {
    const courseId = data.courseId || null;

    if (courseId) {
      const validCourse = await repo.verifyTeacherCourse(courseId, teacherId);

      if (!validCourse) {
        throw new Error("Unauthorized course access");
      }
    }

    const promises = data.students.map((student) => {
      return repo.upsertAttendance({
        studentId: student.studentId,

        courseId,

        date: new Date(data.date),

        mode: "FULL_DAY",

        status: student.status,

        markedBy: teacherId,
      });
    });

    await Promise.all(promises);

    return {
      message: "Full day attendance marked successfully",
    };
  }

  async markSubjectWiseAttendance(teacherId, data) {
    const validCourse = await repo.verifyTeacherCourse(
      data.courseId,
      teacherId,
    );

    if (!validCourse) {
      throw new Error("Unauthorized course access");
    }

    const promises = data.students.map((student) => {
      return repo.upsertAttendance({
        studentId: student.studentId,

        courseId: data.courseId,

        date: new Date(data.date),

        mode: "SUBJECT_WISE",

        status: student.status,

        markedBy: teacherId,
      });
    });

    await Promise.all(promises);

    return {
      message: "Subject-wise attendance marked successfully",
    };
  }

  async getCourseStudents(courseId) {
    return repo.getCourseStudents(courseId);
  }

  async getCourseAttendance(courseId, date) {
    const students = await repo.getCourseStudents(courseId);
    const attendance = await repo.getCourseAttendance(courseId, date);

    const statusByStudentId = new Map(
      attendance.map((record) => [record.studentId, record]),
    );

    return students.map((enrollment) => {
      const statusRecord = statusByStudentId.get(enrollment.studentId);

      return {
        studentId: enrollment.student.id,
        name: enrollment.student.name,
        rollNumber: enrollment.student.rollNumber,
        status: statusRecord?.status || "PRESENT",
      };
    });
  }
}

module.exports = new AttendanceService();
