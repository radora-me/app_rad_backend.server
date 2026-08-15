const repo = require("./timetable.repository");

class TimetableService {
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
  listMine(user) {
    if (user.role === "student") return repo.listForStudent(user.id);
    if (user.role === "teacher") return repo.listForTeacher(user.id);
    throw new Error("Timetables are only available to students and teachers");
  }
}
module.exports = new TimetableService();
