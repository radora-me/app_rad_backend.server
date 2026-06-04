const repo = require("./attendance.repository");

const {
  buildAttendanceSummary,
  getEligibilityStatus,
} = require("./helpers/attendanceAnalytics");

class AttendanceService {
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

      records: summary.records,
      holidays: holidays.map((holiday) => ({
        id: holiday.id,
        title: holiday.title,
        date: holiday.date,
      })),
    };
  }

  async applyLeave(studentId, data) {
    return repo.createLeave({
      studentId,

      fromDate: new Date(data.fromDate),

      toDate: new Date(data.toDate),

      reason: data.reason,
    });
  }

  async leaveHistory(studentId) {
    return repo.getLeaveHistory(studentId);
  }
}

module.exports = new AttendanceService();
