const service = require('./attendance.service')

class AttendanceController {

  async overview(req, res) {

    try {

      const result = await service.overview(
        req.user.id
      )

      res.json(result)

    } catch (err) {

      res.status(400).json({
        error: err.message
      })
    }
  }

  async applyLeave(req, res) {

    try {

      const result = await service.applyLeave(
        req.user.id,
        req.body
      )

      res.json(result)

    } catch (err) {

      res.status(400).json({
        error: err.message
      })
    }
  }

  async leaveHistory(req, res) {

    try {

      const result = await service.leaveHistory(
        req.user.id
      )

      res.json(result)

    } catch (err) {

      res.status(400).json({
        error: err.message
      })
    }
  }
}

module.exports = new AttendanceController()