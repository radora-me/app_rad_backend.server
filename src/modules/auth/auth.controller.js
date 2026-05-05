const service = require('./auth.service')
const { signupSchema, loginSchema } = require('./auth.validator')

class AuthController {

  async signup(req, res) {
    try {
      const { error } = signupSchema.validate(req.body)
      if (error) return res.status(400).json({ error: error.message })

      const result = await service.signup(req.body)
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  }

  async login(req, res) {
    try {
      const { error } = loginSchema.validate(req.body)
      if (error) return res.status(400).json({ error: error.message })

      const result = await service.login(req.body)
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  }

  async refresh(req, res) {
    try {
      const { token } = req.body
      const result = await service.refreshToken(token)
      res.json(result)
    } catch (err) {
      res.status(401).json({ error: err.message })
    }
  }

  async logout(req, res) {
    try {
      const { userId } = req.body
      const result = await service.logout(userId)
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  }
}

module.exports = new AuthController()