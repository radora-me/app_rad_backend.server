const router = require("express").Router();
const controller = require("./notice.controller");
const auth = require("../../shared/middlewares/auth.middleware");
const role = require("../../shared/middlewares/role.middleware");

// All authenticated users can list notices
router.get("/", auth, (req, res) => controller.list(req, res));

// All authenticated users can download notice attachments
router.get("/:noticeId/attachments/:fileId", auth, (req, res) =>
  controller.download(req, res),
);

// Only admin can create/delete
router.post("/", auth, role(["admin"]), (req, res) =>
  controller.create(req, res),
);

router.delete("/:noticeId", auth, role(["admin"]), (req, res) =>
  controller.delete(req, res),
);

module.exports = router;
