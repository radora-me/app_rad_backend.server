const repo = require('./attendance.repository')

const {
  calculatePercentage
} = require('./helpers/attendanceCalculator')

const {
  getEligibilityStatus
} = require('./helpers/attendanceAnalytics')

class AttendanceService {

  async overview(studentId) {

    const records = await repo.getStudentAttendance(
      studentId
    )

    const total = records.length

    const present = records.filter(
      r => r.status === 'PRESENT'
    ).length

    const percentage = calculatePercentage(
      present,
      total
    )

    const eligibility = getEligibilityStatus(
      percentage
    )

    return {

      overallAttendance: percentage,

      eligibility,

      totalClasses: total,

      presentClasses: present,

      absentClasses: total - present,

      records
    }
  }

  async applyLeave(studentId, data) {

    return repo.createLeave({

      studentId,

      fromDate: new Date(data.fromDate),

      toDate: new Date(data.toDate),

      reason: data.reason
    })
  }

  async leaveHistory(studentId) {

    return repo.getLeaveHistory(studentId)
  }
}

module.exports = new AttendanceService()