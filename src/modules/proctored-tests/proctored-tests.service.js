const prisma = require("../../core/database/prisma");

const testInclude = {
  course: { select: { id: true, title: true } },
  teacher: { select: { id: true, name: true } },
  questions: { orderBy: { order: "asc" } },
};

const attemptInclude = {
  test: {
    include: {
      course: { select: { id: true, title: true } },
      questions: { orderBy: { order: "asc" } },
    },
  },
  student: { select: { id: true, name: true, email: true, rollNumber: true, profilePhotoUrl: true } },
  answers: { include: { question: true }, orderBy: { question: { order: "asc" } } },
  gradedBy: { select: { name: true } },
};

const visibleQuestion = (question) => ({
  id: question.id,
  order: question.order,
  prompt: question.prompt,
  options: Array.isArray(question.options) ? question.options : [],
  marks: question.marks,
});

const safeDate = (value) => value ? new Date(value).toISOString() : null;

function totalMarks(test) {
  return (test.questions || []).reduce((sum, question) => sum + Number(question.marks || 0), 0);
}

function serializeTest(test, { includeAnswers = false, includeCorrect = false } = {}) {
  const questions = (test.questions || []).map((question) => ({
    ...(includeCorrect ? question : visibleQuestion(question)),
    ...(includeCorrect ? { options: Array.isArray(question.options) ? question.options : [] } : {}),
  }));
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    instructions: test.instructions,
    durationMinutes: test.durationMinutes,
    availableFrom: safeDate(test.availableFrom),
    dueAt: safeDate(test.dueAt),
    status: test.status,
    resultPublished: test.resultPublished,
    maxViolations: test.maxViolations,
    totalMarks: totalMarks(test),
    createdAt: safeDate(test.createdAt),
    course: test.course ? { id: test.course.id, title: test.course.title } : undefined,
    teacher: test.teacher ? { name: test.teacher.name } : undefined,
    questions,
    ...(includeAnswers ? { attemptAnswers: test.attemptAnswers || [] } : {}),
  };
}

function serializeAttempt(attempt, { student = false } = {}) {
  const test = attempt.test;
  const total = totalMarks(test);
  const finalMarks = attempt.teacherMarks ?? attempt.score;
  const questions = (test.questions || []).map((question) => ({
    ...visibleQuestion(question),
    ...(student ? {} : { correctOption: question.correctOption }),
    answer: (attempt.answers || []).find((answer) => answer.questionId === question.id)
      ? { selectedOption: (attempt.answers || []).find((answer) => answer.questionId === question.id).selectedOption, isCorrect: (attempt.answers || []).find((answer) => answer.questionId === question.id).isCorrect, marksAwarded: (attempt.answers || []).find((answer) => answer.questionId === question.id).marksAwarded }
      : null,
  }));
  return {
    id: attempt.id,
    status: attempt.status,
    startedAt: safeDate(attempt.startedAt),
    expiresAt: safeDate(attempt.expiresAt),
    submittedAt: safeDate(attempt.submittedAt),
    autoSubmittedAt: safeDate(attempt.autoSubmittedAt),
    score: attempt.score,
    teacherMarks: attempt.teacherMarks,
    finalMarks,
    totalMarks: total,
    percentage: finalMarks === null || finalMarks === undefined || !total ? null : Math.round((finalMarks / total) * 10000) / 100,
    teacherFeedback: attempt.teacherFeedback,
    violationCount: attempt.violationCount,
    student: attempt.student ? { name: attempt.student.name, email: attempt.student.email, rollNumber: attempt.student.rollNumber, profilePhotoUrl: attempt.student.profilePhotoUrl } : undefined,
    test: serializeTest(test, { includeCorrect: !student }),
    questions,
  };
}

class ProctoredTestsService {
  async teacherCanAccessCourse(teacherId, courseId) {
    const owned = await prisma.course.findFirst({ where: { id: courseId, teacherId } });
    if (owned) return owned;
    const hasOwnedCourse = await prisma.course.count({ where: { teacherId } });
    if (hasOwnedCourse === 0) return prisma.course.findUnique({ where: { id: courseId } });
    const access = await prisma.teacherCourseAccess.findUnique({ where: { teacherId_courseId: { teacherId, courseId } }, include: { course: true } });
    return access?.course || null;
  }

