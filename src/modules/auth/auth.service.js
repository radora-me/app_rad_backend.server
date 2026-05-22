const bcrypt = require("bcryptjs");
const repo = require("./auth.repository");
const jwtService = require("../../core/utils/jwt.utils");
const redis = require("../../core/cache/redis");

class AuthService {
  async studentLogin({ rollNumber, password }) {
    const user = await repo.findByRollNumber(rollNumber);
    if (!user || user.role !== "student")
      throw new Error("Invalid credentials");

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new Error("Invalid credentials");

    return this._issueTokens(user);
  }

  async teacherLogin({ email, password }) {
    const user = await repo.findByEmail(email);
    if (!user || !["teacher", "admin"].includes(user.role))
      throw new Error("Invalid credentials");

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new Error("Invalid credentials");

    return this._issueTokens(user);
  }

  async createStudent({ name, rollNumber, password }, adminId) {
    const existing = await repo.findByRollNumber(rollNumber);
    if (existing) throw new Error("Roll number already exists");

    const hashed = await bcrypt.hash(password, 12);
    const user = await repo.create({
      name,
      rollNumber,
      password: hashed,
      role: "student",
    });

    return { message: "Student created", userId: user.id };
  }

  async createTeacher({ name, email, password }, adminId) {
    const existing = await repo.findByEmail(email);
    if (existing) throw new Error("Email already exists");

    const hashed = await bcrypt.hash(password, 12);
    const user = await repo.create({
      name,
      email,
      password: hashed,
      role: "teacher",
    });

    return { message: "Teacher created", userId: user.id };
  }

  async assignTeacherClass({ teacherEmail, className, section }) {
    const teacher = await repo.findTeacherByEmail(teacherEmail);

    if (!teacher) {
      throw new Error("Teacher not found");
    }

    const normalizedClassName = className.trim();
    const normalizedSection = section.trim();

    const existingCourse = await repo.findTeacherCourseByClass(
      teacher.id,
      normalizedClassName,
      normalizedSection,
    );

    const course = existingCourse
      ? await repo.updateTeacherCourse(existingCourse.id, {
          className: normalizedClassName,
          section: normalizedSection,
        })
      : await repo.createTeacherCourse({
          teacherId: teacher.id,
          className: normalizedClassName,
          section: normalizedSection,
        });

    const courses = await repo.listTeacherCourses(teacher.id);

    return {
      message: "Teacher class assigned",
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
      },
      course,
      courses,
    };
  }

  async findTeacherByEmail(email) {
    const teacher = await repo.findTeacherByEmail(email);

    if (!teacher) {
      throw new Error("Teacher not found");
    }

    const courses = await repo.listTeacherCourses(teacher.id);

    return {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      courses,
    };
  }

  async refreshToken(token) {
    const decoded = jwtService.verifyRefresh(token);
    const stored = await redis.get(`refresh:${decoded.id}`);
    if (!stored || stored !== token) throw new Error("Invalid session");

    const newAccessToken = jwtService.generateAccessToken({
      id: decoded.id,
      role: decoded.role,
    });
    return { accessToken: newAccessToken };
  }

  async logout(userId) {
    await redis.del(`refresh:${userId}`);
    return { message: "Logged out successfully" };
  }

  async _issueTokens(user) {
    const payload = { id: user.id, role: user.role };
    const accessToken = jwtService.generateAccessToken(payload);
    const refreshToken = jwtService.generateRefreshToken(payload);

    await redis.set(`refresh:${user.id}`, refreshToken, "EX", 7 * 24 * 60 * 60);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        ...(user.email && { email: user.email }),
        ...(user.rollNumber && { rollNumber: user.rollNumber }),
        ...(user.className && { className: user.className }),
        ...(user.profilePhotoUrl && { profilePhotoUrl: user.profilePhotoUrl }),
      },
    };
  }
}

module.exports = new AuthService();
