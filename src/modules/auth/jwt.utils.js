const jwt = require('jsonwebtoken')

class JWTService {
  generateAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '15m'
    })
  }

  generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: '7d'
    })
  }

  verify(token) {
    return jwt.verify(token, process.env.JWT_SECRET)
  }
}

module.exports = new JWTService()