const bcrypt = require('bcryptjs')
const repo = require('./auth.repository')
const jwtService = require('../../core/utils/jwt.utils')
const redis = require('../../core/cache/redis')

class AuthService {

  async signup(data) {
    const existing = await repo.findByEmail(data.email)
    if (existing) throw new Error('User already exists')

    const hashed = await bcrypt.hash(data.password, 12)

    const user = await repo.create({
      ...data,
      password: hashed
    })

    return {
      message: 'User created',
      userId: user._id
    }
  }

  async login(data) {
    const user = await repo.findByEmail(data.email)
    if (!user) throw new Error('User not found')

    const match = await bcrypt.compare(data.password, user.password)
    if (!match) throw new Error('Invalid credentials')

    const payload = {
      id: user._id,
      role: user.role
    }

    const accessToken = jwtService.generateAccessToken(payload)
    const refreshToken = jwtService.generateRefreshToken(payload)

    // 🔥 Store refresh token in Redis
    await redis.set(
      `refresh:${user._id}`,
      refreshToken,
      'EX',
      7 * 24 * 60 * 60
    )

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        role: user.role
      }
    }
  }

  async refreshToken(token) {
    try {
      const decoded = jwtService.verifyRefresh(token)

      const stored = await redis.get(`refresh:${decoded.id}`)
      if (!stored || stored !== token) {
        throw new Error('Invalid session')
      }

      const newAccessToken = jwtService.generateAccessToken({
        id: decoded.id,
        role: decoded.role
      })

      return { accessToken: newAccessToken }

    } catch (err) {
      throw new Error('Invalid refresh token')
    }
  }

  async logout(userId) {
    await redis.del(`refresh:${userId}`)
    return { message: 'Logged out successfully' }
  }
}

module.exports = new AuthService()