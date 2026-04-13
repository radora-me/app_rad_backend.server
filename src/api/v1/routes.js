const router = require('express').Router()

const authRoutes = require('../../modules/auth/auth.routes')

router.use('/auth', authRoutes)
console.log("Main routes loaded")
module.exports = router