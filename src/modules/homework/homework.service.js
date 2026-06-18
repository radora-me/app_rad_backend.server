const path = require("path")

const repo = require("./homework.repository")
const { uploadBuffer, deleteFile } = require("../../core/storage/cloudinary")

const MAX_ATTACHMENTS = 10
const MAX_FILE_SIZE = 10 * 1024 * 1024

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
  "application/zip"
])

class HomeworkService {

  async createHomework(teacherId, data) {
    const course = await repo.findTeacherCourse(teacherId, data.courseId)

    if (!course) {
      throw new Error("Unauthorized course access")
    }

    const uploadedFiles = Array.isArray(data.attachments) && data.attachments.length
      ? await this._uploadAttachments(data.attachments)
      : []

    return repo.transaction(async (tx) => {
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
      })

      if (uploadedFiles.length) {
        await this._saveAttachments(tx, teacherId, homework.id, uploadedFiles)
      }

      const result = await tx.homework.findUnique({
        where: { id: homework.id },
        include: repo.include(),
      })

      return this._toPayload(result)
    })
  }

  async _uploadAttachments(attachments) {
    if (attachments.length > MAX_ATTACHMENTS) {
      throw new Error("Maximum 10 attachments allowed")
    }

    const uploaded = []

    for (const attachment of attachments) {
      if (!attachment.fileName) {
        throw new Error("Attachment filename is required")
      }

      if (!attachment.base64) {
        throw new Error("Attachment content is missing")
      }

      if (!ALLOWED_MIME_TYPES.includes(attachment.mimeType)) {
        throw new Error("Unsupported attachment type")
      }

      const buffer = Buffer.from(attachment.base64, "base64")

      if (buffer.length > MAX_FILE_SIZE) {
        throw new Error("Attachment size cannot exceed 10 MB")
      }

      const safeName = this._safeFileName(attachment.fileName)

      const result = await uploadBuffer(buffer, {
        folder: "homework",
        public_id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`,
        resource_type: "raw",
        use_filename: false,
      })

      uploaded.push({
        originalName: attachment.fileName,
        mimeType: attachment.mimeType || "application/octet-stream",
        extension: path.extname(attachment.fileName) || null,
        size: buffer.length,
        publicId: result.public_id,
        secureUrl: result.secure_url,
      })
    }

    return uploaded
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
      })

      await tx.homeworkAttachment.create({
        data: { homeworkId, fileId: file.id },
      })
    }
  }

  _safeFileName(fileName) {
    const safeName = fileName
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 160)

    return safeName || "attachment"
  }

  async updateHomework(teacherId, homeworkId, data) {
    const homework = await repo.findAccessibleForTeacher(teacherId, homeworkId)

    if (!homework) {
      throw new Error("Homework not found")
    }

    const uploadedFiles = Array.isArray(data.attachments) && data.attachments.length
      ? await this._uploadAttachments(data.attachments)
      : []

    return repo.transaction(async (tx) => {
      const updateData = {}

      if (data.title !== undefined) updateData.title = data.title.trim()
      if (data.description !== undefined) updateData.description = data.description.trim()
      if (data.instructions !== undefined) updateData.instructions = data.instructions.trim()
      if (data.dueAt !== undefined) updateData.dueAt = data.dueAt ? new Date(data.dueAt) : null
      if (data.allowLateSubmission !== undefined) updateData.allowLateSubmission = data.allowLateSubmission
      if (data.totalMarks !== undefined) updateData.totalMarks = data.totalMarks
      if (data.status !== undefined) updateData.status = data.status

      await tx.homework.update({
        where: { id: homeworkId },
        data: updateData,
      })

      if (uploadedFiles.length) {
        const existingAttachments = await tx.homeworkAttachment.findMany({
          where: { homeworkId },
          include: { file: true },
        })

        for (const attachment of existingAttachments) {
          try {
            await deleteFile(attachment.file.storagePath)
          } catch (err) {
            console.error(err)
          }

          await tx.file.delete({ where: { id: attachment.file.id } })
        }

        await tx.homeworkAttachment.deleteMany({ where: { homeworkId } })

        await this._saveAttachments(tx, teacherId, homeworkId, uploadedFiles)
      }

      const updated = await tx.homework.findUnique({
        where: { id: homeworkId },
        include: repo.include(),
      })

      return this._toPayload(updated)
    })
  }

  async deleteHomework(teacherId, homeworkId) {
    const homework = await repo.findAccessibleForTeacher(teacherId, homeworkId)

    if (!homework) {
      throw new Error("Homework not found")
    }

    await repo.transaction(async (tx) => {
      const attachments = await tx.homeworkAttachment.findMany({
        where: { homeworkId },
        include: { file: true },
      })

      for (const attachment of attachments) {
        try {
          await deleteFile(attachment.file.storagePath)
        } catch (err) {
          console.error(err)
        }

        await tx.file.delete({ where: { id: attachment.file.id } })
      }

      await tx.homeworkAttachment.deleteMany({ where: { homeworkId } })
      await tx.homework.delete({ where: { id: homeworkId } })
    })

    return { message: "Homework deleted successfully" }
  }

  async listForTeacher(teacherId) {
    const homework = await repo.listForTeacher(teacherId)
    return homework.map((item) => this._toPayload(item))
  }

  async listForStudent(studentId) {
    const homework = await repo.listForStudent(studentId)
    return homework.map((item) => this._toPayload(item))
  }

  async getHomeworkForTeacher(teacherId, homeworkId) {
    const homework = await repo.findAccessibleForTeacher(teacherId, homeworkId)

    if (!homework) {
      throw new Error("Homework not found")
    }

    return this._toPayload(homework)
  }

  async getHomeworkForStudent(studentId, homeworkId) {
    const homework = await repo.findAccessibleForStudent(studentId, homeworkId)

    if (!homework) {
      throw new Error("Homework not found")
    }

    return this._toPayload(homework)
  }

  async getDownloadForTeacher(teacherId, homeworkId, fileId) {
    const homework = await repo.findAccessibleForTeacher(teacherId, homeworkId)

    if (!homework) {
      throw new Error("Homework not found")
    }

    const attachment = homework.attachments.find(item => item.file.id === fileId)

    if (!attachment) {
      throw new Error("Attachment not found")
    }

    return {
      url: attachment.file.publicUrl,
      fileName: attachment.file.originalName,
      mimeType: attachment.file.mimeType,
    }
  }

  async getDownloadForStudent(studentId, homeworkId, fileId) {
    const homework = await repo.findAccessibleForStudent(studentId, homeworkId)

    if (!homework) {
      throw new Error("Homework not found")
    }

    const attachment = homework.attachments.find(item => item.file.id === fileId)

    if (!attachment) {
      throw new Error("Attachment not found")
    }

    return {
      url: attachment.file.publicUrl,
      fileName: attachment.file.originalName,
      mimeType: attachment.file.mimeType,
    }
  }

  _toPayload(homework) {
    return {
      id: homework.id,
      title: homework.title,
      description: homework.description,
      instructions: homework.instructions,
      dueAt: homework.dueAt,
      allowLateSubmission: homework.allowLateSubmission,
      totalMarks: homework.totalMarks,
      status: homework.status,
      createdAt: homework.createdAt,
      updatedAt: homework.updatedAt,
      teacher: homework.teacher,
      course: homework.course,
      attachments: (homework.attachments ?? []).map(item => ({
        id: item.file.id,
        fileName: item.file.originalName,
        mimeType: item.file.mimeType,
        size: item.file.size,
        publicUrl: item.file.publicUrl,
        downloadUrl: `/homework/${homework.id}/attachments/${item.file.id}`
      })),
      submissionsCount: (homework.submissions ?? []).length,
      gradedCount: (homework.submissions ?? []).filter(item => item.status === "GRADED").length
    }
  }
}

module.exports = new HomeworkService()
