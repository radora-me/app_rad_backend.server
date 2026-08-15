const service = require("./timetable.service");
const { createTimetableSchema, assignTimetableSchema } = require("./timetable.validator");

class TimetableController {
  async create(req, res) { try { const { error, value } = createTimetableSchema.validate(req.body); if (error) return res.status(400).json({ error: error.message }); res.status(201).json(await service.create(value, req.user.id)); } catch (error) { res.status(400).json({ error: error.message }); } }
  async listAdmin(req, res) { try { res.json(await service.listAdmin()); } catch (error) { res.status(400).json({ error: error.message }); } }
  async listCourses(req, res) { try { res.json(await service.listCourses()); } catch (error) { res.status(400).json({ error: error.message }); } }
  async assign(req, res) { try { const { error, value } = assignTimetableSchema.validate(req.body); if (error) return res.status(400).json({ error: error.message }); res.json(await service.assign(req.params.id, value.courseIds)); } catch (error) { res.status(400).json({ error: error.message }); } }
  async listMine(req, res) { try { res.json(await service.listMine(req.user)); } catch (error) { res.status(400).json({ error: error.message }); } }
}
module.exports = new TimetableController();
