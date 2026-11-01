const service = require("./leaderboard.service");

class LeaderboardController {
  async courses(req, res) { try { return res.json({ courses: await service.listCourses(req.user.id, req.user.role) }); } catch (error) { return this.error(res, error); } }
  async classData(req, res) { try { const course = await service.canAccessCourse(req.user.id, req.user.role, req.params.courseId); if (!course) return res.status(403).json({ message: "You are not authorized to view this class leaderboard" }); return res.json(await service.buildCourse(req.params.courseId, { viewerId: req.user.id, viewerRole: req.user.role })); } catch (error) { return this.error(res, error); } }
  async studentData(req, res) { try { const courses = await service.listCourses(req.user.id, "student"); const enrolled = await require("../../core/database/prisma").enrollment.findMany({ where: { studentId: req.user.id }, select: { courseId: true } }); const data = await Promise.all(enrolled.map((item) => service.buildCourse(item.courseId, { viewerId: req.user.id, viewerRole: "student" }))); return res.json({ courses, classes: data.map((item) => service.toStudentPayload(item)) }); } catch (error) { return this.error(res, error); } }
  async teacherOverview(req, res) { try { return res.json(await service.getTeacherOverview(req.user.id)); } catch (error) { return this.error(res, error); } }
  async adminOverview(req, res) { try { return res.json(await service.getAdminOverview()); } catch (error) { return this.error(res, error); } }
  error(res, error) { return res.status(error.message === "Class not found" ? 404 : 400).json({ message: error.message || "Unable to load leaderboard" }); }
}

module.exports = new LeaderboardController();
