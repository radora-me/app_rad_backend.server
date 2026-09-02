CREATE TABLE "TeacherCourseAccess" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "subjectName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherCourseAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherCourseAccess_teacherId_courseId_key" ON "TeacherCourseAccess"("teacherId", "courseId");
CREATE INDEX "TeacherCourseAccess_courseId_idx" ON "TeacherCourseAccess"("courseId");

ALTER TABLE "TeacherCourseAccess" ADD CONSTRAINT "TeacherCourseAccess_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherCourseAccess" ADD CONSTRAINT "TeacherCourseAccess_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;