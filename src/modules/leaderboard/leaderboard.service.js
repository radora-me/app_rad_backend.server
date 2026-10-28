const prisma = require("../../core/database/prisma");

const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const isInternalId = (value) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value)));
const safeLabel = (value, fallback = "Unassigned class") => value && !isInternalId(value) ? String(value).trim() : fallback;

function badgeFor(rating, hasScores) {
  if (!hasScores) return { key: "UNRATED", label: "Not rated", description: "No graded test or homework records yet." };
  if (rating >= 9.5) return { key: "TOP_PERFORMER", label: "Top Performer", description: "Exceptional and consistent performance." };
  if (rating >= 8.5) return { key: "EXCELLENCE", label: "Excellence", description: "Outstanding academic performance." };
  if (rating >= 7) return { key: "STRONG_PERFORMER", label: "Strong Performer", description: "Consistently above the class standard." };
  if (rating >= 5) return { key: "RISING_STAR", label: "Rising Star", description: "Showing solid progress." };
  return { key: "NEEDS_SUPPORT", label: "Needs Support", description: "Additional support and practice recommended." };
}

function percentage(score, total) { return total > 0 && score !== null && score !== undefined ? round((score / total) * 100) : null; }

function monthLabel(value) {
  return new Date(value).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

class LeaderboardService {
  async canAccessCourse(userId, role, courseId) {
    if (role === "admin") return prisma.course.findUnique({ where: { id: courseId } });
    const owned = await prisma.course.findFirst({ where: { id: courseId, teacherId: userId } });
    if (owned) return owned;
    const ownedCount = await prisma.course.count({ where: { teacherId: userId } });
    if (ownedCount === 0) return prisma.course.findUnique({ where: { id: courseId } });
    const access = await prisma.teacherCourseAccess.findUnique({ where: { teacherId_courseId: { teacherId: userId, courseId } }, include: { course: true } });
    return access?.course || null;
  }

  async listCourses(userId, role) {
    const where = role === "admin" ? {} : role === "student" ? { enrollments: { some: { studentId: userId } } } : { OR: [{ teacherId: userId }, { subjectTeacherAccess: { some: { teacherId: userId } } }] };
    const courses = await prisma.course.findMany({ where, include: { _count: { select: { enrollments: true } } }, orderBy: { title: "asc" } });
    return courses.map((course) => ({ id: course.id, title: safeLabel(course.title), section: course.description && !isInternalId(course.description) ? course.description : "", studentCount: course._count.enrollments }));
  }

  async buildCourse(courseId, { viewerId = null, viewerRole = "admin" } = {}) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { enrollments: { include: { student: { select: { id: true, name: true, rollNumber: true, profilePhotoUrl: true } } } } },
    });
    if (!course) throw new Error("Class not found");
    if (viewerRole === "student" && !course.enrollments.some((item) => item.studentId === viewerId)) throw new Error("You are not enrolled in this class");

    const studentIds = course.enrollments.map((item) => item.studentId);
    const [tests, homework] = await Promise.all([
      prisma.proctoredTest.findMany({ where: { courseId, status: { not: "DRAFT" } }, include: { questions: { select: { marks: true } }, attempts: { where: { studentId: { in: studentIds }, status: { in: ["SUBMITTED", "AUTO_SUBMITTED", "GRADED"] } }, select: { studentId: true, score: true, teacherMarks: true, submittedAt: true, status: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.homework.findMany({ where: { courseId, status: { not: "DRAFT" } }, select: { title: true, totalMarks: true, createdAt: true, submissions: { where: { studentId: { in: studentIds }, status: "GRADED", marks: { not: null } }, select: { studentId: true, marks: true, submittedAt: true, gradedAt: true, feedback: true } } }, orderBy: { createdAt: "asc" } }),
    ]);

    const testTotal = (test) => test.questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);
    const records = new Map(studentIds.map((id) => [id, { tests: [], homework: [] }]));
    const trendRecords = [];
    for (const test of tests) {
      const total = testTotal(test);
      for (const attempt of test.attempts) {
        const score = attempt.teacherMarks ?? attempt.score;
        const item = { type: "test", title: test.title, score, total, percentage: percentage(score, total), date: attempt.submittedAt, status: attempt.status };
        records.get(attempt.studentId)?.tests.push(item);
        if (item.percentage !== null) trendRecords.push(item);
      }
    }
    for (const assignment of homework) {
      const total = Number(assignment.totalMarks || 0);
      for (const submission of assignment.submissions) {
        const item = { type: "homework", title: assignment.title, score: submission.marks, total, percentage: percentage(submission.marks, total), date: submission.gradedAt || submission.submittedAt, feedback: submission.feedback || null };
        records.get(submission.studentId)?.homework.push(item);
        if (item.percentage !== null) trendRecords.push(item);
      }
    }

    const rows = course.enrollments.map((enrollment) => {
      const source = records.get(enrollment.studentId) || { tests: [], homework: [] };
      const testPercentages = source.tests.map((item) => item.percentage).filter((item) => item !== null);
      const homeworkPercentages = source.homework.map((item) => item.percentage).filter((item) => item !== null);
      const testAverage = average(testPercentages); const homeworkAverage = average(homeworkPercentages);
      const categoryAverages = [testAverage, homeworkAverage].filter((item) => item !== null);
      const overallPercentage = average(categoryAverages);
      const rating = overallPercentage === null ? 0 : round(overallPercentage / 10);
      return { _studentId: enrollment.studentId, rank: 0, student: { name: enrollment.student.name, rollNumber: enrollment.student.rollNumber, profilePhotoUrl: enrollment.student.profilePhotoUrl }, rating, overallPercentage: overallPercentage === null ? null : round(overallPercentage), testPercentage: testAverage === null ? null : round(testAverage), homeworkPercentage: homeworkAverage === null ? null : round(homeworkAverage), testsScored: source.tests.length, homeworkScored: source.homework.length, badge: badgeFor(rating, categoryAverages.length > 0), rawScores: { tests: source.tests, homework: source.homework } };
    }).sort((a, b) => b.rating - a.rating || (b.overallPercentage || 0) - (a.overallPercentage || 0) || a.student.name.localeCompare(b.student.name));
    rows.forEach((row, index) => { row.rank = index + 1; });

    const rated = rows.filter((row) => row.overallPercentage !== null);
    const distribution = [
      { label: "0–4.9", count: rows.filter((row) => row.rating > 0 && row.rating < 5).length },
      { label: "5–6.9", count: rows.filter((row) => row.rating >= 5 && row.rating < 7).length },
      { label: "7–8.4", count: rows.filter((row) => row.rating >= 7 && row.rating < 8.5).length },
      { label: "8.5–9.4", count: rows.filter((row) => row.rating >= 8.5 && row.rating < 9.5).length },
      { label: "9.5–10", count: rows.filter((row) => row.rating >= 9.5).length },
    ];
    const groupedTrend = new Map();
    trendRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach((item) => { const key = monthLabel(item.date); const current = groupedTrend.get(key) || []; current.push(item.percentage); groupedTrend.set(key, current); });
    const performanceTrend = [...groupedTrend.entries()].map(([label, values]) => ({ label, averagePercentage: round(average(values)), averageRating: round(average(values) / 10), scoredRecords: values.length }));
    const result = { course: { id: course.id, title: safeLabel(course.title), section: course.description && !isInternalId(course.description) ? course.description : "" }, generatedAt: new Date().toISOString(), leaderboard: rows, analysis: { studentCount: rows.length, ratedStudents: rated.length, unratedStudents: rows.length - rated.length, averageRating: round(average(rated.map((row) => row.rating)) || 0), averagePercentage: round(average(rated.map((row) => row.overallPercentage)) || 0), topRating: rated[0]?.rating || 0, distribution, performanceTrend, scoredTests: rows.reduce((sum, row) => sum + row.testsScored, 0), scoredHomework: rows.reduce((sum, row) => sum + row.homeworkScored, 0) } };
    result.leaderboard = rows.map((row) => {
      const { _studentId, ...publicRow } = row;
      return viewerRole === "student" && _studentId !== viewerId ? { ...publicRow, rawScores: undefined } : publicRow;
    });
    return result;
  }

  toStudentPayload(data) {
    return {
      course: data.course,
      generatedAt: data.generatedAt,
      leaderboard: data.leaderboard.map((row) => ({
        rank: row.rank,
        student: { name: row.student.name },
        rating: row.rating,
        badge: row.badge,
      })),
    };
  }

  async getTeacherOverview(userId) {
    const courses = await this.listCourses(userId, "teacher");
    const summaries = await Promise.all(courses.map(async (course) => { const data = await this.buildCourse(course.id, { viewerId: userId, viewerRole: "teacher" }); return { ...course, averageRating: data.analysis.averageRating, averagePercentage: data.analysis.averagePercentage, ratedStudents: data.analysis.ratedStudents, distribution: data.analysis.distribution, performanceTrend: data.analysis.performanceTrend }; }));
    return { courses: summaries };
  }

  async getAdminOverview() {
    const courses = await this.listCourses(null, "admin");
    const summaries = await Promise.all(courses.map(async (course) => { const data = await this.buildCourse(course.id); return { ...course, averageRating: data.analysis.averageRating, averagePercentage: data.analysis.averagePercentage, ratedStudents: data.analysis.ratedStudents, distribution: data.analysis.distribution, performanceTrend: data.analysis.performanceTrend }; }));
    return { courses: summaries };
  }
}

module.exports = new LeaderboardService();
