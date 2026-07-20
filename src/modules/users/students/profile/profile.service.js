const repo = require("./profile.repository");

const attendanceRepo = require("../attendance/attendance.repository");

const {
  buildAttendanceSummary,
} = require("../attendance/helpers/attendanceAnalytics");

class StudentProfileService {
  _computeAttendance(attendanceRecords, holidays = []) {
    if (!attendanceRecords || attendanceRecords.length === 0) {
      return { percentage: 0, streak: 0 };
    }

    const summary = buildAttendanceSummary(attendanceRecords, holidays);

    return {
      percentage: summary.overallAttendance,
      streak: summary.streak,
    };
  }

  _toProfile(user, holidays = []) {
    if (!user) return null;

    const { percentage, streak } = this._computeAttendance(
      user.attendanceRecords || [],
      holidays,
    );

    const sp = user.studentProfile || {};

    return {
      id: user.id,
      name: user.name,
      rollNumber: user.rollNumber,
      className: user.className || user.enrollments?.[0]?.course?.title || "",
      section: user.section || user.enrollments?.[0]?.course?.description || "",
      profilePhotoUrl: user.profilePhotoUrl || null,
      attendancePercentage: percentage,
      streak,
      courses: (user.enrollments || []).map((enrollment) => ({
        id: enrollment.course.id,
        title: enrollment.course.title,
        description: enrollment.course.description,
      })),
      address: sp.address || null,
      city: sp.city || null,
      state: sp.state || null,
      pincode: sp.pincode || null,
      parentName: sp.parentName || null,
      parentEmail: sp.parentEmail || null,
      parentPhone: sp.parentPhone || null,
      parentRelation: sp.parentRelation || null,
      dateOfBirth: sp.dateOfBirth || null,
      bloodGroup: sp.bloodGroup || null,
      emergencyPhone: sp.emergencyPhone || null,
    };
  }

  async getProfile(studentId) {
    const user = await repo.findById(studentId);
    if (!user || user.role !== "student") throw new Error("Student not found");

    const holidays = await attendanceRepo.getHolidays();

    return this._toProfile(user, holidays);
  }

  async getDashboard(studentId) {
    const profile = await this.getProfile(studentId);

    return {
      studentName: profile.name,
      attendancePercentage: profile.attendancePercentage,
      streak: profile.streak,
      level: {
        level: 1,
        title: "Initiate",
        xpToNext: 100,
        progress: 0,
      },
      fees: {
        status: "PENDING",
        amount: 0,
        academicYear: new Date().getFullYear().toString(),
      },
      upcomingClasses: [],
      badges: [],
      aiTutor: {
        subject: "",
        summary: "",
      },
    };
  }
}

module.exports = new StudentProfileService();