  async createTest(teacherId, data) {
    const course = await this.teacherCanAccessCourse(teacherId, data.courseId);
    if (!course) throw new Error("You are not authorized to create a test for this class");
    const test = await prisma.proctoredTest.create({
      data: {
        title: data.title, description: data.description || null, instructions: data.instructions || null,
        courseId: data.courseId, teacherId, durationMinutes: data.durationMinutes,
        availableFrom: data.availableFrom ? new Date(data.availableFrom) : null, dueAt: new Date(data.dueAt),
        maxViolations: data.maxViolations || 3, status: data.status || "DRAFT",
        questions: { create: data.questions.map((question, index) => ({ order: index + 1, prompt: question.prompt, options: question.options, correctOption: question.correctOption, marks: question.marks || 1 })) },
      }, include: testInclude,
    });
    return serializeTest(test, { includeCorrect: true });
  }

  async listForTeacher(teacherId) {
    const tests = await prisma.proctoredTest.findMany({ where: { teacherId }, include: testInclude, orderBy: { createdAt: "desc" } });
    return tests.map((test) => serializeTest(test, { includeCorrect: true }));
  }

  async getTeacherTest(teacherId, testId) {
    const test = await prisma.proctoredTest.findFirst({ where: { id: testId, teacherId }, include: testInclude });
    if (!test) throw new Error("Test not found");
    return serializeTest(test, { includeCorrect: true });
  }

  async updateTest(teacherId, testId, data) {
    const existing = await prisma.proctoredTest.findFirst({ where: { id: testId, teacherId }, include: { attempts: { take: 1 } } });
    if (!existing) throw new Error("Test not found");
    if (existing.status !== "DRAFT" || existing.attempts.length) throw new Error("Only an unused draft test can be edited");
    const update = { ...data };
    delete update.courseId;
    if (data.availableFrom !== undefined) update.availableFrom = data.availableFrom ? new Date(data.availableFrom) : null;
    if (data.dueAt) update.dueAt = new Date(data.dueAt);
    if (data.questions) {
      delete update.questions;
      await prisma.proctoredQuestion.deleteMany({ where: { testId } });
      update.questions = { create: data.questions.map((question, index) => ({ order: index + 1, prompt: question.prompt, options: question.options, correctOption: question.correctOption, marks: question.marks || 1 })) };
    }
    const updated = await prisma.proctoredTest.update({ where: { id: testId }, data: update, include: testInclude });
    return serializeTest(updated, { includeCorrect: true });
  }

  async setStatus(teacherId, testId, status) {
    const test = await prisma.proctoredTest.findFirst({ where: { id: testId, teacherId }, include: testInclude });
    if (!test) throw new Error("Test not found");
    if (status === "PUBLISHED" && (!test.questions.length || new Date(test.dueAt) <= new Date())) throw new Error("A published test needs questions and a future due date");
    const updated = await prisma.proctoredTest.update({ where: { id: testId }, data: { status }, include: testInclude });
    return serializeTest(updated, { includeCorrect: true });
  }

  async publishResults(teacherId, testId, resultPublished) {
    const test = await prisma.proctoredTest.findFirst({ where: { id: testId, teacherId }, include: testInclude });
    if (!test) throw new Error("Test not found");
    const updated = await prisma.proctoredTest.update({ where: { id: testId }, data: { resultPublished: Boolean(resultPublished) }, include: testInclude });
    return serializeTest(updated, { includeCorrect: true });
  }

  async listForStudent(studentId) {
    const tests = await prisma.proctoredTest.findMany({
      where: { status: "PUBLISHED", course: { enrollments: { some: { studentId } } } },
      include: { course: { select: { id: true, title: true } }, teacher: { select: { name: true } }, questions: { orderBy: { order: "asc" } }, attempts: { where: { studentId }, select: { id: true, status: true, startedAt: true, expiresAt: true, submittedAt: true, score: true, teacherMarks: true, teacherFeedback: true, violationCount: true } } },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });
    return tests.map((test) => ({ ...serializeTest(test), myAttempt: test.attempts[0] ? { ...test.attempts[0], startedAt: safeDate(test.attempts[0].startedAt), expiresAt: safeDate(test.attempts[0].expiresAt), submittedAt: safeDate(test.attempts[0].submittedAt), finalMarks: test.attempts[0].teacherMarks ?? test.attempts[0].score } : null }));
  }

