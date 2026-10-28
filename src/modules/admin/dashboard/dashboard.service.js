const repo = require("./dashboard.repository");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

class AdminDashboardService {
  _monthKey(date) {
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }

  _gradeBucket(percentage) {
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B+";
    if (percentage >= 60) return "B";
    if (percentage >= 50) return "C";
    return "D";
  }

  async overview() {
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const data = await repo.getOverviewData(since, now);

    const months = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(since.getFullYear(), since.getMonth() + index, 1);
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        month: MONTHS[date.getMonth()],
        present: 0,
        absent: 0,
        leave: 0,
        total: 0,
      };
    });
    const monthMap = new Map(months.map((month) => [month.key, month]));

    for (const record of data.attendanceRecords) {
      const month = monthMap.get(this._monthKey(record.date));
      if (!month) continue;
      month.total += 1;
      if (record.status === "PRESENT") month.present += 1;
      if (record.status === "ABSENT") month.absent += 1;
      if (record.status === "LEAVE") month.leave += 1;
    }

    const attendanceTrend = months.map(({ key, month, present, absent, leave, total }) => ({
      month,
      attendance: total ? Number((((present + leave) / total) * 100).toFixed(1)) : 0,
      present,
      absent,
      leave,
      total,
      key,
    }));

    const totalAttendance = data.attendanceRecords.length;
    const attended = data.attendanceRecords.filter((record) => record.status === "PRESENT" || record.status === "LEAVE").length;
    const attendanceRate = totalAttendance ? Number(((attended / totalAttendance) * 100).toFixed(1)) : 0;

    const gradeCounts = new Map([["A+", 0], ["A", 0], ["B+", 0], ["B", 0], ["C", 0], ["D", 0]]);
    for (const submission of data.gradedSubmissions) {
      const totalMarks = submission.homework?.totalMarks;
      if (!totalMarks || submission.marks === null || submission.marks === undefined) continue;
      const percentage = (submission.marks / totalMarks) * 100;
      const bucket = this._gradeBucket(percentage);
      gradeCounts.set(bucket, (gradeCounts.get(bucket) || 0) + 1);
    }
    const gradeDistribution = [...gradeCounts.entries()].map(([grade, students]) => ({ grade, students }));

    const upcomingEvents = [
      ...data.holidays.map((item) => ({ id: item.id, title: item.title, date: item.date, type: "holiday", description: "School holiday" })),
      ...data.upcomingHomework.map((item) => ({ id: item.id, title: item.title, date: item.dueAt, type: "deadline", description: `${item.course.title}${item.course.description ? ` / ${item.course.description}` : ""}` })),
    ].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()).slice(0, 8);

    const markerMap = new Map(data.markers.map((marker) => [marker.id, marker.name]));
    const recentActivities = [
      ...data.recentHomework.map((item) => ({ id: `homework-${item.id}`, user: item.teacher.name, action: "created homework", target: `${item.title} — ${item.course.title}`, timestamp: item.createdAt })),
      ...data.recentAttendance.map((item) => ({ id: `attendance-${item.id}`, user: markerMap.get(item.markedBy) || "Teacher", action: `marked ${item.status.toLowerCase()} attendance`, target: item.course ? `${item.course.title}${item.course.description ? ` / ${item.course.description}` : ""}` : "Full day", timestamp: item.createdAt })),
    ].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()).slice(0, 8);

    return {
      stats: {
        studentCount: data.studentCount,
        teacherCount: data.teacherCount,
        attendanceRate,
        homeworkCount: data.homeworkCount,
        submissionCount: data.submissionCount,
        gradedSubmissionCount: data.gradedSubmissionCount,
      },
      attendanceTrend,
      gradeDistribution,
      upcomingEvents,
      recentActivities,
    };
  }
}

module.exports = new AdminDashboardService();
