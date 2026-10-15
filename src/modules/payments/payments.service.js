const crypto = require("crypto");
const prisma = require("../../core/database/prisma");
const cashfree = require("./cashfree.client");

const money = (value) => Number(value || 0);
const makeId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const sameMoney = (a, b) => Math.abs(money(a) - money(b)) <= 0.005;
const ACCOUNTING_TRANSACTION_OPTIONS = { maxWait: 10000, timeout: 15000 };
const publicPaymentUrl = (name, fallback, production) => {
  const value = String(process.env[name] || fallback || "").trim().replace(/\/+$/, "");
  const valid = production ? /^https:\/\/[^\s]+$/i.test(value) : /^https?:\/\/[^\s]+$/i.test(value);
  if (!value || !valid) {
    throw new Error(production
      ? `Cashfree production requires ${name} to be a public HTTPS URL. Configure ${name} before starting checkout.`
      : `${name} must be a valid URL.`);
  }
  return value;
};
const safePaymentSelect = {
  id: true, reference: true, invoiceId: true, amount: true, method: true, status: true, paidAt: true, notes: true,
  createdAt: true,
  receipts: { select: { id: true, receiptNumber: true, issuedAt: true } },
};
const safeOrderInclude = { invoice: true, payment: { select: safePaymentSelect } };

function toJson(value) {
  if (value == null) return null;
  try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
}

function customerFromStudent(student) {
  const email = student.email || student.studentProfile?.parentEmail || process.env.CASHFREE_FALLBACK_CUSTOMER_EMAIL;
  const phone = student.studentProfile?.parentPhone || process.env.CASHFREE_FALLBACK_CUSTOMER_PHONE;
  if (!email || !phone) {
    throw new Error("A student email and phone are required for online payment. Add them to the student profile or configure Cashfree fallback contact details.");
  }
  return { id: student.id, name: student.name, email, phone: String(phone).replace(/\s+/g, "") };
}

function orderId() {
  return `RADORA_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`.slice(0, 50);
}

function paymentMethod(payload) {
  const group = String(payload?.payment?.payment_group || payload?.payment_method || "").toLowerCase();
  if (group.includes("upi")) return "UPI";
  if (group.includes("card")) return "CARD";
  if (group.includes("bank") || group.includes("netbank")) return "BANK_TRANSFER";
  return "OTHER";
}

function successPayload(payload) {
  return String(payload?.type || "").includes("SUCCESS") || String(payload?.payment?.payment_status || "").toUpperCase() === "SUCCESS";
}

function failedPayload(payload) {
  const type = String(payload?.type || "").toUpperCase();
  const status = String(payload?.payment?.payment_status || "").toUpperCase();
  return type.includes("FAILED") || type.includes("DROPPED") || ["FAILED", "USER_DROPPED", "CANCELLED"].includes(status);
}

async function systemAccounts(tx) {
  const result = {};
  for (const [code, name, type] of [["1000", "Cash & Bank", "ASSET"], ["1100", "Accounts Receivable", "ASSET"]]) {
    result[code] = await tx.financeAccount.upsert({ where: { code }, update: { name, type, isSystem: true }, create: { code, name, type, isSystem: true } });
  }
  return result;
}

async function postPaymentJournal(tx, { studentId, amount, reference }) {
  const accounts = await systemAccounts(tx);
  return tx.financeJournalEntry.create({
    data: {
      entryNumber: makeId("JE"),
      description: `Cashfree payment ${reference}`,
      source: "CASHFREE_PAYMENT",
      createdById: studentId,
      status: "POSTED",
      totalDebit: amount,
      totalCredit: amount,
      lines: { create: [
        { accountId: accounts["1000"].id, debit: amount, credit: 0 },
        { accountId: accounts["1100"].id, debit: 0, credit: amount },
      ] },
    },
  });
}

