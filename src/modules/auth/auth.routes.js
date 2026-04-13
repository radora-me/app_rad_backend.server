// src/modules/auth/auth.routes.js
const router = require('express').Router()
const controller = require('./auth.controller')
console.log("Auth routes loaded")
router.post('/signup', controller.signup)
router.post('/login', controller.login)

module.exports = router