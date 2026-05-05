const router = require('express').Router()
const controller = require('./auth.controller')

router.post('/signup', (req, res) => controller.signup(req, res))
router.post('/login', (req, res) => controller.login(req, res))

// NEW (does not break existing)
router.post('/refresh', (req, res) => controller.refresh(req, res))
router.post('/logout', (req, res) => controller.logout(req, res))

module.exports = router