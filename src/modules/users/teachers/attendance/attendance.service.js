const repo = require('./attendance.repository')
const { fullDaySchema, subjectWiseSchema } = require('./attendance.validator')
const prisma = require('../../../../core/database/prisma')
const { sendAttendanceUpdateEmail } = require('../../../../shared/utils/send.attendance.email')
const notificationsService = require('../../../notifications/notifications.service')

class AttendanceService {

  _ensureNotSunday(dateInput) {
    const d = new Date(dateInput)
    if (d.getDay() === 0) {
      throw new Error('Attendance cannot be marked on Sundays')
    }
  }

  async _sendEmailsForStudents(students, courseId) {
    try {
      const studentIds = students.map((s) => s.studentId)

      const records = await prisma.user.findMany({
        where: { id: { in: studentIds } },
        select: {
          id: true,
          name: true,
          studentProfile: { select: { parentEmail: true } },
          enrollments: {
            where: courseId ? { courseId } : undefined,
            orderBy: { createdAt: 'desc' },
            include: { course: { select: { title: true, description: true } } },
            take: 1,
          },
        },
      })

      // Build a status lookup keyed by studentId for O(1) access
      const statusMap = new Map(students.map((s) => [s.studentId, s.status]))

      // ISO date string is locale-independent and consistent across all server environments
      const attendanceDate = new Date().toISOString().split('T')[0]

      const emailPromises = records
        .filter((user) => !!user.studentProfile?.parentEmail)
        .map((user) => {
          const course = user.enrollments?.[0]?.course
          // Course.title is the authoritative class name (set at course creation).
          // User.className is a denormalised copy that may lag or be absent.
          const className = course?.title?.trim() || ''
          const section = course?.description?.trim() || ''

          return sendAttendanceUpdateEmail({
            to: user.studentProfile.parentEmail,
            studentName: user.name,
            className,
            section,
            attendanceDate,
            status: statusMap.get(user.id),
          }).catch((err) => {
            console.error(`Attendance email failed for student ${user.id}:`, err.message)
          })
        })

      await Promise.allSettled(emailPromises)
    } catch (err) {
      // email errors must never break attendance marking
      console.error('_sendEmailsForStudents error:', err.message)
    }
  }

  async _notifyStudentsOfAttendance(students, courseId, savedByName = 'teacher') {
    try {
      const studentIds = [...new Set(students.map((s) => s.studentId))]
      if (!studentIds.length) return

      const studentsWithProfile = await prisma.user.findMany({
        where: { id: { in: studentIds } },
        select: {
          id: true,
          name: true,
          enrollments: {
            where: courseId ? { courseId } : undefined,
            include: { course: { select: { title: true } } },
            take: 1,
          },
        },
      })

      for (const student of studentsWithProfile) {
        const courseTitle = student.enrollments?.[0]?.course?.title || 'your class'
        await notificationsService.sendToUser(
          student.id,
          'Attendance updated',
          `${savedByName} updated ${student.name || 'your'} attendance for ${courseTitle}.`,
          {
            type: 'attendance_update',
            courseId: courseId || null,
          },
        )
      }
    } catch {
      // push failures must not block attendance updates
    }
  }

