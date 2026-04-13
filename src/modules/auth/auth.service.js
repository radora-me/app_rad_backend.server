// src/modules/auth/auth.service.js
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const repo = require('./auth.repository')

const SECRET = process.env.JWT_SECRET

exports.signup = async (data) => {
  const existing = await repo.findByEmail(data.email)
  if (existing) throw new Error('User already exists')

  const hashed = await bcrypt.hash(data.password, 10)

  const user = await repo.createUser({
    name: data.name,
    email: data.email,
    password: hashed,
    role: data.role
  })

  return { message: 'User created', userId: user._id }
}

exports.login = async (data) => {
  const user = await repo.findByEmail(data.email)
  if (!user) throw new Error('User not found')

  const match = await bcrypt.compare(data.password, user.password)
  if (!match) throw new Error('Invalid credentials')

  const token = jwt.sign(
    { id: user._id, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  )

  return {
    token,
    user: {
      id: user._id,
      role: user.role,
      name: user.name
    }
  }
}