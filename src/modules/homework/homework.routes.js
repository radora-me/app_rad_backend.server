const router = require("express").Router()

const controller = require("./homework.controller")

const auth = require("../../shared/middlewares/auth.middleware")
const role = require("../../shared/middlewares/role.middleware")

router.post(
  "/teacher",
  auth,
  role(["teacher"]),
  (req, res) => controller.create(req, res)
)

router.get(
  "/teacher",
  auth,
  role(["teacher"]),
  (req, res) => controller.listForTeacher(req, res)
)

router.get(
  "/teacher/:homeworkId",
  auth,
  role(["teacher"]),
  (req, res) => controller.getHomeworkForTeacher(req, res)
)

router.put(
  "/teacher/:homeworkId",
  auth,
  role(["teacher"]),
  (req, res) => controller.update(req, res)
)

router.delete(
  "/teacher/:homeworkId",
  auth,
  role(["teacher"]),
  (req, res) => controller.delete(req, res)
)

router.get(
  "/teacher/:homeworkId/attachments/:fileId",
  auth,
  role(["teacher"]),
  (req, res) => controller.downloadForTeacher(req, res)
)

router.get(
  "/student",
  auth,
  role(["student"]),
  (req, res) => controller.listForStudent(req, res)
)

router.get(
  "/student/:homeworkId",
  auth,
  role(["student"]),
  (req, res) => controller.getHomeworkForStudent(req, res)
)

router.get(
  "/student/:homeworkId/attachments/:fileId",
  auth,
  role(["student"]),
  (req, res) => controller.downloadForStudent(req, res)
)

module.exports = router 