  async markFullDayAttendance(teacherId, body) {
    const { error, value } = fullDaySchema.validate(body)
    if (error) throw new Error(error.message)

    this._ensureNotSunday(value.date)

    const holiday = await repo.getHolidayByDate(value.date)
    if (holiday) throw new Error(`Cannot mark attendance on a holiday: ${holiday.title}`)

    const courseId = value.courseId || null
    const allowEdit = Boolean(value.allowEdit)

    if (!courseId && !(await repo.hasOwnedCourses(teacherId))) {
      throw new Error('Subject teachers cannot mark attendance')
    }

    if (courseId) {
      const course = await repo.verifyTeacherCourse(courseId, teacherId)
      if (!course) throw new Error('Course not found or not assigned to you')

      const enrolledStudents = await repo.getCourseStudents(courseId)
      const enrolledStudentIds = new Set(enrolledStudents.map((enrollment) => enrollment.student.id))
      if (value.students.some((student) => !enrolledStudentIds.has(student.studentId))) {
        throw new Error('One or more students are not enrolled in this class')
      }
    }

    // Pre-fetch existing records for today so we can honour allowEdit
    const normalizedDate = repo.normalizeDate(value.date)
    const studentIds = value.students.map((s) => s.studentId)
    const existing = await prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        courseId: courseId ?? null,
        date: normalizedDate,
      },
      select: { studentId: true, createdAt: true },
    })
    const existingMap = new Map(existing.map((r) => [r.studentId, r]))

    const results = []

    for (const student of value.students) {
      const existingRecord = existingMap.get(student.studentId)

      // If already marked and caller did not explicitly request an edit, skip
      if (existingRecord && !allowEdit) {
        results.push({ studentId: student.studentId, skipped: true })
        continue
      }

      // If already marked and edit is requested, enforce the 48-hour window
      if (existingRecord && !repo.isWithinEditWindow(existingRecord.createdAt)) {
        results.push({ studentId: student.studentId, skipped: true, reason: 'edit_window_expired' })
        continue
      }

      const record = await repo.upsertAttendance({
        studentId: student.studentId,
        courseId,
        date: value.date,
        mode: 'FULL_DAY',
        status: student.status,
        markedBy: teacherId,
      })
      results.push(record)
    }

    const written = value.students.filter((s) => {
      const r = results.find((res) => res.studentId === s.studentId)
      return r && !r.skipped
    })
    if (written.length) {
      this._sendEmailsForStudents(written, courseId).catch(() => {})
      this._notifyStudentsOfAttendance(written, courseId, 'Your teacher').catch(() => {})
    }

    return results.map((record) => record.skipped ? record : this._attendanceResponse(record))
  }

  async markSubjectWiseAttendance(teacherId, body) {
    const { error, value } = subjectWiseSchema.validate(body)
    if (error) throw new Error(error.message)

    this._ensureNotSunday(value.date)

    const course = await repo.verifyTeacherCourse(value.courseId, teacherId)
    if (!course) throw new Error('Course not found or not assigned to you')

    const enrolledStudents = await repo.getCourseStudents(value.courseId)
    const enrolledStudentIds = new Set(enrolledStudents.map((enrollment) => enrollment.student.id))
    if (value.students.some((student) => !enrolledStudentIds.has(student.studentId))) {
      throw new Error('One or more students are not enrolled in this class')
    }

    const holiday = await repo.getHolidayByDate(value.date)
    if (holiday) throw new Error(`Cannot mark attendance on a holiday: ${holiday.title}`)

    const results = []

    for (const student of value.students) {
      const record = await repo.upsertAttendance({
        studentId: student.studentId,
        courseId: value.courseId,
        date: value.date,
        mode: 'SUBJECT_WISE',
        status: student.status,
        markedBy: teacherId,
      })
      results.push(record)
    }

    this._sendEmailsForStudents(value.students, value.courseId).catch(() => {})
    this._notifyStudentsOfAttendance(value.students, value.courseId, 'Your teacher').catch(() => {})

    return results.map((record) => record.skipped ? record : this._attendanceResponse(record))
  }

  _attendanceResponse(record) {
    return {
      studentId: record.studentId,
      courseId: record.courseId,
      date: record.date,
      mode: record.mode,
      status: record.status,
    }
  }

  async getCourseStudents(teacherId, courseId) {
    const course = await repo.verifyTeacherCourse(courseId, teacherId)
    if (!course) throw new Error('Course not found or not assigned to you')

    const enrollments = await repo.getCourseStudents(courseId)

    return enrollments.map((enrollment) => ({
      studentId: enrollment.student.id,
      name: enrollment.student.name,
      rollNumber: enrollment.student.rollNumber,
      status: 'PRESENT',
      isMarked: false,
      canEdit: false,
    }))
  }

  async getCourseAttendance(teacherId, courseId, date) {
    const course = await repo.verifyTeacherCourse(courseId, teacherId)
    if (!course) throw new Error('Course not found or not assigned to you')

    const enrollments = await repo.getCourseStudents(courseId)

    if (enrollments.length === 0) return []

    const studentIds = enrollments.map((e) => e.student.id)
    const attendanceRecords = await repo.getAttendanceByCourseAndStudents(courseId, date, studentIds)

    const recordMap = new Map(attendanceRecords.map((r) => [r.studentId, r]))

    return enrollments.map((enrollment) => {
      const record = recordMap.get(enrollment.student.id)
      return {
        studentId: enrollment.student.id,
        name: enrollment.student.name,
        rollNumber: enrollment.student.rollNumber,
        status: record?.status || 'PRESENT',
        isMarked: !!record,
        canEdit: record ? repo.isWithinEditWindow(record.createdAt) : true,
      }
    })
  }

  async getHolidays() {
    const holidays = await repo.listHolidays()
    return holidays.map((holiday) => ({
      title: holiday.title,
      date: holiday.date,
    }))
  }

  async getStudentAttendance(teacherId, courseId, rollNumber, date) {
    const course = await repo.verifyTeacherCourse(courseId, teacherId)
    if (!course) throw new Error('Course not found or not assigned to you')

    const enrollment = await repo.getCourseStudentByRollNumber(courseId, rollNumber)
    if (!enrollment) throw new Error('Student not found in this class')

    const record = await repo.getStudentAttendanceByRollNumber(courseId, rollNumber, date)

    return {
      studentId: enrollment.student.id,
      name: enrollment.student.name,
      rollNumber: enrollment.student.rollNumber,
      courseTitle: enrollment.course.title,
      date: repo.normalizeDate(date).toISOString().split('T')[0],
      status: record?.status || null,
      isMarked: !!record,
      canEdit: record ? repo.isWithinEditWindow(record.createdAt) : true,
    }
  }

  async updateStudentAttendance(teacherId, courseId, rollNumber, body) {
    const course = await repo.verifyTeacherCourse(courseId, teacherId)
    if (!course) throw new Error('Course not found or not assigned to you')

    const enrollment = await repo.getCourseStudentByRollNumber(courseId, rollNumber)
    if (!enrollment) throw new Error('Student not found in this class')

    this._ensureNotSunday(body.date)

    const holiday = await repo.getHolidayByDate(body.date)
    if (holiday) throw new Error(`Cannot mark attendance on a holiday: ${holiday.title}`)

    const record = await repo.upsertAttendance({
      studentId: enrollment.student.id,
      courseId,
      date: body.date,
      mode: 'SUBJECT_WISE',
      status: body.status,
      markedBy: teacherId,
    })

    await this._notifyStudentsOfAttendance(
      [{ studentId: enrollment.student.id, status: body.status }],
      courseId,
      'Your teacher',
    )

    return this._attendanceResponse(record)
  }
}

module.exports = new AttendanceService()