async function finalizePaidOrder(orderIdValue, payload) {
  const gatewayPaymentId = String(payload?.payment?.cf_payment_id || payload?.cf_payment_id || "").trim() || null;
  const paidAmount = payload?.payment?.payment_amount ?? payload?.payment_amount ?? payload?.order?.order_amount;

  return prisma.$transaction(async (tx) => {
    const order = await tx.financeGatewayOrder.findUnique({ where: { orderId: orderIdValue }, include: { invoice: true } });
    if (!order) throw new Error("Cashfree order not found");
    if (!sameMoney(paidAmount, order.amount)) throw new Error("Cashfree payment amount does not match the fee due");

    const claimed = await tx.financeGatewayOrder.updateMany({
      where: { id: order.id, status: { not: "PAID" } },
      data: { status: "PAID", cashfreePaymentId: gatewayPaymentId, lastEventType: payload?.type || "PAYMENT_SUCCESS_WEBHOOK", lastWebhookAt: new Date(), rawPayload: toJson(payload) },
    });
    if (!claimed.count) return tx.financeGatewayOrder.findUnique({ where: { id: order.id }, include: safeOrderInclude });

    const invoice = await tx.feeInvoice.findUnique({ where: { id: order.invoiceId } });
    if (!invoice) throw new Error("Invoice not found for Cashfree order");
    const balance = money(invoice.total) - money(invoice.paidAmount);
    if (!sameMoney(paidAmount, balance) && money(paidAmount) > balance + 0.005) throw new Error("Cashfree payment exceeds the invoice balance");

    const payment = await tx.financePayment.create({
      data: {
        reference: `CF-${order.orderId}`,
        invoiceId: invoice.id,
        amount: order.amount,
        method: paymentMethod(payload),
        status: "COMPLETED",
        paidAt: new Date(),
        notes: "Cashfree online payment",
        receivedById: order.studentId,
        gatewayOrderId: order.id,
        gatewayPaymentId,
        gatewayPayload: toJson(payload),
      },
    });
    const paidTotal = money(invoice.paidAmount) + money(order.amount);
    await tx.feeInvoice.update({ where: { id: invoice.id }, data: { paidAmount: paidTotal, status: paidTotal >= money(invoice.total) - 0.005 ? "PAID" : "PARTIALLY_PAID" } });
    await tx.financeReceipt.create({ data: { receiptNumber: makeId("RCT"), invoiceId: invoice.id, paymentId: payment.id } });
    await postPaymentJournal(tx, { studentId: order.studentId, amount: order.amount, reference: payment.reference });
    return tx.financeGatewayOrder.findUnique({ where: { id: order.id }, include: safeOrderInclude });
  }, ACCOUNTING_TRANSACTION_OPTIONS);
}

async function markOrderFailed(orderIdValue, payload, status = "FAILED") {
  return prisma.financeGatewayOrder.updateMany({ where: { orderId: orderIdValue, status: { not: "PAID" } }, data: { status, lastEventType: payload?.type || "PAYMENT_FAILED_WEBHOOK", lastWebhookAt: new Date(), rawPayload: toJson(payload) } });
}

function webhookSignatureValid(signature, timestamp, rawBody) {
  if (!signature || !timestamp || !rawBody) return false;
  const timestampNumber = Number(timestamp);
  const timestampMs = timestampNumber > 1e12 ? timestampNumber : timestampNumber * 1000;
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() - timestampMs) > 10 * 60 * 1000) return false;
  const expected = crypto.createHmac("sha256", process.env.CASHFREE_CLIENT_SECRET || "").update(`${timestamp}${rawBody}`).digest("base64");
  const actualBuffer = Buffer.from(String(signature));
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