  async startAttempt(studentId, testId) {
    const test = await prisma.proctoredTest.findFirst({ where: { id: testId, status: "PUBLISHED", course: { enrollments: { some: { studentId } } } }, include: testInclude });
    if (!test) throw new Error("Test is not available for this student");
    const now = new Date();
    let attempt = await prisma.proctoredAttempt.findUnique({ where: { testId_studentId: { testId, studentId } }, include: attemptInclude });
    if (attempt?.status === "IN_PROGRESS" && now > new Date(attempt.expiresAt)) return this.submitAttempt(studentId, attempt.id, true);
    if (attempt && attempt.status !== "IN_PROGRESS") return serializeAttempt(attempt, { student: true });
    if (test.availableFrom && now < new Date(test.availableFrom)) throw new Error("This test is not open yet");
    if (now > new Date(test.dueAt)) throw new Error("The test due date has passed");
    if (attempt) return serializeAttempt(attempt, { student: true });
    const expiresAt = new Date(Math.min(now.getTime() + test.durationMinutes * 60000, new Date(test.dueAt).getTime()));
    attempt = await prisma.proctoredAttempt.create({ data: { testId, studentId, expiresAt }, include: attemptInclude });
    return serializeAttempt(attempt, { student: true });
  }

  async getStudentAttempt(studentId, attemptId) {
    const attempt = await prisma.proctoredAttempt.findFirst({ where: { id: attemptId, studentId }, include: attemptInclude });
    if (!attempt) throw new Error("Attempt not found");
    if (attempt.status === "IN_PROGRESS" && new Date() > new Date(attempt.expiresAt)) return this.submitAttempt(studentId, attemptId, true);
    return serializeAttempt(attempt, { student: true });
  }

  async saveAnswers(studentId, attemptId, answers) {
    const attempt = await prisma.proctoredAttempt.findFirst({ where: { id: attemptId, studentId }, include: { test: { include: { questions: true } } } });
    if (!attempt) throw new Error("Attempt not found");
    if (attempt.status !== "IN_PROGRESS") throw new Error("This attempt is already locked");
    if (new Date() > new Date(attempt.expiresAt)) return this.submitAttempt(studentId, attemptId, true);
    const valid = new Map(attempt.test.questions.map((question) => [question.id, question]));
    await prisma.$transaction(answers.map((answer) => {
      const question = valid.get(answer.questionId);
      if (!question) throw new Error("Invalid question in answer set");
      const selected = answer.selectedOption || null;
      return prisma.proctoredAnswer.upsert({ where: { attemptId_questionId: { attemptId, questionId: question.id } }, create: { attemptId, questionId: question.id, selectedOption: selected }, update: { selectedOption: selected } });
    }));
    return this.getStudentAttempt(studentId, attemptId);
  }

  async recordEvent(studentId, attemptId, type, metadata) {
    const attempt = await prisma.proctoredAttempt.findFirst({ where: { id: attemptId, studentId }, include: { test: true } });
    if (!attempt) throw new Error("Attempt not found");
    if (attempt.status !== "IN_PROGRESS") return { locked: true, attempt: serializeAttempt(await prisma.proctoredAttempt.findUnique({ where: { id: attemptId }, include: attemptInclude }), { student: true }) };
    const next = attempt.violationCount + 1;
    await prisma.$transaction([
      prisma.proctoredEvent.create({ data: { attemptId, type, metadata: metadata || undefined } }),
      prisma.proctoredAttempt.update({ where: { id: attemptId }, data: { violationCount: next } }),
    ]);
    if (next >= attempt.test.maxViolations) return { locked: true, attempt: await this.submitAttempt(studentId, attemptId, true) };
    return { locked: false, violationCount: next };
  }

