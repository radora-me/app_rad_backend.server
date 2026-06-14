const service = require("./auth.service");
const {
  registerSchema,
  studentLoginSchema,
  teacherLoginSchema,
  createStudentSchema,
  createTeacherSchema,
  createHolidaySchema,
} = require("./auth.validator");
const Joi = require("joi");

const assignTeacherSchema = Joi.object({
  teacherEmail: Joi.string().email().required(),
  className: Joi.string().min(1).required(),
  section: Joi.string().min(1).required(),
}).unknown(true);

const teacherSearchSchema = Joi.object({
  email: Joi.string().email().required(),
}).unknown(true);

class AuthController {
  async register(req, res) {
    try {
      const { error } = registerSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.message });

      const result = await service.registerAdmin(req.body);
      res.status(201).json(result);
    } catch (err) {
      const status = err.message === "Email already exists" ? 409 : 400;
      res.status(status).json({ error: err.message });
    }
  }

  async studentLogin(req, res) {
    try {
      const { error } = studentLoginSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.message });

      const result = await service.studentLogin(req.body);
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  }

  async teacherLogin(req, res) {
    try {
      const { error } = teacherLoginSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.message });

      const result = await service.teacherLogin(req.body);
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  }

  async createStudent(req, res) {
    try {
      const { error } = createStudentSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.message });

      const result = await service.createStudent(req.body, req.user.id);
      res.status(201).json(result);
    } catch (err) {
      const status = err.message === "Roll number already exists" ? 409 : 400;
      res.status(status).json({ error: err.message });
    }
  }

  async createTeacher(req, res) {
    try {
      const { error } = createTeacherSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.message });

      const result = await service.createTeacher(req.body, req.user.id);
      res.status(201).json(result);
    } catch (err) {
      const status = err.message === "Email already exists" ? 409 : 400;
      res.status(status).json({ error: err.message });
    }
  }

  async assignTeacherClass(req, res) {
    try {
      const { error } = assignTeacherSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.message });

      const result = await service.assignTeacherClass(req.body, req.user.id);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async searchTeacher(req, res) {
    try {
      const { error } = teacherSearchSchema.validate(req.query);
      if (error) return res.status(400).json({ error: error.message });

      const result = await service.findTeacherByEmail(req.query.email);
      res.json(result);
    } catch (err) {
      const status = err.message === "Teacher not found" ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  }

  async searchStudent(req, res) {
    try {
      const { error } = Joi.object({
        rollNumber: Joi.string().required(),
      }).validate(req.query);

      if (error) return res.status(400).json({ error: error.message });

      const result = await service.findStudentByRollNumber(
        req.query.rollNumber,
      );
      res.json(result);
    } catch (err) {
      const status = err.message === "Student not found" ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  }

  async createHoliday(req, res) {
    try {
      const { error } = createHolidaySchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.message });

      const result = await service.createHoliday(req.body, req.user.id);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async listHolidays(req, res) {
    try {
      const result = await service.listHolidays();
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async refresh(req, res) {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Token required" });
      const result = await service.refreshToken(token);
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  }

  async logout(req, res) {
    try {
      const result = await service.logout(req.user.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = new AuthController();
