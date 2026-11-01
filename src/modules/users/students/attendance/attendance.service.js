const repo = require("./attendance.repository");

const {
  buildAttendanceSummary,
  getEligibilityStatus,
} = require("./helpers/attendanceAnalytics");

class AttendanceService {
  _toAttendancePayload(record) {
    return {
      date: record.date,
      status: record.status,
      mode: record.mode,
      course: record.course
        ? {
            courseId: record.course.id,
            className: record.course.title,
            section: record.course.description || "",
          }
        : null,
    };
  }

  _toLeavePayload(leave) {
    return {
      fromDate: leave.fromDate,
      toDate: leave.toDate,
      reason: leave.reason,
      status: leave.status,
    };
  }

  async overview(studentId) {
    const records = await repo.getStudentAttendance(studentId);
    const holidays = await repo.getHolidays();

    const summary = buildAttendanceSummary(records, holidays);

    const eligibility = getEligibilityStatus(summary.overallAttendance);

    return {
      overallAttendance: summary.overallAttendance,

      eligibility,

      totalClasses: summary.totalClasses,

      attendedClasses: summary.attendedClasses,

      presentClasses: summary.presentClasses,

      absentClasses: summary.absentClasses,

      leaveClasses: summary.leaveClasses,

      records: summary.records.map((record) => this._toAttendancePayload(record)),
      holidays: holidays.map((holiday) => ({
        title: holiday.title,
        date: holiday.date,
      })),
    };
  }

  async applyLeave(studentId, data) {
    const leave = await repo.createLeave({
      studentId,

      fromDate: new Date(data.fromDate),

      toDate: new Date(data.toDate),

      reason: data.reason,
    });
    return this._toLeavePayload(leave);
  }

  async leaveHistory(studentId) {
    const leaves = await repo.getLeaveHistory(studentId);
    return leaves.map((leave) => this._toLeavePayload(leave));
  }
}

module.exports = new AttendanceService();
