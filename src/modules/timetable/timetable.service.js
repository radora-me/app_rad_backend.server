const repo = require("./timetable.repository");

class TimetableService {
  _toMinePayload(timetable, user) {
    const relevantAssignments = timetable.assignments.filter((assignment) =>
      user.role === "teacher"
        ? assignment.course.teacherId === user.id
        : assignment.course.enrollments?.some((enrollment) => enrollment.studentId === user.id),
    );
    const relevantCourseIds = new Set(relevantAssignments.map((assignment) => assignment.courseId));

    return {
      name: timetable.name,
      className: timetable.className,
      section: timetable.section || "",
      isPublished: timetable.isPublished,
      entries: timetable.entries
        .filter((entry) => !entry.courseId || relevantCourseIds.has(entry.courseId))
        .map((entry) => ({
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          subject: entry.subject,
          room: entry.room,
          teacherName: entry.teacher?.name || null,
          courseId: entry.courseId || null,
        })),
      courses: relevantAssignments.map((assignment) => ({
        courseId: assignment.courseId,
        className: assignment.course.title,
        section: assignment.course.description || "",
        teacherName: assignment.course.teacher?.name || null,
      })),
    };
  }

  async create(payload, adminId) {
    const courseIds = [...new Set(payload.courseIds)];
    const courses = await repo.findCourses(courseIds);
    if (courses.length !== courseIds.length) throw new Error("One or more selected classes no longer exist");
    const className = payload.className.trim();
    const section = payload.section?.trim() || null;
    if (courses.some((course) => course.title !== className || (section && course.description !== section))) {
      throw new Error("Selected classes must match the timetable class and section");
    }
    if (payload.entries.some((entry) => entry.endTime <= entry.startTime)) throw new Error("Each class must end after it starts");

    return repo.create({
      name: payload.name.trim(), className, section, createdById: adminId,
      entries: { create: payload.entries.map((entry) => ({ ...entry, subject: entry.subject.trim(), room: entry.room?.trim() || null })) },
      assignments: { create: courseIds.map((courseId) => ({ courseId })) },
    });
  }
  listAdmin() { return repo.listAll(); }
  listCourses() { return repo.listCourses(); }
  async assign(id, courseIds) {
    const timetable = await repo.findById(id);
    if (!timetable) throw new Error("Timetable not found");
    const uniqueIds = [...new Set(courseIds)];
    const courses = await repo.findCourses(uniqueIds);
    if (courses.length !== uniqueIds.length) throw new Error("One or more selected classes no longer exist");
    await repo.replaceAssignments(id, uniqueIds);
    return repo.findById(id);
  }
  async listMine(user) {
    let timetables;
    if (user.role === "student") timetables = await repo.listForStudent(user.id);
    else if (user.role === "teacher") timetables = await repo.listForTeacher(user.id);
    else throw new Error("Timetables are only available to students and teachers");

    return timetables
      .map((timetable) => this._toMinePayload(timetable, user))
      .filter((timetable) => timetable.courses.length > 0);
  }
}
module.exports = new TimetableService();
