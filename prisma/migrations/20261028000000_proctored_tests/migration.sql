-- Proctored MCQ tests, server-authoritative attempts, grading and audit events.
CREATE TYPE "ProctoredTestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "ProctoredAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'GRADED');

CREATE TABLE "ProctoredTest" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "instructions" TEXT,
  "courseId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  "availableFrom" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "ProctoredTestStatus" NOT NULL DEFAULT 'DRAFT',
  "resultPublished" BOOLEAN NOT NULL DEFAULT false,
  "maxViolations" INTEGER NOT NULL DEFAULT 3,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProctoredTest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProctoredQuestion" (
  "id" TEXT NOT NULL,
  "testId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "correctOption" TEXT NOT NULL,
  "marks" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ProctoredQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProctoredAttempt" (
  "id" TEXT NOT NULL,
  "testId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "autoSubmittedAt" TIMESTAMP(3),
  "status" "ProctoredAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "score" INTEGER,
  "teacherMarks" INTEGER,
  "teacherFeedback" TEXT,
  "gradedAt" TIMESTAMP(3),
  "gradedById" TEXT,
  "violationCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProctoredAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProctoredAnswer" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "selectedOption" TEXT,
  "isCorrect" BOOLEAN,
  "marksAwarded" INTEGER,
  "answeredAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProctoredAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProctoredEvent" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProctoredEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProctoredQuestion_testId_order_key" ON "ProctoredQuestion"("testId", "order");
CREATE UNIQUE INDEX "ProctoredAttempt_testId_studentId_key" ON "ProctoredAttempt"("testId", "studentId");
CREATE UNIQUE INDEX "ProctoredAnswer_attemptId_questionId_key" ON "ProctoredAnswer"("attemptId", "questionId");
CREATE INDEX "ProctoredTest_courseId_status_idx" ON "ProctoredTest"("courseId", "status");
CREATE INDEX "ProctoredTest_teacherId_createdAt_idx" ON "ProctoredTest"("teacherId", "createdAt");
CREATE INDEX "ProctoredTest_dueAt_idx" ON "ProctoredTest"("dueAt");
CREATE INDEX "ProctoredQuestion_testId_idx" ON "ProctoredQuestion"("testId");
CREATE INDEX "ProctoredAttempt_studentId_status_idx" ON "ProctoredAttempt"("studentId", "status");
CREATE INDEX "ProctoredAttempt_testId_status_idx" ON "ProctoredAttempt"("testId", "status");
CREATE INDEX "ProctoredAnswer_questionId_idx" ON "ProctoredAnswer"("questionId");
CREATE INDEX "ProctoredEvent_attemptId_occurredAt_idx" ON "ProctoredEvent"("attemptId", "occurredAt");

ALTER TABLE "ProctoredTest" ADD CONSTRAINT "ProctoredTest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProctoredTest" ADD CONSTRAINT "ProctoredTest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProctoredQuestion" ADD CONSTRAINT "ProctoredQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "ProctoredTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProctoredAttempt" ADD CONSTRAINT "ProctoredAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "ProctoredTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProctoredAttempt" ADD CONSTRAINT "ProctoredAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProctoredAttempt" ADD CONSTRAINT "ProctoredAttempt_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProctoredAnswer" ADD CONSTRAINT "ProctoredAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ProctoredAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProctoredAnswer" ADD CONSTRAINT "ProctoredAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ProctoredQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProctoredEvent" ADD CONSTRAINT "ProctoredEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ProctoredAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
