const repo = require("./profile.repository");

class StudentProfileService {
  _computeAttendance(attendanceRecords) {
    if (!attendanceRecords || attendanceRecords.length === 0) {
      return { percentage: 0, streak: 0 };
    }

    const total = attendanceRecords.length;
    const present = attendanceRecords.filter(
      (record) => record.status === "PRESENT",
    ).length;

    const sorted = [...attendanceRecords].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
    let streak = 0;

    for (const record of sorted) {
      if (record.status !== "PRESENT") break;
      streak += 1;
    }

    return {
      percentage: Math.round((present / total) * 100),
      streak,
    };
  }

  _toProfile(user) {
    if (!user) return null;

    const { percentage, streak } = this._computeAttendance(
      user.attendanceRecords || [],
    );

    return {
      id: user.id,
      name: user.name,
      rollNumber: user.rollNumber,
      className: user.className || "",
      profilePhotoUrl: user.profilePhotoUrl || null,
      attendancePercentage: percentage,
      streak,
      courses: (user.enrollments || []).map((enrollment) => ({
        id: enrollment.course.id,
        title: enrollment.course.title,
        description: enrollment.course.description,
      })),
    };
  }

  async getProfile(studentId) {
    const user = await repo.findById(studentId);
    if (!user || user.role !== "student") throw new Error("Student not found");

    return this._toProfile(user);
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
