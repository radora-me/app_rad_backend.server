const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const repo = require("./auth.repository");
const prisma = require("../../core/database/prisma");
const jwtService = require("../../core/utils/jwt.utils");
const redis = require("../../core/cache/redis");
const { sendPasswordResetEmail } = require("../../shared/utils/send.reset.email");
const { sendPasswordChangedEmail } = require("../../shared/utils/send.password.changed.email");
const { uploadBuffer } = require("../../core/storage/cloudinary");
const { resolveClassName, safeClassName } = require("../../shared/utils/display-labels");

class AuthService {
  _toCoursePayload(course) {
    return {
      courseId: course.id,
      className: safeClassName(course.title),
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

    const trimmedPassword = (password || "").replace(/^\s+|\s+$/g, "");
    const match = await bcrypt.compare(trimmedPassword, user.password);
    if (!match) throw new Error("Invalid credentials");

    return this._issueTokens(user);
  }

  async login({ identifier, password }) {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = await repo.findByIdentifier(normalizedIdentifier);

    if (!user || !["student", "teacher", "admin", "librarian"].includes(user.role)) {
      throw new Error("Invalid credentials");
    }

    const trimmedPassword = (password || "").replace(/^\s+|\s+$/g, "");
    const match = await bcrypt.compare(trimmedPassword, user.password);
    if (!match) throw new Error("Invalid credentials");

    if (user.role === "teacher") {
      user.isSubjectTeacher = !(await repo.hasOwnedCourses(user.id));
    }

    return this._issueTokens(user);
  }

  async getCurrentUser(userId) {
    // Try Redis cache first (5 min TTL)
    const cacheKey = `user_profile:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fall through to DB */ }
    }

    const user = await repo.findById(userId);
    if (!user || !["student", "teacher", "admin", "librarian"].includes(user.role)) {
      throw new Error("User not found");
    }

    const profile = {
      id: user.id,
      name: user.name,
      email: user.email || null,
      rollNumber: user.rollNumber || null,
      role: user.role,
      profilePhotoUrl: user.profilePhotoUrl || null,
    };

    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(profile), "EX", 300);
    return profile;
  }

  async teacherLogin({ email, password }) {
    const user = await repo.findByEmail(email);
    if (!user || !["teacher", "admin"].includes(user.role))
      throw new Error("Invalid credentials");

    const trimmedPassword = (password || "").replace(/^\s+|\s+$/g, "");
    const match = await bcrypt.compare(trimmedPassword, user.password);
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

  async createLibrarian({ name, email, password }, adminId) {
    const existing = await repo.findByEmail(email.trim().toLowerCase());
    if (existing) throw new Error("Email already exists");
    const hashed = await bcrypt.hash(password, 12);
    const user = await repo.create({ name: name.trim(), email: email.trim().toLowerCase(), password: hashed, role: "librarian" });
    return { message: "Librarian created", userId: user.id };
  }

  async listLibrarians() {
    return prisma.user.findMany({ where: { role: "librarian" }, select: { id: true, name: true, email: true, address: true, profilePhotoUrl: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  }

  async deleteLibrarian(librarianId) {
    const user = await prisma.user.findFirst({ where: { id: librarianId, role: "librarian" } });
    if (!user) throw new Error("Librarian not found");
    await prisma.user.delete({ where: { id: librarianId } });
    return { message: "Librarian deleted" };
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
    const student = await repo.findByRollNumber(String(rollNumber || "").trim());

    if (!student || student.role !== "student") {
      throw new Error("Student not found");
    }

    return {
      name: student.name,
      email: student.email || null,
      rollNumber: student.rollNumber,
      className: resolveClassName(student),
      parentName: student.studentProfile?.parentName || null,
      parentPhone: student.studentProfile?.parentPhone || null,
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

  async getOwnTeacherProfile(teacherId) {
    const teacher = await repo.findTeacherById(teacherId);
    if (!teacher) throw new Error("Teacher not found");
    return this._toTeacherPayload(teacher, false);
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
      ...(address !== undefined && { address: address.trim() }),
    });
    await redis.del(`user_profile:${teacherId}`);
    return this._toTeacherPayload(updated);
  }

  async getAdminProfile(adminId) {
    const admin = await repo.findAdminById(adminId);
    if (!admin) throw new Error("Admin not found");
    return { name: admin.name, email: admin.email, role: admin.role, profilePhotoUrl: admin.profilePhotoUrl || null };
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
    await redis.del(`user_profile:${adminId}`);
    return { name: updated.name, email: updated.email, role: updated.role, profilePhotoUrl: updated.profilePhotoUrl || null };
  }

  async uploadOwnProfilePhoto(userId, role, file) {
    if (!file) throw new Error("Profile photo is required");
    if (!["teacher", "admin", "librarian"].includes(role)) throw new Error("Students cannot upload their own profile photo");
    const user = await repo.findById(userId);
    if (!user || user.role !== role) throw new Error("User not found");
    const upload = await uploadBuffer(file.buffer, {
      folder: "radora/profile-photos",
      public_id: userId,
      resource_type: "image",
      overwrite: true,
      invalidate: true,
    });
    const updated = await repo.updateProfilePhoto(userId, upload.secure_url);
    await redis.del(`user_profile:${userId}`);
    return { profilePhotoUrl: updated.profilePhotoUrl };
  }

  _toTeacherPayload(teacher, exposeIds = true) {
    return {
      ...(exposeIds ? { id: teacher.id } : {}),
      name: teacher.name,
      email: teacher.email,
      address: teacher.address || "",
      profilePhotoUrl: teacher.profilePhotoUrl || null,
      courses: (teacher.taughtCourses || []).map((c) => ({
        ...(exposeIds ? { id: c.id } : {}),
        title: safeClassName(c.title),
        description: c.description || "",
        section: c.description || "",
        studentCount: c._count?.enrollments || 0,
        _count: { enrollments: c._count?.enrollments || 0 },
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
    await redis.del(`user_profile:${userId}`);
    return { message: "Logged out successfully" };
  }

  async forgotPassword(identifier) {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = await repo.findByIdentifier(normalizedIdentifier);

    if (!user || !["student", "teacher", "admin"].includes(user.role)) {
      throw new Error("No account found for the provided email or roll number");
    }

    const recipient = user.role === "student"
      ? user.studentProfile?.parentEmail
      : user.email;

    if (!recipient) {
      throw new Error("No recovery email is configured for this account");
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Store OTP and resetToken in Redis — 10 min TTL
    await redis.set(`otp:${normalizedIdentifier}`, otp, "EX", 600);
    await redis.set(`reset_token:${resetToken}`, user.id, "EX", 600);

    await sendPasswordResetEmail({
      to: recipient,
      name: user.name,
      otp,
      resetToken,
    });

    return { message: "A verification code has been sent to the registered recovery address." };
  }

  async verifyOtp(identifier, otp) {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const attemptsKey = `otp_attempts:${normalizedIdentifier}`;
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) await redis.expire(attemptsKey, 600);
    if (attempts > 5) throw new Error("Invalid or expired OTP");

    const storedOtp = await redis.get(`otp:${normalizedIdentifier}`);

    if (!storedOtp || storedOtp !== otp.trim()) {
      throw new Error("Invalid or expired OTP");
    }

    const user = await repo.findByIdentifier(normalizedIdentifier);
    if (!user || !["student", "teacher", "admin"].includes(user.role)) {
      throw new Error("Invalid or expired OTP");
    }

    // OTP verified — issue a short-lived reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    await redis.set(`reset_token:${resetToken}`, user.id, "EX", 600);
    await redis.del(`otp:${normalizedIdentifier}`);
    await redis.del(attemptsKey);

    return { resetToken };
  }

  async verifyResetLink(resetToken) {
    const userId = await redis.get(`reset_token:${resetToken}`);
    if (!userId) throw new Error("Reset link is invalid or has expired");

    const user = await repo.findById(userId);
    if (!user || !["student", "teacher", "admin"].includes(user.role)) {
      await redis.del(`reset_token:${resetToken}`);
      throw new Error("Reset link is invalid or has expired");
    }

    return { message: "Reset link verified" };
  }

  async resetPassword(resetToken, newPassword) {
    const userId = await redis.get(`reset_token:${resetToken}`);
    if (!userId) throw new Error("Reset link is invalid or has expired");

    const user = await repo.findById(userId);
    if (!user || !["student", "teacher", "admin"].includes(user.role)) {
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
        ...(user.className && { className: safeClassName(user.className) }),
        ...(user.profilePhotoUrl && { profilePhotoUrl: user.profilePhotoUrl }),
        ...(user.role === "teacher" && { isSubjectTeacher: Boolean(user.isSubjectTeacher) }),
      ...(user.role === "librarian" && { isLibrarian: true }),
      },
    };
  }
}

module.exports = new AuthService();
