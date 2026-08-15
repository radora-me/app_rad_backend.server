CREATE TABLE "Timetable" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "className" TEXT NOT NULL,
  "section" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimetableEntry" (
  "id" TEXT NOT NULL,
  "timetableId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "room" TEXT,
  "teacherId" TEXT,
  "courseId" TEXT,
  CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimetableAssignment" (
  "id" TEXT NOT NULL,
  "timetableId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  CONSTRAINT "TimetableAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimetableEntry_timetableId_dayOfWeek_startTime_endTime_key" ON "TimetableEntry"("timetableId", "dayOfWeek", "startTime", "endTime");
CREATE UNIQUE INDEX "TimetableAssignment_timetableId_courseId_key" ON "TimetableAssignment"("timetableId", "courseId");
CREATE INDEX "Timetable_className_section_idx" ON "Timetable"("className", "section");
CREATE INDEX "Timetable_createdById_idx" ON "Timetable"("createdById");
CREATE INDEX "TimetableEntry_teacherId_idx" ON "TimetableEntry"("teacherId");
CREATE INDEX "TimetableEntry_courseId_idx" ON "TimetableEntry"("courseId");
CREATE INDEX "TimetableAssignment_courseId_idx" ON "TimetableAssignment"("courseId");
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimetableAssignment" ADD CONSTRAINT "TimetableAssignment_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimetableAssignment" ADD CONSTRAINT "TimetableAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