async function createCheckout(studentId, invoiceId) {
  const existing = await prisma.financeGatewayOrder.findFirst({ where: { invoiceId, studentId, status: "ACTIVE", paymentSessionId: { not: null }, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (existing) return { orderId: existing.orderId, paymentSessionId: existing.paymentSessionId, amount: money(existing.amount) };

  const invoice = await prisma.feeInvoice.findFirst({ where: { id: invoiceId, studentId, deletedAt: null }, include: { student: { include: { studentProfile: true } } } });
  if (!invoice) throw new Error("Fee invoice not found");
  const balance = money(invoice.total) - money(invoice.paidAmount);
  if (balance <= 0.005 || invoice.status === "PAID") throw new Error("This fee is already paid");
  const customer = customerFromStudent(invoice.student);
  const production = cashfree.getConfig().environment === "production";
  const frontend = publicPaymentUrl("FRONTEND_URL", production ? "https://next.radora.tech" : "http://localhost:3000", production);
  const backend = publicPaymentUrl("BACKEND_PUBLIC_URL", production ? "" : `http://localhost:${process.env.PORT || 5000}`, production);
  const newOrderId = orderId();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  let local;
  try {
    local = await prisma.financeGatewayOrder.create({ data: { orderId: newOrderId, invoiceId, studentId, amount: balance, expiresAt } });
  } catch (error) {
    if (["P2021", "P2022"].includes(error.code)) {
      throw new Error("Online payment setup is incomplete. Deploy the Cashfree database migration before starting checkout.");
    }
    if (error.code === "P2002") {
      const inFlight = await prisma.financeGatewayOrder.findFirst({ where: { invoiceId, studentId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
      if (inFlight?.paymentSessionId) return { orderId: inFlight.orderId, paymentSessionId: inFlight.paymentSessionId, amount: money(inFlight.amount) };
    }
    throw error;
  }
  try {
    const response = await cashfree.createOrder({ orderId: newOrderId, amount: balance, customer, returnUrl: `${frontend}/student-fees?cashfree_order_id={order_id}`, notifyUrl: `${backend}/api/v1/payments/cashfree/webhook` });
    const session = response.payment_session_id;
    if (!session) throw new Error("Cashfree did not return a payment session");
    const updated = await prisma.financeGatewayOrder.update({ where: { id: local.id }, data: { paymentSessionId: session } });
    return { orderId: updated.orderId, paymentSessionId: updated.paymentSessionId, amount: money(updated.amount), environment: cashfree.getConfig().environment };
  } catch (error) {
    await markOrderFailed(newOrderId, { type: "ORDER_CREATION_FAILED", error: error.response?.data || error.message });
    throw new Error(error.response?.data?.message || "Unable to start Cashfree checkout");
  }
}

async function syncOrder(studentId, orderIdValue) {
  const local = await prisma.financeGatewayOrder.findFirst({ where: { orderId: orderIdValue, studentId }, include: safeOrderInclude });
  if (!local) throw new Error("Payment order not found");
  if (local.status === "PAID") return local;
  const [remote, payments] = await Promise.all([cashfree.fetchOrder(orderIdValue), cashfree.fetchPayments(orderIdValue)]);
  const successful = Array.isArray(payments) ? payments.find((payment) => String(payment.payment_status).toUpperCase() === "SUCCESS") : null;
  if (successful) return finalizePaidOrder(orderIdValue, { type: "PAYMENT_SUCCESS_STATUS_CHECK", order: remote, payment: successful });
  const remoteStatus = String(remote?.order_status || "").toUpperCase();
  if (["EXPIRED", "TERMINATED", "CANCELLED"].includes(remoteStatus)) await markOrderFailed(orderIdValue, { type: `ORDER_${remoteStatus}` }, remoteStatus === "EXPIRED" ? "EXPIRED" : "CANCELLED");
  return prisma.financeGatewayOrder.findUnique({ where: { orderId: orderIdValue }, include: safeOrderInclude });
}

async function processWebhook({ signature, timestamp, rawBody, payload }) {
  if (!webhookSignatureValid(signature, timestamp, rawBody)) throw new Error("Invalid Cashfree webhook signature");
  const orderIdValue = payload?.data?.order?.order_id || payload?.data?.order_id || payload?.order?.order_id;
  if (!orderIdValue) return { ignored: true };
  if (successPayload(payload?.data || payload)) return finalizePaidOrder(orderIdValue, payload?.data || payload);
  if (failedPayload(payload?.data || payload)) await markOrderFailed(orderIdValue, payload?.data || payload);
  return { accepted: true };
}

async function listStudentFees(studentId) {
  const invoices = await prisma.feeInvoice.findMany({ where: { studentId, deletedAt: null }, orderBy: [{ status: "asc" }, { dueDate: "asc" }], include: {
    payments: { orderBy: { paidAt: "desc" }, select: safePaymentSelect },
  } });
  return invoices.map((invoice) => ({ ...invoice, displayStatus: invoice.status !== "PAID" && new Date(invoice.dueDate) < new Date() ? "OVERDUE" : invoice.status, balance: money(invoice.total) - money(invoice.paidAmount) }));
}

async function getReceipt(studentId, receiptId) {
  const receipt = await prisma.financeReceipt.findFirst({ where: { id: receiptId, invoice: { studentId } }, include: { invoice: { include: { student: true } }, payment: { select: { id: true, reference: true, amount: true, paidAt: true } } } });
  if (!receipt) throw new Error("Receipt not found");
  return receipt;
}

async function getAdminReceipt(receiptId) {
  const receipt = await prisma.financeReceipt.findUnique({ where: { id: receiptId }, include: { invoice: { include: { student: true } }, payment: { select: { id: true, reference: true, amount: true, paidAt: true } } } });
  if (!receipt) throw new Error("Receipt not found");
  return receipt;
}

module.exports = { createCheckout, syncOrder, processWebhook, listStudentFees, getReceipt, getAdminReceipt, webhookSignatureValid };
