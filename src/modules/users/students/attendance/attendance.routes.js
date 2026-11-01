const router = require('express').Router()

const controller = require('./attendance.controller')

const auth = require('../../../../shared/middlewares/auth.middleware')

const role = require('../../../../shared/middlewares/role.middleware')

router.get(
  '/overview',
  auth,
  role(['student']),
  (req, res) => controller.overview(req, res)
)

router.post(
  '/leave/apply',
  auth,
  role(['student']),
  (req, res) => controller.applyLeave(req, res)
)

router.get(
  '/leave/history',
  auth,
  role(['student']),
  (req, res) => controller.leaveHistory(req, res)
)

module.exports = router