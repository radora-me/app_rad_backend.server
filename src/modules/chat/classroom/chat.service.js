const repo = require("./chat.repository");

class ClassroomChatService {
  _serializeRoom(course, role) {
    if (!course) return null;

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      teacherName: course.teacher?.name || "Teacher",
      memberCount: course._count?.enrollments || 0,
      messageCount: course._count?.chatMessages || 0,
      role,
    };
  }

  _serializeMessage(message) {
    if (!message) return null;

    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      sender: {
        id: message.sender?.id,
        name: message.sender?.name || "Unknown",
        role: message.sender?.role || "student",
        profilePhotoUrl: message.sender?.profilePhotoUrl || null,
      },
    };
  }

  async listRooms(userId, userRole) {
    if (userRole === "teacher") {
      const courses = await repo.listTeacherRooms(userId);
      return courses.map((course) => this._serializeRoom(course, "teacher"));
    }

    const enrollments = await repo.listStudentRooms(userId);

    return enrollments
      .map((enrollment) => enrollment.course)
      .map((course) => this._serializeRoom(course, "student"));
  }

  async _assertAccess(userId, userRole, courseId) {
    if (userRole === "teacher") {
      const course = await repo.findTeacherCourse(courseId, userId);

      if (!course) {
        throw new Error("Unauthorized classroom access");
      }

      return course;
    }

    const enrollment = await repo.findStudentCourse(courseId, userId);

    if (!enrollment) {
      throw new Error("Unauthorized classroom access");
    }

    return enrollment.course;
  }

  async getRoomMessages(userId, userRole, courseId, limit = 100) {
    const course = await this._assertAccess(userId, userRole, courseId);
    const messages = await repo.listMessages(courseId, limit);

    return {
      room: this._serializeRoom(course, userRole),
      messages: messages.map((message) => this._serializeMessage(message)),
    };
  }

  async sendMessage(userId, userRole, courseId, content) {
    const text = String(content || "").trim();

    if (!text) {
      throw new Error("Message cannot be empty");
    }

    if (text.length > 1000) {
      throw new Error("Message is too long");
    }

    await this._assertAccess(userId, userRole, courseId);

    const message = await repo.createMessage({
      courseId,
      senderId: userId,
      content: text,
    });

    return this._serializeMessage(message);
  }
}

module.exports = new ClassroomChatService();
