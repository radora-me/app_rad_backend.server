const crypto = require("crypto");

const profileRepo = require("../modules/users/students/profile/profile.repository");
const attendanceRepo = require("../modules/users/students/attendance/attendance.repository");
const {
  buildAttendanceSummary,
} = require("../modules/users/students/attendance/helpers/attendanceAnalytics");
const redis = require("../core/cache/redis");

class StudentAiTutorService {
  constructor() {
    this.hfRetryAt = 0;
    this.hfRetryReason = null;
    this.responseCacheTtlSeconds = 60 * 60 * 24;
    this.fallbackCacheTtlSeconds = 60 * 60;
    this.hfRequestTimeoutMs = 10000;
    this.hfLatencyEmaMs = 9000;
  }

  _formatDate(value) {
    if (!value) return "Unknown date";

    const date = value instanceof Date ? value : new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }

    if (typeof value === "string") {
      return value.slice(0, 10);
    }

    return String(value);
  }

  async getContext(studentId) {
    const student = await this._getStudent(studentId);
    const attendance = await this._getAttendanceSnapshot(studentId);

    return {
      student: this._buildStudentProfile(student),
      attendance,
      suggestedPrompts: this._buildSuggestedPrompts(student, attendance),
    };
  }

  async chat(studentId, payload) {
    const message = (payload?.message || "").trim();
    const history = Array.isArray(payload?.history) ? payload.history : [];

    if (!message) {
      throw new Error("Message is required");
    }

    const student = await this._getStudent(studentId);
    const attendance = await this._getAttendanceSnapshot(studentId);
    const context = this.getTutorContext(student, attendance);
    const cacheKey = this._buildCacheKey(studentId, context, message, history);
    const cachedReply = await this._getCachedReply(cacheKey);

    if (cachedReply) {
      return {
        ...cachedReply,
        cached: true,
        context,
        suggestedPrompts: this._buildSuggestedPrompts(student, attendance),
      };
    }

    const { reply, usedFallback, fallbackReason } = await this._askHuggingFace(
      context,
      message,
      history,
    );

    const finalReply = usedFallback
      ? `${fallbackReason || "I couldn't reach DeepSeek R1 right now."} ${reply}`
      : reply;

    const responsePayload = {
      reply: finalReply,
      context,
      suggestedPrompts: this._buildSuggestedPrompts(student, attendance),
      usedFallback,
      cached: false,
    };

    if (!usedFallback) {
      await this._setCachedReply(
        cacheKey,
        responsePayload,
        this.responseCacheTtlSeconds,
      );
    }

    return responsePayload;
  }

  async _getStudent(studentId) {
    const student = await profileRepo.findById(studentId);

    if (!student || student.role !== "student") {
      throw new Error("Student not found");
    }

    return student;
  }

  async _getAttendanceSnapshot(studentId) {
    const records = await attendanceRepo.getStudentAttendance(studentId);
    const holidays = await attendanceRepo.getHolidays();

    const summary = buildAttendanceSummary(records, holidays);

    if (!summary.records.length) {
      return {
        overallAttendance: 0,
        presentClasses: 0,
        absentClasses: 0,
        leaveClasses: 0,
        streak: 0,
        recentRecords: [],
      };
    }

    return {
      overallAttendance: summary.overallAttendance,
      presentClasses: summary.presentClasses,
      absentClasses: summary.absentClasses,
      leaveClasses: summary.leaveClasses,
      streak: summary.streak,
      recentRecords: summary.records.slice(0, 5).map((record) => ({
        date: this._formatDate(record.date),
        status: record.status,
        subject: record.course?.title || "General",
      })),
    };
  }

  _buildStudentProfile(student) {
    return {
      id: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      className:
        student.className || student.enrollments?.[0]?.course?.title || "",
      section:
        student.section || student.enrollments?.[0]?.course?.description || "",
      courses: (student.enrollments || []).map((enrollment) => ({
        id: enrollment.course.id,
        title: enrollment.course.title,
      })),
    };
  }

  getTutorContext(student, attendance) {
    const profile = this._buildStudentProfile(student);

    return {
      student: profile,
      attendance,
    };
  }

  _buildSuggestedPrompts(student, attendance) {
    const firstCourse =
      student.enrollments?.[0]?.course?.title || "your subjects";
    const attendanceLabel = `${attendance.overallAttendance || 0}%`;

    return [
      `Explain ${firstCourse} in a simple way`,
      `Give me a 5-question quiz on ${firstCourse}`,
      `Help me improve my attendance from ${attendanceLabel}`,
    ];
  }

  _buildPrompt(context, message, history = []) {
    const courseNames = context.student.courses.length
      ? context.student.courses.map((course) => course.title).join(", ")
      : "no enrolled courses yet";

    const recentConversation = history.length
      ? history
          .slice(-6)
          .map((item) => {
            const roleLabel = item.role === "assistant" ? "Tutor" : "Student";
            return `${roleLabel}: ${String(item.content || "").slice(0, 300)}`;
          })
          .join("\n")
      : "No prior conversation.";

    const recentAttendance = context.attendance.recentRecords.length
      ? context.attendance.recentRecords
          .map(
            (record) =>
              `${this._formatDate(record.date)}: ${record.subject} - ${record.status}`,
          )
          .join("\n")
      : "No recent attendance records available.";

    return `You are Radora AI Tutor, a concise, encouraging study assistant for a student app.

Student profile:
- Name: ${context.student.name}
- Roll number: ${context.student.rollNumber || "N/A"}
- Class: ${context.student.className || "N/A"}
- Section: ${context.student.section || "N/A"}
- Courses: ${courseNames}
- Attendance: ${context.attendance.overallAttendance}%
- Present classes: ${context.attendance.presentClasses}
- Leave classes: ${context.attendance.leaveClasses || 0}
- Absent classes: ${context.attendance.absentClasses}
- Streak: ${context.attendance.streak}

Recent attendance:
${recentAttendance}

Recent conversation:
${recentConversation}

Instructions:
- Answer as a patient, practical tutor.
- Use simple language and short sections.
- If the student asks for revision help, give examples and a small practice task.
- If the question is outside academics, politely redirect to study support.
- Keep the response useful, warm, and under 220 words unless more detail is clearly needed.

Student message: ${message}`;
  }

  _getModelCandidates() {
    const envModel = (process.env.HUGGINGFACE_MODEL || "").trim();
    const fallbackModels = ["Qwen/Qwen3-14B"];

    return [envModel, ...fallbackModels].filter(
      (model, index, allModels) => model && allModels.indexOf(model) === index,
    );
  }

  _getHuggingFaceAuthConfig() {
    const apiKey = (process.env.HUGGINGFACE_API_KEY || "").trim();

    if (!apiKey) {
      return null;
    }

    return {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    };
  }

  _normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  _buildContextSignature(context) {
    const data = {
      studentId: context.student.id,
      className: context.student.className || "",
      section: context.student.section || "",
      attendance: context.attendance.overallAttendance,
      streak: context.attendance.streak,
      courses: (context.student.courses || []).map((course) => course.title),
      recentRecords: (context.attendance.recentRecords || []).map((record) => ({
        date: record.date,
        subject: record.subject,
        status: record.status,
      })),
    };

    return crypto.createHash("sha1").update(JSON.stringify(data)).digest("hex");
  }

  _buildConversationSignature(history = []) {
    const data = history.slice(-8).map((item) => ({
      role: item.role,
      content: this._normalizeText(item.content),
    }));

    return crypto.createHash("sha1").update(JSON.stringify(data)).digest("hex");
  }

  _buildCacheKey(studentId, context, message, history = []) {
    const payload = {
      studentId,
      message: this._normalizeText(message),
      context: this._buildContextSignature(context),
      history: this._buildConversationSignature(history),
    };

    return `student:ai:tutor:${crypto
      .createHash("sha1")
      .update(JSON.stringify(payload))
      .digest("hex")}`;
  }

  async _getCachedReply(cacheKey) {
    try {
      const cached = await redis.get(cacheKey);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached);
    } catch (error) {
      console.log("Tutor cache read error:", error.message || error);
      return null;
    }
  }

  async _setCachedReply(cacheKey, value, ttlSeconds) {
    try {
      await redis.set(cacheKey, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      console.log("Tutor cache write error:", error.message || error);
    }
  }

  _getHuggingFaceChatCompletionUrl(model) {
    return `https://router.huggingface.co/v1/chat/completions`;
  }

  _getHfModelName(model) {
    return String(model || "").replace(/:.*$/, "").trim();
  }

  _createTimeoutSignal(timeoutMs) {
    if (
      typeof AbortSignal !== "undefined" &&
      typeof AbortSignal.timeout === "function"
    ) {
      return AbortSignal.timeout(timeoutMs);
    }

    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }

  _scorePromptComplexity(message, history = []) {
    const normalizedMessage = this._normalizeText(message);
    const wordCount = normalizedMessage
      ? normalizedMessage.split(" ").length
      : 0;
    const historyLength = Array.isArray(history) ? history.length : 0;

    let score = 0;

    if (wordCount > 20) score += 1;
    if (wordCount > 40) score += 1;
    if (wordCount > 70) score += 1;
    if (historyLength > 2) score += 1;
    if (historyLength > 5) score += 1;

    const complexKeywords = [
      "explain",
      "why",
      "how",
      "gravity",
      "integral",
      "definite integral",
      "indefinite integral",
      "calculus",
      "logarithm",
      "natural logarithm",
      "ln",
      "sine",
      "cosine",
      "trigonometric",
      "numerical",
      "derive",
      "proof",
      "formula",
      "equation",
      "complex",
      "step by step",
      "steps",
      "solve",
      "calculate",
    ];

    for (const keyword of complexKeywords) {
      if (normalizedMessage.includes(keyword)) {
        score += 1;
      }
    }

    return { score: Math.min(score, 8), wordCount, historyLength };
  }

  _classifyPromptTier(message, history = []) {
    const normalizedMessage = this._normalizeText(message);
    const { score, wordCount, historyLength } = this._scorePromptComplexity(
      message,
      history,
    );

    const heavyMathKeywords = [
      "integral",
      "definite integral",
      "calculus",
      "ln",
      "logarithm",
      "gravity",
      "derivative",
      "differentiation",
      "trigonometric",
    ];

    const isHeavyMath = heavyMathKeywords.some((keyword) =>
      normalizedMessage.includes(keyword),
    );

    if (isHeavyMath || score >= 6 || wordCount > 80 || historyLength > 6) {
      return "heavy";
    }

    if (score >= 3 || wordCount > 35 || historyLength > 3) {
      return "medium";
    }

    return "light";
  }

  _getHfRequestTimeoutMs(message, history = []) {
    const tier = this._classifyPromptTier(message, history);
    const { score, wordCount, historyLength } = this._scorePromptComplexity(
      message,
      history,
    );

    const latencyBudget = Math.min(
      Math.max(Math.round(this.hfLatencyEmaMs * 2.25), 0),
      18000,
    );

    const tierBaseTimeouts = {
      light: 10000,
      medium: 18000,
      heavy: 26000,
    };

    const tierCeilings = {
      light: 18000,
      medium: 30000,
      heavy: 60000,
    };

    const dynamicTimeout =
      (tierBaseTimeouts[tier] || this.hfRequestTimeoutMs) +
      score * 1600 +
      Math.min(Math.max(wordCount - 12, 0) * 100, 8000) +
      Math.min(historyLength * 300, 2500) +
      latencyBudget;

    return Math.min(
      Math.max(dynamicTimeout, tierBaseTimeouts[tier] || 10000),
      tierCeilings[tier] || 30000,
    );
  }

  _updateHfLatencyEstimate(latencyMs) {
    if (!Number.isFinite(latencyMs) || latencyMs <= 0) {
      return;
    }

    this.hfLatencyEmaMs = Math.round(
      this.hfLatencyEmaMs * 0.7 + latencyMs * 0.3,
    );
  }

  async _askHuggingFace(context, message, history = []) {
    const authConfig = this._getHuggingFaceAuthConfig();

    if (!authConfig) {
      return {
        reply: this._buildFallbackReply(context, message),
        usedFallback: true,
        fallbackReason:
          "I couldn't reach DeepSeek R1 because the Hugging Face API key is missing.",
      };
    }

    const now = Date.now();
    if (this.hfRetryAt && now < this.hfRetryAt) {
      return {
        reply: this._buildFallbackReply(context, message),
        usedFallback: true,
        fallbackReason:
          this.hfRetryReason || "DeepSeek R1 is temporarily unavailable.",
      };
    }

    let lastError = null;

    for (const model of this._getModelCandidates()) {
      try {
        const startedAt = Date.now();
        const signal = this._createTimeoutSignal(
          this._getHfRequestTimeoutMs(message, history),
        );
        const response = await fetch(
          this._getHuggingFaceChatCompletionUrl(model),
          {
            method: "POST",
            headers: {
              ...(authConfig.headers || {}),
            },
            signal,
            body: JSON.stringify({
              model: `${model}:fastest`,
              messages: [
                {
                  role: "user",
                  content: this._buildPrompt(context, message, history),
                },
              ],
              stream: false,
            }),
          },
        );

        if (!response.ok) {
          const errorBody = await response.text();
          const modelNotFound =
            response.status === 404 ||
            /not found|not supported|model_not_supported/i.test(errorBody);

          const quotaExceeded =
            response.status === 429 ||
            /quota|rate limit|resource_exhausted/i.test(errorBody);

          const authFailed =
            response.status === 401 ||
            /unauthenticated|invalid authentication|unauthorized/i.test(
              errorBody,
            );

          if (modelNotFound) {
            lastError = new Error(`Model ${model} is not available`);
            continue;
          }

          if (quotaExceeded) {
            const retryDelaySeconds =
              this._extractRetryDelaySeconds(errorBody) || 60;
            this.hfRetryAt = Date.now() + retryDelaySeconds * 1000;
            this.hfRetryReason = `Hugging Face quota exhausted. Backing off for ${retryDelaySeconds}s.`;
            return {
              reply: this._buildFallbackReply(context, message),
              usedFallback: true,
              fallbackReason: "Hugging Face quota is exhausted right now.",
            };
          }

          if (authFailed) {
            this.hfRetryAt = Date.now() + 5 * 60 * 1000;
            this.hfRetryReason =
              "Hugging Face authentication failed. Using fallback tutor.";
            return {
              reply: this._buildFallbackReply(context, message),
              usedFallback: true,
              fallbackReason: "Hugging Face authentication failed.",
            };
          }

          throw new Error(`Hugging Face request failed: ${errorBody}`);
        }

        const data = await response.json();
        const reply =
          this._extractHuggingFaceReply(data) ||
          this._buildFallbackReply(context, message);

        this._updateHfLatencyEstimate(Date.now() - startedAt);

        return { reply, usedFallback: false };
      } catch (error) {
        if (error?.name === "AbortError") {
          this.hfRetryAt = Date.now() + 5 * 1000;
          this.hfRetryReason =
            "DeepSeek R1 took too long to respond. Using a local fallback for a short time.";
          return {
            reply: this._buildFallbackReply(context, message),
            usedFallback: true,
            fallbackReason:
              "DeepSeek R1 is taking too long to respond right now.",
          };
        }

        lastError = error;
      }
    }

    console.error("Hugging Face tutor error:", lastError?.message || lastError);
    return {
      reply: this._buildFallbackReply(context, message),
      usedFallback: true,
      fallbackReason:
        lastError?.message ||
        "DeepSeek R1 request failed and the tutor used a fallback response.",
    };
  }

  _extractHuggingFaceReply(data) {
    if (!data) return null;

    if (typeof data?.choices?.[0]?.message?.content === "string") {
      return data.choices[0].message.content.trim();
    }

    if (typeof data?.choices?.[0]?.delta?.content === "string") {
      return data.choices[0].delta.content.trim();
    }

    if (typeof data.generated_text === "string") {
      return data.generated_text.trim();
    }

    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      if (typeof first?.generated_text === "string") {
        return first.generated_text.trim();
      }
      if (typeof first?.summary_text === "string") {
        return first.summary_text.trim();
      }
      if (typeof first?.text === "string") {
        return first.text.trim();
      }
    }

    if (typeof data.text === "string") {
      return data.text.trim();
    }

    return null;
  }

  _extractRetryDelaySeconds(errorBody) {
    if (!errorBody || typeof errorBody !== "string") {
      return null;
    }

    const retryDelayMatch = errorBody.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
    if (retryDelayMatch?.[1]) {
      const seconds = Number(retryDelayMatch[1]);
      return Number.isNaN(seconds) ? null : seconds;
    }

    return null;
  }

  _buildFallbackReply(context, message) {
    const course = context.student.courses[0]?.title || "your current module";
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("summar") || lowerMessage.includes("revise")) {
      return `Quick revision for ${course}: focus on the main definition, the key steps, and one example. If you want, I can turn this into 3 flashcards.`;
    }

    if (lowerMessage.includes("quiz")) {
      return `Let’s do a quick quiz on ${course}. Start with this: what is the main idea behind the topic you are revising? Reply with your answer and I’ll check it.`;
    }

    if (
      lowerMessage.includes("explain") ||
      lowerMessage.includes("what is") ||
      lowerMessage.includes("how does")
    ) {
      return `Here is a simple explanation of ${course}: start with the core idea, then connect it to one real example from class. If you want, I can break it into 3 easy steps.`;
    }

    if (lowerMessage.includes("attendance")) {
      return `Your attendance is at ${context.attendance.overallAttendance}%. The next best step is to keep a steady routine and avoid missing the first session of the day.`;
    }

    if (
      lowerMessage.includes("homework") ||
      lowerMessage.includes("assignment")
    ) {
      return `For ${course}, I’d solve the first problem by identifying the concept, then write the answer in short points. Send me the question and I’ll help step by step.`;
    }

    if (
      lowerMessage.includes("motivate") ||
      lowerMessage.includes("study plan")
    ) {
      return `Let’s keep it simple for ${course}: 25 minutes study, 5 minutes break, then one quick self-test. That is usually enough to stay consistent.`;
    }

    return `Here is a simple way to study ${course}: read the concept once, write 3 short notes in your own words, then solve one practice question. If you want, I can turn this into a quiz.`;
  }
}

module.exports = new StudentAiTutorService();
