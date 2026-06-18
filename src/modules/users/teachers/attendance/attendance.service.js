const repo = require("./attendance.repository");

class AttendanceService {
  _normalizeToLocalDay(dateInput) {
    if (dateInput instanceof Date) {
      return new Date(
        dateInput.getFullYear(),
        dateInput.getMonth(),
        dateInput.getDate(),
      );
    }

    if (
      typeof dateInput === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
    ) {
      const [year, month, day] = dateInput.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    const date = new Date(dateInput);

    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  _ensureTodayOnly(dateInput) {
    const normalizedDate = this._normalizeToLocalDay(dateInput);
    const today = repo.getTodayNormalized();

    if (!repo.isSameNormalizedDate(normalizedDate, today)) {
      throw new Error("Attendance can only be marked for today");
    }

    return normalizedDate;
  }

  _ensureNotSunday(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

    if (date.getDay() === 0) {
      throw new Error("Attendance cannot be marked on Sundays");
    }
  }

  async _ensureNotHoliday(dateInput) {
    const holiday = await repo.getHolidayByDate(dateInput);

    if (holiday) {
      throw new Error(`Attendance is not allowed on holidays: ${holiday.name}`);
    }
  }

  async markFullDayAttendance(teacherId, data) {
    const courseId = data.courseId || null;
    const normalizedDate = this._ensureTodayOnly(data.date);
    const allowEdit = Boolean(data.allowEdit);

    this._ensureNotSunday(normalizedDate);
    await this._ensureNotHoliday(normalizedDate);

    if (courseId) {
      const validCourse = await repo.verifyTeacherCourse(courseId, teacherId);

      if (!validCourse) {
        throw new Error("Unauthorized course access");
      }
    }

    const studentIds = data.students.map((student) => student.studentId);
    const existingAttendance = await repo.getAttendanceByCourseAndStudents(
      courseId,
      normalizedDate,
      studentIds,
    );

    if (existingAttendance.length > 0 && !allowEdit) {
      throw new Error("Attendance already marked. Use edit mode.");
    }

    const lockedStudentIds = existingAttendance
      .filter((record) => !repo.isWithinEditWindow(record.createdAt))
      .map((record) => record.studentId);

    if (lockedStudentIds.length > 0) {
      throw new Error("Attendance can only be edited within 48 hours");
    }

    const promises = data.students.map((student) => {
      return repo.upsertAttendance({
        studentId: student.studentId,

        courseId,

        date: normalizedDate,

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

    const normalizedDate = this._ensureTodayOnly(data.date);
    const allowEdit = Boolean(data.allowEdit);

    this._ensureNotSunday(normalizedDate);
    await this._ensureNotHoliday(normalizedDate);

    if (!validCourse) {
      throw new Error("Unauthorized course access");
    }

    const studentIds = data.students.map((student) => student.studentId);
    const existingAttendance = await repo.getAttendanceByCourseAndStudents(
      data.courseId,
      normalizedDate,
      studentIds,
    );

    if (existingAttendance.length > 0 && !allowEdit) {
      throw new Error("Attendance already marked. Use edit mode.");
    }

    const lockedStudentIds = existingAttendance
      .filter((record) => !repo.isWithinEditWindow(record.createdAt))
      .map((record) => record.studentId);

    if (lockedStudentIds.length > 0) {
      throw new Error("Attendance can only be edited within 48 hours");
    }

    const promises = data.students.map((student) => {
      return repo.upsertAttendance({
        studentId: student.studentId,

        courseId: data.courseId,

        date: normalizedDate,

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

  async getHolidays() {
    return repo.listHolidays();
  }

  async getStudentAttendance(courseId, rollNumber, date) {
    const enrollment = await repo.getCourseStudentByRollNumber(
      courseId,
      rollNumber,
    );

    if (!enrollment) {
      throw new Error("Student not found in this class");
    }

    const attendance = await repo.getStudentAttendanceByRollNumber(
      courseId,
      rollNumber,
      date,
    );

    return {
      studentId: enrollment.student.id,
      name: enrollment.student.name,
      rollNumber: enrollment.student.rollNumber,
      courseId: enrollment.course.id,
      courseTitle: enrollment.course.title,
      date,
      status: attendance?.status || "PRESENT",
      isMarked: Boolean(attendance),
      canEdit: attendance
        ? repo.isWithinEditWindow(attendance.createdAt)
        : false,
      createdAt: attendance?.createdAt || null,
    };
  }

  async updateStudentAttendance(teacherId, courseId, rollNumber, data) {
    const validCourse = await repo.verifyTeacherCourse(courseId, teacherId);

    if (!validCourse) {
      throw new Error("Unauthorized course access");
    }

    const enrollment = await repo.getCourseStudentByRollNumber(
      courseId,
      rollNumber,
    );

    if (!enrollment) {
      throw new Error("Student not found in this class");
    }

    const attendance = await repo.getStudentAttendanceByRollNumber(
      courseId,
      rollNumber,
      data.date,
    );

    this._ensureNotSunday(data.date);
    await this._ensureNotHoliday(data.date);

    if (!attendance) {
      throw new Error("Attendance record not found for selected date");
    }

    if (!repo.isWithinEditWindow(attendance.createdAt)) {
      throw new Error("Attendance can only be edited within 48 hours");
    }

    const updated = await repo.upsertAttendance({
      studentId: enrollment.student.id,
      courseId,
      date: data.date,
      mode: attendance.mode,
      status: data.status,
      markedBy: teacherId,
    });

    return {
      message: "Attendance updated successfully",
      attendance: updated,
    };
  }

  async getCourseAttendance(courseId, date) {
    const students = await repo.getCourseStudents(courseId);
    const attendance = await repo.getCourseAttendance(courseId, date);

    const statusByStudentId = new Map(
      attendance.map((record) => [record.studentId, record]),
    );

    const canEdit = attendance.some((record) =>
      repo.isWithinEditWindow(record.createdAt),
    );

    return students.map((enrollment) => {
      const statusRecord = statusByStudentId.get(enrollment.studentId);

      return {
        studentId: enrollment.student.id,
        name: enrollment.student.name,
        rollNumber: enrollment.student.rollNumber,
        status: statusRecord?.status || "PRESENT",
        isMarked: Boolean(statusRecord),
        canEdit: Boolean(statusRecord) && canEdit,
        createdAt: statusRecord?.createdAt || null,
      };
    });
  }
}

module.exports = new AttendanceService();
