// src/modules/auth/auth.controller.js
const service = require('./auth.service')
const { signupSchema, loginSchema } = require('./auth.validator')

exports.signup = async (req, res) => {
  try {
    const { error } = signupSchema.validate(req.body)
    if (error) return res.status(400).json({ error: error.message })

    const result = await service.signup(req.body)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

exports.login = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body)
    if (error) return res.status(400).json({ error: error.message })

    const result = await service.login(req.body)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}