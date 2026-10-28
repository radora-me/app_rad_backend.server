const router = require("express").Router();
const auth = require("../../shared/middlewares/auth.middleware");
const role = require("../../shared/middlewares/role.middleware");
const controller = require("./events.controller");

// All authenticated users can read events
router.get("/", auth, (req, res) => controller.list(req, res));
router.get("/:id", auth, (req, res) => controller.getOne(req, res));

// Admin only — create / manage
router.post("/", auth, role(["admin"]), (req, res) => controller.create(req, res));
router.patch("/:id/status", auth, role(["admin"]), (req, res) => controller.updateStatus(req, res));
router.post("/:id/media", auth, role(["admin"]), (req, res) => controller.addMedia(req, res));
router.delete("/:id/media/:mediaId", auth, role(["admin"]), (req, res) => controller.removeMedia(req, res));
router.delete("/:id", auth, role(["admin"]), (req, res) => controller.remove(req, res));

module.exports = router;
