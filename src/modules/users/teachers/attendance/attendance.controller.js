const service = require("./attendance.service");

class AttendanceController {
  async fullDay(req, res) {
    try {
      const result = await service.markFullDayAttendance(req.user.id, req.body);

      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err.message,
      });
    }
  }

  async subjectWise(req, res) {
    try {
      const result = await service.markSubjectWiseAttendance(
        req.user.id,
        req.body,
      );

      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err.message,
      });
    }
  }

  async students(req, res) {
    try {
      const result = await service.getCourseStudents(req.params.courseId);

      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err.message,
      });
    }
  }

  async courseAttendance(req, res) {
    try {
      const result = await service.getCourseAttendance(
        req.params.courseId,
        req.query.date || new Date().toISOString(),
      );

      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err.message,
      });
    }
  }
}

module.exports = new AttendanceController();
