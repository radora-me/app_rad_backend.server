const repo = require('./attendance.repository')
const { fullDaySchema, subjectWiseSchema } = require('./attendance.validator')
const prisma = require('../../../../core/database/prisma')
const { sendAttendanceUpdateEmail } = require('../../../../shared/utils/send.attendance.email')

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
          className: true,
          studentProfile: { select: { parentEmail: true, parentName: true } },
          enrollments: {
            where: courseId ? { courseId } : undefined,
            include: { course: { select: { description: true } } },
            take: 1,
          },
        },
      })

      const recordMap = new Map(records.map((r) => [r.id, r]))

      for (const s of students) {
        const user = recordMap.get(s.studentId)
        if (!user) continue

        const parentEmail = user.studentProfile?.parentEmail
        if (!parentEmail) continue

        const section = user.enrollments?.[0]?.course?.description || ''

        sendAttendanceUpdateEmail({
          to: parentEmail,
          studentName: user.name,
          className: user.className || '',
          section,
          attendanceDate: new Date().toLocaleDateString(),
          status: s.status,
        }).catch(() => {})
      }
    } catch {
      // email errors must never break attendance
    }
  }

  async markFullDayAttendance(teacherId, body) {
    const { error, value } = fullDaySchema.validate(body)
    if (error) throw new Error(error.message)

    this._ensureNotSunday(value.date)

    const holiday = await repo.getHolidayByDate(value.date)
    if (holiday) throw new Error(`Cannot mark attendance on a holiday: ${holiday.title}`)

    const courseId = value.courseId || null

    if (courseId) {
      const course = await repo.verifyTeacherCourse(courseId, teacherId)
      if (!course) throw new Error('Course not found or not assigned to you')
    }

    const results = []

    for (const student of value.students) {
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

    this._sendEmailsForStudents(value.students, courseId).catch(() => {})

    return results
  }

  async markSubjectWiseAttendance(teacherId, body) {
    const { error, value } = subjectWiseSchema.validate(body)
    if (error) throw new Error(error.message)

    this._ensureNotSunday(value.date)

    const course = await repo.verifyTeacherCourse(value.courseId, teacherId)
    if (!course) throw new Error('Course not found or not assigned to you')

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

    return results
  }

  async getCourseStudents(courseId) {
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

  async getCourseAttendance(courseId, date) {
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
    return repo.listHolidays()
  }

  async getStudentAttendance(courseId, rollNumber, date) {
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

    return record
  }
}

module.exports = new AttendanceService()
