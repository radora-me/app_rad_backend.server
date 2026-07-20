const path = require("path");

const repo = require("./homework.repository");
const { uploadBuffer, deleteFile } = require("../../core/storage/cloudinary");
const prisma = require("../../core/database/prisma");
const { sendHomeworkEmail } = require("../../shared/utils/send.homework.email");

const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = Object.freeze([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
]);

class HomeworkService {
  async _sendHomeworkEmails(homework) {
    try {
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: homework.course.id },
        select: {
          student: {
            select: {
              id: true,
              name: true,
              className: true,
              studentProfile: { select: { parentEmail: true, parentName: true } },
            },
          },
        },
      })

      for (const { student } of enrollments) {
        const parentEmail = student.studentProfile?.parentEmail
        if (!parentEmail) continue

        sendHomeworkEmail({
          to: parentEmail,
          parentName: student.studentProfile?.parentName || null,
          studentName: student.name,
          className: student.className || '',
          homeworkTitle: homework.title,
          description: homework.description || null,
          instructions: homework.instructions || null,
          dueAt: homework.dueAt || null,
          teacherName: homework.teacher?.name || '',
          courseName: homework.course?.title || '',
          attachments: homework.attachments || [],
        }).catch(() => {})
      }
    } catch {
      // never break homework creation
    }
  }

  async createHomework(teacherId, data) {
    const course = await repo.findTeacherCourse(teacherId, data.courseId);

    if (!course) {
      throw new Error("Unauthorized course access");
    }

    const uploadedFiles =
      Array.isArray(data.attachments) && data.attachments.length
        ? await this._uploadAttachments(data.attachments)
        : [];

    const created = await repo.transaction(async (tx) => {
      const homework = await tx.homework.create({
        data: {
          title: data.title.trim(),
          description: data.description?.trim() || null,
          instructions: data.instructions?.trim() || null,
          dueAt: data.dueAt ? new Date(data.dueAt) : null,
          allowLateSubmission: data.allowLateSubmission ?? false,
          totalMarks: data.totalMarks ?? null,
          status: data.status ?? "PUBLISHED",
          courseId: data.courseId,
          teacherId,
        },
      });

      if (uploadedFiles.length) {
        await this._saveAttachments(tx, teacherId, homework.id, uploadedFiles);
      }

      const result = await tx.homework.findUnique({
        where: { id: homework.id },
        include: repo.include(),
      });

      return this._toPayload(result);
    });

    this._sendHomeworkEmails(created).catch(() => {});
    return created;
  }

  async _uploadAttachments(attachments) {
    if (attachments.length > MAX_ATTACHMENTS) {
      throw new Error("Maximum 10 attachments allowed");
    }

    const uploaded = [];

    for (const attachment of attachments) {
      if (!attachment.fileName) {
        throw new Error("Attachment filename is required");
      }

      if (!attachment.base64) {
        throw new Error("Attachment content is missing");
      }

      if (!ALLOWED_MIME_TYPES.includes(attachment.mimeType)) {
        throw new Error("Unsupported attachment type");
      }

      const buffer = Buffer.from(attachment.base64, "base64");

      if (buffer.length > MAX_FILE_SIZE) {
        throw new Error("Attachment size cannot exceed 10 MB");
      }

      const safeName = this._safeFileName(attachment.fileName);

      const result = await uploadBuffer(buffer, {
        folder: "homework",
        public_id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`,
        resource_type: "raw",
        use_filename: false,
      });

      uploaded.push({
        originalName: attachment.fileName,
        mimeType: attachment.mimeType || "application/octet-stream",
        extension: path.extname(attachment.fileName) || null,
        size: buffer.length,
        publicId: result.public_id,
        secureUrl: result.secure_url,
      });
    }

    return uploaded;
  }

  async _saveAttachments(tx, teacherId, homeworkId, uploadedFiles) {
    for (const item of uploadedFiles) {
      const file = await tx.file.create({
        data: {
          fileName: item.publicId,
          originalName: item.originalName,
          mimeType: item.mimeType,
          extension: item.extension,
          size: item.size,
          storagePath: item.publicId,
          publicUrl: item.secureUrl,
          uploadedById: teacherId,
        },
      });

      await tx.homeworkAttachment.create({
        data: { homeworkId, fileId: file.id },
      });
    }
  }

  async _saveSubmissionAttachments(
    tx,
    uploadedById,
    submissionId,
    uploadedFiles,
  ) {
    for (const item of uploadedFiles) {
      const file = await tx.file.create({
        data: {
          fileName: item.publicId,
          originalName: item.originalName,
          mimeType: item.mimeType,
          extension: item.extension,
          size: item.size,
          storagePath: item.publicId,
          publicUrl: item.secureUrl,
          uploadedById,
        },
      });

      await tx.submissionAttachment.create({
        data: {
          submissionId,
          fileId: file.id,
        },
      });
    }
  }

  _safeFileName(fileName) {
    const safeName = fileName
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 160);

    return safeName || "attachment";
  }

  async updateHomework(teacherId, homeworkId, data) {
    const homework = await repo.findAccessibleForTeacher(teacherId, homeworkId);

    if (!homework) {
      throw new Error("Homework not found");
    }

    const uploadedFiles =
      Array.isArray(data.attachments) && data.attachments.length
        ? await this._uploadAttachments(data.attachments)
        : [];

    return repo.transaction(async (tx) => {
      const updateData = {};

      if (data.title !== undefined) updateData.title = data.title.trim();
      if (data.description !== undefined)
        updateData.description = data.description.trim();
      if (data.instructions !== undefined)
        updateData.instructions = data.instructions.trim();
      if (data.dueAt !== undefined)
        updateData.dueAt = data.dueAt ? new Date(data.dueAt) : null;
      if (data.allowLateSubmission !== undefined)
        updateData.allowLateSubmission = data.allowLateSubmission;
      if (data.totalMarks !== undefined)
        updateData.totalMarks = data.totalMarks;
      if (data.status !== undefined) updateData.status = data.status;

      await tx.homework.update({
        where: { id: homeworkId },
        data: updateData,
      });

      if (uploadedFiles.length) {
        const existingAttachments = await tx.homeworkAttachment.findMany({
          where: { homeworkId },
          include: { file: true },
        });

        for (const attachment of existingAttachments) {
          try {
            await deleteFile(attachment.file.storagePath);
          } catch (err) {
            console.error(err);
          }

          await tx.file.delete({ where: { id: attachment.file.id } });
        }

        await tx.homeworkAttachment.deleteMany({ where: { homeworkId } });

        await this._saveAttachments(tx, teacherId, homeworkId, uploadedFiles);
      }

      const updated = await tx.homework.findUnique({
        where: { id: homeworkId },
        include: repo.include(),
      });

      return this._toPayload(updated);
    });
  }

  async deleteHomework(teacherId, homeworkId) {
    const homework = await repo.findAccessibleForTeacher(teacherId, homeworkId);

    if (!homework) {
      throw new Error("Homework not found");
    }

    await repo.transaction(async (tx) => {
      const attachments = await tx.homeworkAttachment.findMany({
        where: { homeworkId },
        include: { file: true },
      });

      for (const attachment of attachments) {
        try {
          await deleteFile(attachment.file.storagePath);
        } catch (err) {
          console.error(err);
        }

        await tx.file.delete({ where: { id: attachment.file.id } });
      }

      await tx.homeworkAttachment.deleteMany({ where: { homeworkId } });
      await tx.homework.delete({ where: { id: homeworkId } });
    });

    return { message: "Homework deleted successfully" };
  }

  async listForTeacher(teacherId) {
    const homework = await repo.listForTeacher(teacherId);
    return homework.map((item) => this._toPayload(item));
  }

  async listForStudent(studentId) {
    const homework = await repo.listForStudent(studentId);
    return homework.map((item) => this._toStudentPayload(item, studentId));
  }

  async getHomeworkForTeacher(teacherId, homeworkId) {
    const homework = await repo.findAccessibleForTeacher(teacherId, homeworkId);

    if (!homework) {
      throw new Error("Homework not found");
    }

    return this._toPayload(homework);
  }

  async getHomeworkForStudent(studentId, homeworkId) {
    const homework = await repo.findAccessibleForStudent(studentId, homeworkId);

    if (!homework) {
      throw new Error("Homework not found");
    }

    return this._toStudentPayload(homework, studentId);
  }

  async getDownloadForTeacher(teacherId, homeworkId, fileId) {
    const homework = await repo.findAccessibleForTeacher(teacherId, homeworkId);

    if (!homework) {
      throw new Error("Homework not found");
    }

    const attachment = homework.attachments.find(
      (item) => item.file.id === fileId,
    );

    if (!attachment) {
      throw new Error("Attachment not found");
    }

    return {
      url: attachment.file.publicUrl,
      fileName: attachment.file.originalName,
      mimeType: attachment.file.mimeType,
    };
  }

  async getDownloadForStudent(studentId, homeworkId, fileId) {
    const homework = await repo.findAccessibleForStudent(studentId, homeworkId);

    if (!homework) {
      throw new Error("Homework not found");
    }

    const attachment = homework.attachments.find(
      (item) => item.file.id === fileId,
    );

    if (!attachment) {
      throw new Error("Attachment not found");
    }

    return {
      url: attachment.file.publicUrl,
      fileName: attachment.file.originalName,
      mimeType: attachment.file.mimeType,
    };
  }

  async submitHomework(studentId, homeworkId, data) {
    const homework = await repo.findAccessibleForStudent(studentId, homeworkId);

    if (!homework) {
      throw new Error("Homework not found");
    }

    const textSubmission = data.textSubmission?.trim() || "";
    const attachmentPayloads = Array.isArray(data.attachments)
      ? data.attachments
      : [];

    if (!textSubmission && attachmentPayloads.length === 0) {
      throw new Error("Please add submission text or at least one attachment");
    }

    const now = new Date();
    const isLate = Boolean(homework.dueAt) && now > new Date(homework.dueAt);

    const currentSubmission = await repo.findSubmissionForStudent(
      studentId,
      homeworkId,
    );

    if (currentSubmission) {
      const reopenedAt = homework.resubmissionOpenedAt
        ? new Date(homework.resubmissionOpenedAt)
        : null;

      if (!reopenedAt || reopenedAt <= new Date(currentSubmission.submittedAt)) {
        throw new Error("Assignment has already been submitted");
      }
    } else if (isLate && !homework.allowLateSubmission) {
      throw new Error("Submission window is closed for this homework");
    }

    const uploadedFiles = attachmentPayloads.length
      ? await this._uploadAttachments(attachmentPayloads)
      : [];

    return repo.transaction(async (tx) => {
      const existing = await tx.homeworkSubmission.findUnique({
        where: {
          homeworkId_studentId: {
            homeworkId,
            studentId,
          },
        },
        include: {
          attachments: {
            include: {
              file: true,
            },
          },
        },
      });

      if (existing) {
        const reopenedAt = homework.resubmissionOpenedAt
          ? new Date(homework.resubmissionOpenedAt)
          : null;
        const submittedAt = new Date(existing.submittedAt);

        if (!reopenedAt || reopenedAt <= submittedAt) {
          throw new Error("Assignment has already been submitted");
        }
      }

      let submissionId = existing?.id;

      if (!submissionId) {
        const created = await tx.homeworkSubmission.create({
          data: {
            homeworkId,
            studentId,
            textSubmission: textSubmission || null,
            submittedAt: now,
            status: isLate ? "LATE" : "SUBMITTED",
            marks: null,
            feedback: null,
            gradedAt: null,
            gradedById: null,
          },
        });

        submissionId = created.id;
      } else {
        for (const item of existing.attachments) {
          try {
            await deleteFile(item.file.storagePath);
          } catch (err) {
            console.error(err);
          }

          await tx.file.delete({ where: { id: item.file.id } });
        }

        await tx.submissionAttachment.deleteMany({
          where: {
            submissionId,
          },
        });

        await tx.homeworkSubmission.update({
          where: {
            id: submissionId,
          },
          data: {
            textSubmission: textSubmission || null,
            submittedAt: now,
            status: isLate ? "LATE" : "SUBMITTED",
            marks: null,
            feedback: null,
            gradedAt: null,
            gradedById: null,
          },
        });
      }

      if (uploadedFiles.length) {
        await this._saveSubmissionAttachments(
          tx,
          studentId,
          submissionId,
          uploadedFiles,
        );
      }

      const updatedSubmission = await tx.homeworkSubmission.findUnique({
        where: {
          id: submissionId,
        },
        include: repo.submissionInclude(),
      });

      return this._toSubmissionPayload(updatedSubmission);
    });
  }

  async getStudentSubmission(studentId, homeworkId) {
    const homework = await repo.findAccessibleForStudent(studentId, homeworkId);

    if (!homework) {
      throw new Error("Homework not found");
    }

    const submission = await repo.findSubmissionForStudent(
      studentId,
      homeworkId,
    );

    if (!submission) {
      return null;
    }

    return this._toSubmissionPayload(submission);
  }

  async listSubmissionsForTeacher(teacherId, homeworkId) {
    const homework = await repo.findHomeworkWithRosterForTeacher(
      teacherId,
      homeworkId,
    );

    if (!homework) {
      throw new Error("Homework not found");
    }

    const submissionByStudent = new Map(
      (homework.submissions || []).map((item) => [item.studentId, item]),
    );

    const rows = (homework.course.enrollments || []).map((enrollment) => {
      const student = enrollment.student;
      const submission = submissionByStudent.get(student.id) || null;

      return {
        student: {
          id: student.id,
          name: student.name,
          rollNumber: student.rollNumber,
          className: student.className,
          profilePhotoUrl: student.profilePhotoUrl,
        },
        status: submission?.status || "PENDING",
        hasSubmission: Boolean(submission),
        submission: submission ? this._toSubmissionPayload(submission) : null,
      };
    });

    const submittedCount = rows.filter((item) => item.hasSubmission).length;
    const gradedCount = rows.filter(
      (item) => item.submission?.status === "GRADED",
    ).length;

    return {
      homework: this._toPayload(homework),
      totalStudents: rows.length,
      submittedCount,
      gradedCount,
      pendingCount: rows.length - submittedCount,
      students: rows,
    };
  }

  async gradeSubmission(teacherId, homeworkId, studentId, data) {
    const homework = await repo.findAccessibleForTeacher(teacherId, homeworkId);

    if (!homework) {
      throw new Error("Homework not found");
    }

    if (
      homework.totalMarks !== null &&
      homework.totalMarks !== undefined &&
      data.marks > homework.totalMarks
    ) {
      throw new Error(
        `Marks cannot exceed total marks (${homework.totalMarks})`,
      );
    }

    const submission = await repo.findSubmissionForTeacher(
      teacherId,
      homeworkId,
      studentId,
    );

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (submission.status === "GRADED") {
      throw new Error("Submission has already been graded");
    }

    const updated = await repo.transaction(async (tx) => {
      const result = await tx.homeworkSubmission.updateMany({
        where: {
          id: submission.id,
          status: {
            not: "GRADED",
          },
        },
        data: {
          marks: data.marks,
          feedback: data.feedback?.trim() || null,
          status: "GRADED",
          gradedAt: new Date(),
          gradedById: teacherId,
        },
      });

      if (result.count !== 1) {
        throw new Error("Submission has already been graded");
      }

      return tx.homeworkSubmission.findUnique({
        where: {
          id: submission.id,
        },
        include: repo.submissionInclude(),
      });
    });

    return this._toSubmissionPayload(updated);
  }

  async reopenResubmissions(teacherId, homeworkId) {
    const homework = await repo.findAccessibleForTeacher(teacherId, homeworkId);

    if (!homework) {
      throw new Error("Homework not found");
    }

    if (homework.status !== "PUBLISHED") {
      throw new Error(
        "Homework must be published before reopening resubmissions",
      );
    }

    const updated = await repo.update(homeworkId, {
      resubmissionOpenedAt: new Date(),
    });

    return this._toPayload(updated);
  }

  async getSubmissionDownloadForTeacher(
    teacherId,
    homeworkId,
    studentId,
    fileId,
  ) {
    const submission = await repo.findSubmissionForTeacher(
      teacherId,
      homeworkId,
      studentId,
    );

    if (!submission) {
      throw new Error("Submission not found");
    }

    const attachment = (submission.attachments || []).find(
      (item) => item.file.id === fileId,
    );

    if (!attachment) {
      throw new Error("Attachment not found");
    }

    return {
      url: attachment.file.publicUrl,
      fileName: attachment.file.originalName,
      mimeType: attachment.file.mimeType,
    };
  }

  async getSubmissionDownloadForStudent(studentId, homeworkId, fileId) {
    const submission = await repo.findSubmissionForStudent(
      studentId,
      homeworkId,
    );

    if (!submission) {
      throw new Error("Submission not found");
    }

    const attachment = (submission.attachments || []).find(
      (item) => item.file.id === fileId,
    );

    if (!attachment) {
      throw new Error("Attachment not found");
    }

    return {
      url: attachment.file.publicUrl,
      fileName: attachment.file.originalName,
      mimeType: attachment.file.mimeType,
    };
  }

  _toPayload(homework) {
    return {
      id: homework.id,
      title: homework.title,
      description: homework.description,
      instructions: homework.instructions,
      dueAt: homework.dueAt,
      allowLateSubmission: homework.allowLateSubmission,
      resubmissionOpenedAt: homework.resubmissionOpenedAt,
      totalMarks: homework.totalMarks,
      status: homework.status,
      createdAt: homework.createdAt,
      updatedAt: homework.updatedAt,
      teacher: homework.teacher,
      course: homework.course,
      attachments: (homework.attachments ?? []).map((item) => ({
        id: item.file.id,
        fileName: item.file.originalName,
        mimeType: item.file.mimeType,
        size: item.file.size,
        publicUrl: item.file.publicUrl,
        downloadUrl: `/homework/${homework.id}/attachments/${item.file.id}`,
      })),
      submissionsCount: (homework.submissions ?? []).length,
      gradedCount: (homework.submissions ?? []).filter(
        (item) => item.status === "GRADED",
      ).length,
    };
  }

  _toStudentPayload(homework, studentId) {
    const payload = this._toPayload(homework);
    const ownSubmission = (homework.submissions || []).find(
      (item) => item.studentId === studentId,
    );
    const now = new Date();
    const isLate =
      Boolean(homework.dueAt) && now > new Date(homework.dueAt);
    const submissionWindowOpen =
      homework.status === "PUBLISHED" &&
      (!isLate || homework.allowLateSubmission);
    const reopenedAt = homework.resubmissionOpenedAt
      ? new Date(homework.resubmissionOpenedAt)
      : null;
    const canResubmit =
      Boolean(ownSubmission) &&
      homework.status === "PUBLISHED" &&
      Boolean(reopenedAt) &&
      reopenedAt > new Date(ownSubmission.submittedAt);

    return {
      ...payload,
      canSubmit: !ownSubmission && submissionWindowOpen,
      canResubmit,
      mySubmission: ownSubmission
        ? this._toSubmissionPayload(ownSubmission)
        : null,
    };
  }

  _toSubmissionPayload(submission) {
    if (!submission) {
      return null;
    }

    return {
      id: submission.id,
      studentId: submission.studentId,
      student: submission.student
        ? {
            id: submission.student.id,
            name: submission.student.name,
            rollNumber: submission.student.rollNumber,
            className: submission.student.className,
            profilePhotoUrl: submission.student.profilePhotoUrl,
          }
        : undefined,
      textSubmission: submission.textSubmission,
      submittedAt: submission.submittedAt,
      status: submission.status,
      marks: submission.marks,
      feedback: submission.feedback,
      gradedAt: submission.gradedAt,
      gradedBy: submission.gradedBy
        ? {
            id: submission.gradedBy.id,
            name: submission.gradedBy.name,
            email: submission.gradedBy.email,
          }
        : null,
      attachments: (submission.attachments || []).map((item) => ({
        id: item.file.id,
        fileName: item.file.originalName,
        mimeType: item.file.mimeType,
        size: item.file.size,
        publicUrl: item.file.publicUrl,
      })),
    };
  }
}

module.exports = new HomeworkService();
