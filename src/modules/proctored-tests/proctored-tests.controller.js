const service = require("./proctored-tests.service");
const { createTestSchema, updateTestSchema, answerSchema, eventSchema, gradeSchema } = require("./proctored-tests.validator");

class ProctoredTestsController {
  async create(req, res) {
    try { const { error, value } = createTestSchema.validate(req.body, { abortEarly: false, stripUnknown: true }); if (error) return this.validation(res, error); return res.status(201).json(await service.createTest(req.user.id, value)); } catch (error) { return this.error(res, error); }
  }
  async update(req, res) {
    try { const { error, value } = updateTestSchema.validate(req.body, { abortEarly: false, stripUnknown: true }); if (error) return this.validation(res, error); return res.json(await service.updateTest(req.user.id, req.params.testId, value)); } catch (error) { return this.error(res, error); }
  }
  async listTeacher(req, res) { try { return res.json(await service.listForTeacher(req.user.id)); } catch (error) { return this.error(res, error); } }
  async getTeacher(req, res) { try { return res.json(await service.getTeacherTest(req.user.id, req.params.testId)); } catch (error) { return this.error(res, error); } }
  async publish(req, res) { try { return res.json(await service.setStatus(req.user.id, req.params.testId, "PUBLISHED")); } catch (error) { return this.error(res, error); } }
  async close(req, res) { try { return res.json(await service.setStatus(req.user.id, req.params.testId, "CLOSED")); } catch (error) { return this.error(res, error); } }
  async publishResults(req, res) { try { return res.json(await service.publishResults(req.user.id, req.params.testId, req.body.resultPublished)); } catch (error) { return this.error(res, error); } }
  async teacherAttempts(req, res) { try { return res.json(await service.listTeacherAttempts(req.user.id, req.params.testId)); } catch (error) { return this.error(res, error); } }
  async grade(req, res) { try { const { error, value } = gradeSchema.validate(req.body, { abortEarly: false, stripUnknown: true }); if (error) return this.validation(res, error); return res.json(await service.gradeAttempt(req.user.id, req.params.attemptId, value.marks, value.feedback)); } catch (error) { return this.error(res, error); } }
  async listStudent(req, res) { try { return res.json(await service.listForStudent(req.user.id)); } catch (error) { return this.error(res, error); } }
  async start(req, res) { try { return res.status(201).json(await service.startAttempt(req.user.id, req.params.testId)); } catch (error) { return this.error(res, error); } }
  async studentAttempt(req, res) { try { return res.json(await service.getStudentAttempt(req.user.id, req.params.attemptId)); } catch (error) { return this.error(res, error); } }
  async saveAnswers(req, res) { try { const { error, value } = answerSchema.validate(req.body, { abortEarly: false, stripUnknown: true }); if (error) return this.validation(res, error); return res.json(await service.saveAnswers(req.user.id, req.params.attemptId, value.answers)); } catch (error) { return this.error(res, error); } }
  async event(req, res) { try { const { error, value } = eventSchema.validate(req.body, { abortEarly: false, stripUnknown: true }); if (error) return this.validation(res, error); return res.json(await service.recordEvent(req.user.id, req.params.attemptId, value.type, value.metadata)); } catch (error) { return this.error(res, error); } }
  async submit(req, res) { try { return res.json(await service.submitAttempt(req.user.id, req.params.attemptId, false)); } catch (error) { return this.error(res, error); } }
  async result(req, res) { try { return res.json(await service.getStudentResult(req.user.id, req.params.attemptId)); } catch (error) { return this.error(res, error); } }
  async listAdmin(req, res) { try { return res.json(await service.listAdminTests()); } catch (error) { return this.error(res, error); } }
  async adminAttempts(req, res) { try { return res.json(await service.listAdminAttempts(req.params.testId)); } catch (error) { return this.error(res, error); } }
  validation(res, error) { return res.status(400).json({ message: "Validation failed", errors: error.details.map((item) => item.message) }); }
  error(res, error) { const status = error.message?.includes("not found") ? 404 : error.message?.includes("not authorized") || error.message?.includes("not available") ? 403 : 400; return res.status(status).json({ message: error.message || "Unable to process test request" }); }
}

module.exports = new ProctoredTestsController();
