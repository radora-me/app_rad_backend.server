// src/modules/auth/auth.repository.js
const User = require('./auth.model')

exports.createUser = async (data) => {
  return await User.create(data)
}

exports.findByEmail = async (email) => {
  return await User.findOne({ email })
}