const router = require("express").Router();
const controller = require("./enquiries.controller");

// Public endpoint: no application account is required to request a walkthrough.
router.post("/", (req, res) => controller.submit(req, res));

module.exports = router;
