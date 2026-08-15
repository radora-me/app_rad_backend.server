const prisma = require("../../core/database/prisma");

const include = {
  entries: { include: { teacher: { select: { id: true, name: true } }, course: { select: { id: true, title: true, description: true } } }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
  assignments: { include: { course: { include: { teacher: { select: { id: true, name: true, email: true } } } } } },
};

class TimetableRepository {
  create(data) { return prisma.timetable.create({ data, include }); }
  findById(id) { return prisma.timetable.findUnique({ where: { id }, include }); }
  listAll() { return prisma.timetable.findMany({ include, orderBy: { updatedAt: "desc" } }); }
  listCourses() { return prisma.course.findMany({ include: { teacher: { select: { id: true, name: true, email: true } } }, orderBy: [{ title: "asc" }, { description: "asc" }] }); }
  findCourses(ids) { return prisma.course.findMany({ where: { id: { in: ids } } }); }
  async replaceAssignments(timetableId, courseIds) {
    return prisma.$transaction([
      prisma.timetableAssignment.deleteMany({ where: { timetableId } }),
      prisma.timetableAssignment.createMany({ data: courseIds.map((courseId) => ({ timetableId, courseId })), skipDuplicates: true }),
    ]);
  }
  listForStudent(studentId) {
    return prisma.timetable.findMany({ where: { isPublished: true, assignments: { some: { course: { enrollments: { some: { studentId } } } } } }, include, orderBy: { updatedAt: "desc" } });
  }
  listForTeacher(teacherId) {
    return prisma.timetable.findMany({ where: { isPublished: true, assignments: { some: { course: { teacherId } } } }, include, orderBy: { updatedAt: "desc" } });
  }
}
module.exports = new TimetableRepository();