  async submitAttempt(studentId, attemptId, auto = false) {
    const attempt = await prisma.proctoredAttempt.findFirst({ where: { id: attemptId, studentId }, include: { test: { include: { questions: true } } } });
    if (!attempt) throw new Error("Attempt not found");
    if (attempt.status !== "IN_PROGRESS") {
      const existing = await prisma.proctoredAttempt.findUnique({ where: { id: attemptId }, include: attemptInclude });
      return serializeAttempt(existing, { student: true });
    }
    const now = new Date();
    const isAuto = auto || now > new Date(attempt.expiresAt);
    const answers = await prisma.proctoredAnswer.findMany({ where: { attemptId } });
    const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
    let score = 0;
    const writes = attempt.test.questions.map((question) => {
      const answer = byQuestion.get(question.id);
      const isCorrect = Boolean(answer?.selectedOption && answer.selectedOption === question.correctOption);
      const marksAwarded = isCorrect ? question.marks : 0;
      score += marksAwarded;
      return prisma.proctoredAnswer.upsert({ where: { attemptId_questionId: { attemptId, questionId: question.id } }, create: { attemptId, questionId: question.id, selectedOption: answer?.selectedOption || null, isCorrect, marksAwarded }, update: { isCorrect, marksAwarded } });
    });
    await prisma.$transaction([...writes, prisma.proctoredAttempt.update({ where: { id: attemptId }, data: { status: isAuto ? "AUTO_SUBMITTED" : "SUBMITTED", score, submittedAt: now, autoSubmittedAt: isAuto ? now : null } })]);
    const updated = await prisma.proctoredAttempt.findUnique({ where: { id: attemptId }, include: attemptInclude });
    return serializeAttempt(updated, { student: true });
  }

  async listTeacherAttempts(teacherId, testId) {
    const test = await prisma.proctoredTest.findFirst({ where: { id: testId, teacherId }, include: testInclude });
    if (!test) throw new Error("Test not found");
    const attempts = await prisma.proctoredAttempt.findMany({ where: { testId }, include: attemptInclude, orderBy: { startedAt: "desc" } });
    return { test: serializeTest(test, { includeCorrect: true }), attempts: attempts.map((attempt) => serializeAttempt(attempt)) };
  }

  async gradeAttempt(teacherId, attemptId, marks, feedback) {
    const attempt = await prisma.proctoredAttempt.findFirst({ where: { id: attemptId, test: { teacherId } }, include: { test: { include: { questions: true } } } });
    if (!attempt) throw new Error("Attempt not found");
    const max = totalMarks(attempt.test);
    if (marks > max) throw new Error(`Marks cannot exceed the test total (${max})`);
    const updated = await prisma.proctoredAttempt.update({ where: { id: attemptId }, data: { teacherMarks: marks, teacherFeedback: feedback || null, gradedAt: new Date(), gradedById: teacherId, status: "GRADED" }, include: attemptInclude });
    return serializeAttempt(updated);
  }

  async listAdminTests() {
    const tests = await prisma.proctoredTest.findMany({ include: { ...testInclude, _count: { select: { attempts: true } } }, orderBy: { createdAt: "desc" } });
    return tests.map((test) => ({ ...serializeTest(test, { includeCorrect: true }), attemptsCount: test._count.attempts }));
  }

  async listAdminAttempts(testId) {
    const test = await prisma.proctoredTest.findUnique({ where: { id: testId }, include: testInclude });
    if (!test) throw new Error("Test not found");
    const attempts = await prisma.proctoredAttempt.findMany({ where: { testId }, include: attemptInclude, orderBy: { startedAt: "desc" } });
    return { test: serializeTest(test, { includeCorrect: true }), attempts: attempts.map((attempt) => serializeAttempt(attempt)) };
  }

  async getStudentResult(studentId, attemptId) {
    const attempt = await prisma.proctoredAttempt.findFirst({ where: { id: attemptId, studentId }, include: attemptInclude });
    if (!attempt) throw new Error("Attempt not found");
    if (!attempt.test.resultPublished) throw new Error("The teacher has not published this result yet");
    return serializeAttempt(attempt, { student: false });
  }
}

module.exports = new ProctoredTestsService();
