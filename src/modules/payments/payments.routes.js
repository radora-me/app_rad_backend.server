const router = require("express").Router();
const auth = require("../../shared/middlewares/auth.middleware");
const role = require("../../shared/middlewares/role.middleware");
const controller = require("./payments.controller");

router.post("/payments/cashfree/webhook", (req, res) => controller.webhook(req, res));
router.get("/finance/receipts/:receiptId/pdf", auth, role(["admin"]), (req, res) => controller.adminReceipt(req, res));
router.use("/student/fees", auth, role(["student"]));
router.get("/student/fees", (req, res) => controller.studentFees(req, res));
router.post("/student/fees/:invoiceId/checkout", (req, res) => controller.checkout(req, res));
router.get("/student/fees/orders/:orderId/status", (req, res) => controller.orderStatus(req, res));
router.get("/student/fees/receipts/:receiptId/pdf", (req, res) => controller.studentReceipt(req, res));

module.exports = router;
