const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const repo = require("./auth.repository");
const jwtService = require("../../core/utils/jwt.utils");
const redis = require("../../core/cache/redis");
const { sendPasswordResetEmail } = require("../../shared/utils/send.reset.email");
const { sendPasswordChangedEmail } = require("../../shared/utils/send.password.changed.email");

class AuthService {
  _toCoursePayload(course) {
    return {
      courseId: course.id,
      className: course.title,
      section: course.description || "",
      studentCount: course._count?.enrollments || 0,
    };
  }

  async registerAdmin({ name, email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await repo.findByEmail(normalizedEmail);

    if (existing) {
      throw new Error("Email already exists");
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await repo.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashed,
      role: "admin",
    });

    return this._issueTokens(user);
  }

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

    user.isSubjectTeacher = !(await repo.hasOwnedCourses(user.id));
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
      course: this._toCoursePayload(course),
      courses: courses.map((item) => this._toCoursePayload(item)),
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
      courses: courses.map((course) => this._toCoursePayload(course)),
    };
  }

  async findStudentByRollNumber(rollNumber) {
    const student = await repo.findByRollNumber(rollNumber);

    if (!student || student.role !== "student") {
      throw new Error("Student not found");
    }

    return {
      id: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      className: student.className || student.class || "",
      profilePhotoUrl: student.profilePhotoUrl || null,
      role: student.role,
    };
  }

  async createHoliday({ title, date }, adminId) {
    const holidayDate = new Date(date);

    if (Number.isNaN(holidayDate.getTime())) {
      throw new Error("Invalid date");
    }

    const holiday = await repo.createHoliday({
      title: title.trim(),
      date: holidayDate,
      createdBy: adminId,
    });
    return { title: holiday.title, date: holiday.date };
  }

  async listHolidays() {
    const holidays = await repo.listHolidays();
    return holidays.map((holiday) => ({
      title: holiday.title,
      date: holiday.date,
    }));
  }

  async listTeachers() {
    const teachers = await repo.listAllTeachers();
    return teachers.map((t) => this._toTeacherPayload(t));
  }

  async getTeacher(teacherId) {
    const teacher = await repo.findTeacherById(teacherId);
    if (!teacher) throw new Error("Teacher not found");
    return this._toTeacherPayload(teacher);
  }

  async updateTeacher(teacherId, { name, email, address }) {
    const teacher = await repo.findTeacherById(teacherId);
    if (!teacher) throw new Error("Teacher not found");

    if (email) {
      const conflict = await repo.findByEmailExcluding(email.trim().toLowerCase(), teacherId);
      if (conflict) throw new Error("Email already in use");
    }

    const updated = await repo.updateUser(teacherId, {
      ...(name && { name: name.trim() }),
      ...(email && { email: email.trim().toLowerCase() }),
      ...(address !== undefined && { className: address.trim() }),
    });
    return this._toTeacherPayload(updated);
  }

  async getAdminProfile(adminId) {
    const admin = await repo.findAdminById(adminId);
    if (!admin) throw new Error("Admin not found");
    return { id: admin.id, name: admin.name, email: admin.email, role: admin.role };
  }

  async updateAdminProfile(adminId, { name, email }) {
    const admin = await repo.findAdminById(adminId);
    if (!admin) throw new Error("Admin not found");

    if (email) {
      const conflict = await repo.findByEmailExcluding(email.trim().toLowerCase(), adminId);
      if (conflict) throw new Error("Email already in use");
    }

    const updated = await repo.updateUser(adminId, {
      ...(name && { name: name.trim() }),
      ...(email && { email: email.trim().toLowerCase() }),
    });
    return { id: updated.id, name: updated.name, email: updated.email, role: updated.role };
  }

  _toTeacherPayload(teacher) {
    return {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      address: teacher.className || "",
      courses: (teacher.taughtCourses || []).map((c) => ({
        id: c.id,
        title: c.title,
        section: c.description || "",
      })),
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

  async forgotPassword(email) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await repo.findByEmail(normalizedEmail);

    // Password resets are available only to existing teacher and admin accounts.
    if (!user || !["teacher", "admin"].includes(user.role)) {
      throw new Error("No teacher or admin account exists with this email");
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Store OTP and resetToken in Redis — 10 min TTL
    await redis.set(`otp:${normalizedEmail}`, otp, "EX", 600);
    await redis.set(`reset_token:${resetToken}`, user.id, "EX", 600);

    await sendPasswordResetEmail({
      to: normalizedEmail,
      name: user.name,
      otp,
      resetToken,
    });

    return { message: "A password reset link and OTP have been sent." };
  }

  async verifyOtp(email, otp) {
    const normalizedEmail = email.trim().toLowerCase();
    const storedOtp = await redis.get(`otp:${normalizedEmail}`);

    if (!storedOtp || storedOtp !== otp.trim()) {
      throw new Error("Invalid or expired OTP");
    }

    const user = await repo.findByEmail(normalizedEmail);
    if (!user || !["teacher", "admin"].includes(user.role)) {
      throw new Error("Invalid or expired OTP");
    }

    // OTP verified — issue a short-lived reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    await redis.set(`reset_token:${resetToken}`, user.id, "EX", 600);
    await redis.del(`otp:${normalizedEmail}`);

    return { resetToken };
  }

  async verifyResetLink(resetToken) {
    const userId = await redis.get(`reset_token:${resetToken}`);
    if (!userId) throw new Error("Reset link is invalid or has expired");

    const user = await repo.findById(userId);
    if (!user || !["teacher", "admin"].includes(user.role)) {
      await redis.del(`reset_token:${resetToken}`);
      throw new Error("Reset link is invalid or has expired");
    }

    return { message: "Reset link verified" };
  }

  async resetPassword(resetToken, newPassword) {
    const userId = await redis.get(`reset_token:${resetToken}`);
    if (!userId) throw new Error("Reset link is invalid or has expired");

    const user = await repo.findById(userId);
    if (!user || !["teacher", "admin"].includes(user.role)) {
      await redis.del(`reset_token:${resetToken}`);
      throw new Error("Reset link is invalid or has expired");
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await repo.updatePassword(userId, hashed);

    // Invalidate token and any active sessions
    await redis.del(`reset_token:${resetToken}`);
    await redis.del(`refresh:${userId}`);

    // Send confirmation email (non-blocking)
    sendPasswordChangedEmail({ to: user.email, name: user.name }).catch(() => {})

    return { message: "Password reset successfully" };
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
        ...(user.role === "teacher" && { isSubjectTeacher: Boolean(user.isSubjectTeacher) }),
      },
    };
  }
}

module.exports = new AuthService();
