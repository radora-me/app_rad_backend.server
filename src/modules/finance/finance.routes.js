const router = require("express").Router();
const auth = require("../../shared/middlewares/auth.middleware");
const role = require("../../shared/middlewares/role.middleware");
const controller = require("./finance.controller");

router.use(auth, role(["admin"]));
router.get("/dashboard", (req, res) => controller.dashboard(req, res));
router.get("/intelligence", (req, res) => controller.intelligence(req, res));
router.post("/assistant", (req, res) => controller.assistant(req, res));
router.get("/export", (req, res) => controller.export(req, res));
router.get("/:resource", (req, res) => controller.list(req, res));
router.post("/invoices", (req, res) => controller.createInvoice(req, res));
router.post("/payments", (req, res) => controller.recordPayment(req, res));
router.post("/expenses", (req, res) => controller.createExpense(req, res));
router.patch("/expenses/:id", (req, res) => controller.updateExpense(req, res));
router.post("/journals", (req, res) => controller.createJournal(req, res));

module.exports = router;
