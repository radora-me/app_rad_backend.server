const User = require('./auth.model')

class AuthRepository {
  async create(data) {
    return User.create(data)
  }

  async findByEmail(email) {
    return User.findOne({ email })
  }

  async findById(id) {
    return User.findById(id)
  }
}

module.exports = new AuthRepository()