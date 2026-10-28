const prisma = require("../../core/database/prisma");

const money = (value) => Number(value || 0);
const toDate = (value, fallback = new Date()) => {
  const date = value ? new Date(value) : fallback;
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
};

const id = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const ACCOUNTING_TRANSACTION_OPTIONS = { maxWait: 10000, timeout: 15000 };

async function ensureSystemAccounts(tx) {
  const accounts = [
    ["1000", "Cash & Bank", "ASSET"],
    ["1100", "Accounts Receivable", "ASSET"],
    ["2000", "Accounts Payable", "LIABILITY"],
    ["4000", "Fee Income", "INCOME"],
    ["5000", "Operating Expenses", "EXPENSE"],
  ];
  const result = {};
  for (const [code, name, type] of accounts) {
    result[code] = await tx.financeAccount.upsert({
      where: { code },
      update: { name, type, isSystem: true },
      create: { code, name, type, isSystem: true },
    });
  }
  return result;
}

async function createPostedJournal(tx, { description, source, createdById, lines }) {
  const debit = lines.reduce((sum, line) => sum + money(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + money(line.credit), 0);
  if (!debit || Math.abs(debit - credit) > 0.005) {
    throw new Error("Journal entry must be balanced");
  }
  return tx.financeJournalEntry.create({
    data: {
      entryNumber: id("JE"),
      description,
      source,
      createdById,
      status: "POSTED",
      totalDebit: debit,
      totalCredit: credit,
      lines: { create: lines.map((line) => ({
        accountId: line.accountId,
        debit: line.debit || 0,
        credit: line.credit || 0,
        memo: line.memo,
      })) },
    },
    include: { lines: true },
  });
}

async function dashboard() {
  const now = new Date();
  const [invoiceAgg, paymentAgg, expenseAgg, outstandingCount, overdueCount, recentPayments, recentExpenses, recentJournals] = await Promise.all([
    prisma.feeInvoice.aggregate({ where: { deletedAt: null }, _sum: { total: true, paidAmount: true } }),
    prisma.financePayment.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
    prisma.financeExpenseBill.aggregate({ where: { status: { not: "REJECTED" } }, _sum: { amount: true } }),
    prisma.feeInvoice.count({ where: { deletedAt: null, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } } }),
    prisma.feeInvoice.count({ where: { deletedAt: null, dueDate: { lt: now }, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } } }),
    prisma.financePayment.findMany({ orderBy: { paidAt: "desc" }, take: 6, include: { invoice: true } }),
    prisma.financeExpenseBill.findMany({ orderBy: { billDate: "desc" }, take: 6, include: { vendor: true, category: true } }),
    prisma.financeJournalEntry.findMany({ orderBy: { entryDate: "desc" }, take: 6, include: { lines: true } }),
  ]);

  const revenue = money(paymentAgg._sum.amount);
  const expenses = money(expenseAgg._sum.amount);
  const invoiced = money(invoiceAgg._sum.total);
  const collected = money(invoiceAgg._sum.paidAmount);
  const outstanding = Math.max(0, invoiced - collected);

  const months = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const [monthPayments, monthExpenses] = await Promise.all([
      prisma.financePayment.aggregate({ where: { paidAt: { gte: start, lt: end }, status: "COMPLETED" }, _sum: { amount: true } }),
      prisma.financeExpenseBill.aggregate({ where: { billDate: { gte: start, lt: end }, status: { not: "REJECTED" } }, _sum: { amount: true } }),
    ]);
    months.push({ month: start.toLocaleString("en-IN", { month: "short" }), income: money(monthPayments._sum.amount), expenses: money(monthExpenses._sum.amount) });
  }

  const recommendations = [];
  if (overdueCount > 0) recommendations.push({ type: "risk", title: "Collections need attention", detail: `${overdueCount} invoice(s) are past due. Prioritize reminders and payment plans.` });
  if (expenses > revenue && revenue > 0) recommendations.push({ type: "risk", title: "Expenses exceed collections", detail: "Review discretionary spend and protect cash reserves this cycle." });
  if (outstanding > revenue * 1.5) recommendations.push({ type: "action", title: "Reduce receivables concentration", detail: "Outstanding fees are materially higher than current collections." });
  if (!recommendations.length) recommendations.push({ type: "positive", title: "Finance operations are stable", detail: "No material deterministic risks were detected in the current ledger snapshot." });

  return {
    asOf: now.toISOString(),
    kpis: { invoiced, collected: revenue || collected, outstanding, expenses, netCash: revenue - expenses, overdueCount, outstandingCount },
    trend: months,
    recent: [
      ...recentPayments.map((row) => ({ kind: "Payment", reference: row.reference, amount: money(row.amount), date: row.paidAt })),
      ...recentExpenses.map((row) => ({ kind: "Expense", reference: row.billNumber, amount: money(row.amount), date: row.billDate })),
      ...recentJournals.map((row) => ({ kind: "Journal", reference: row.entryNumber, amount: money(row.totalDebit), date: row.entryDate })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10),
    recommendations,
  };
}

async function list(resource) {
  const include = {
    invoices: () => prisma.feeInvoice.findMany({ where: { deletedAt: null }, orderBy: { issueDate: "desc" }, take: 100, include: { student: { select: { id: true, name: true, rollNumber: true } }, payments: { select: { id: true, reference: true, amount: true, method: true, status: true, paidAt: true, receipts: { select: { id: true, receiptNumber: true, issuedAt: true } } } } } }),
    deletedInvoices: () => prisma.feeInvoice.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 100, include: { student: { select: { id: true, name: true, rollNumber: true } }, deletedBy: { select: { id: true, name: true } } } }),
    payments: () => prisma.financePayment.findMany({ orderBy: { paidAt: "desc" }, take: 100, select: { id: true, reference: true, invoiceId: true, amount: true, method: true, status: true, paidAt: true, notes: true, receivedById: true, createdAt: true, receipts: { select: { id: true, receiptNumber: true, issuedAt: true } }, invoice: { include: { student: { select: { id: true, name: true, rollNumber: true } } } }, receivedBy: { select: { name: true } } } }),
    expenses: () => prisma.financeExpenseBill.findMany({ orderBy: { billDate: "desc" }, take: 100, include: { vendor: true, category: true, approvals: true } }),
    journals: () => prisma.financeJournalEntry.findMany({ orderBy: { entryDate: "desc" }, take: 100, include: { lines: { include: { account: true } } } }),
    accounts: () => prisma.financeAccount.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    budgets: () => prisma.financeBudget.findMany({ orderBy: [{ fiscalYear: "desc" }, { category: "asc" }] }),
    vendors: () => prisma.financeVendor.findMany({ orderBy: { name: "asc" } }),
    assets: () => prisma.financeAsset.findMany({ orderBy: { createdAt: "desc" } }),
    categories: () => prisma.financeFeeCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    feeStructures: () => prisma.feeStructure.findMany({ orderBy: { createdAt: "desc" }, include: { category: true } }),
    assignments: () => prisma.financeStudentFeeAssignment.findMany({ orderBy: { assignedAt: "desc" }, include: { student: { select: { name: true, rollNumber: true } }, feeStructure: true } }),
    installments: () => prisma.financeInstallment.findMany({ orderBy: { dueDate: "asc" }, include: { invoice: true } }),
    discounts: () => prisma.financeDiscount.findMany({ orderBy: { name: "asc" } }),
    scholarships: () => prisma.financeScholarship.findMany({ orderBy: { name: "asc" } }),
    refunds: () => prisma.financeRefund.findMany({ orderBy: { refundedAt: "desc" }, include: { invoice: true } }),
    receipts: () => prisma.financeReceipt.findMany({ orderBy: { issuedAt: "desc" }, include: { invoice: true, payment: { select: { id: true, reference: true, amount: true, method: true, status: true, paidAt: true } } } }),
    incomes: () => prisma.financeIncome.findMany({ orderBy: { receivedAt: "desc" } }),
    recurringExpenses: () => prisma.financeRecurringExpense.findMany({ orderBy: { nextRunAt: "asc" }, include: { vendor: true } }),
    bankAccounts: () => prisma.financeBankAccount.findMany({ orderBy: { name: "asc" } }),
    payrollIntegrations: () => prisma.financePayrollIntegration.findMany({ orderBy: { syncedAt: "desc" } }),
  };
  if (!include[resource]) throw new Error("Unknown finance resource");
  return include[resource]();
}

async function createInvoice(userId, input) {
  const subtotal = money(input.subtotal);
  const discount = money(input.discount);
  const lateFee = money(input.lateFee);
  if (subtotal <= 0) throw new Error("Invoice subtotal must be greater than zero");
  const total = Math.max(0, subtotal - discount + lateFee);
  const dueDate = toDate(input.dueDate, new Date(Date.now() + 7 * 86400000));
  if (dueDate.getTime() <= Date.now()) throw new Error("Invoice due date must be in the future");
  return prisma.$transaction(async (tx) => {
    const studentLookup = String(input.studentRollNumber || input.studentId || "").trim();
    if (!studentLookup) throw new Error("Student roll number or student ID is required");
    const student = await tx.user.findFirst({
      where: { role: "student", OR: [{ id: studentLookup }, { rollNumber: studentLookup }] },
      select: { id: true },
    });
    if (!student) throw new Error(`Student not found for identifier ${studentLookup}`);
    const invoice = await tx.feeInvoice.create({ data: {
      invoiceNumber: input.invoiceNumber || id("INV"), studentId: student.id,
      assignmentId: input.assignmentId || null, dueDate,
      subtotal, discount, lateFee, total, status: "ISSUED", notes: input.notes || null, createdById: userId,
    } });
    const accounts = await ensureSystemAccounts(tx);
    await createPostedJournal(tx, { description: `Invoice ${invoice.invoiceNumber}`, source: "FEE_INVOICE", createdById: userId, lines: [
      { accountId: accounts["1100"].id, debit: total }, { accountId: accounts["4000"].id, credit: total },
    ] });
    return invoice;
  }, ACCOUNTING_TRANSACTION_OPTIONS);
}

async function deleteInvoice(userId, invoiceId) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.feeInvoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { select: { id: true } }, gatewayOrders: { select: { id: true } } },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.deletedAt) throw new Error("This fee due has already been deleted");
    if (invoice.status !== "ISSUED") throw new Error("Only ISSUED fee dues can be deleted");
    if (money(invoice.paidAmount) > 0 || invoice.payments.length || invoice.gatewayOrders.length) {
      throw new Error("This fee due has payment activity and must remain permanently stored");
    }
    return tx.feeInvoice.update({
      where: { id: invoiceId },
      data: { status: "CANCELLED", deletedAt: new Date(), deletedById: userId, deletionReason: "Mistaken fee due removed by administrator" },
    });
  }, ACCOUNTING_TRANSACTION_OPTIONS);
}

async function recordPayment(userId, input) {
  const amount = money(input.amount);
  if (amount <= 0) throw new Error("Payment amount must be greater than zero");
  return prisma.$transaction(async (tx) => {
    const invoice = input.invoiceId ? await tx.feeInvoice.findUnique({ where: { id: input.invoiceId } }) : null;
    if (input.invoiceId && !invoice) throw new Error("Invoice not found");
    if (invoice?.deletedAt || invoice?.status === "CANCELLED") throw new Error("This fee due is deleted and cannot receive payments");
    if (invoice && amount > money(invoice.total) - money(invoice.paidAmount) + 0.01) throw new Error("Payment exceeds invoice balance");
    const payment = await tx.financePayment.create({ data: { reference: input.reference || id("PAY"), invoiceId: input.invoiceId || null, amount, method: input.method || "CASH", notes: input.notes || null, receivedById: userId } });
    if (invoice) {
      const paidAmount = money(invoice.paidAmount) + amount;
      await tx.feeInvoice.update({ where: { id: invoice.id }, data: { paidAmount, status: paidAmount >= money(invoice.total) ? "PAID" : "PARTIALLY_PAID" } });
      await tx.financeReceipt.create({ data: { receiptNumber: id("RCT"), invoiceId: invoice.id, paymentId: payment.id } });
    }
    const accounts = await ensureSystemAccounts(tx);
    await createPostedJournal(tx, { description: `Payment ${payment.reference}`, source: "PAYMENT", createdById: userId, lines: [
      { accountId: accounts["1000"].id, debit: amount }, { accountId: accounts["1100"].id, credit: amount },
    ] });
    return payment;
  }, ACCOUNTING_TRANSACTION_OPTIONS);
}

async function createExpense(userId, input) {
  const amount = money(input.amount);
  if (amount <= 0) throw new Error("Expense amount must be greater than zero");
  return prisma.financeExpenseBill.create({ data: { billNumber: input.billNumber || id("BILL"), vendorId: input.vendorId || null, categoryId: input.categoryId || null, amount, billDate: toDate(input.billDate), dueDate: input.dueDate ? toDate(input.dueDate) : null, description: input.description || null, status: "SUBMITTED", createdById: userId } });
}

async function updateExpense(userId, billId, status, comment) {
  if (!["APPROVED", "REJECTED", "PAID"].includes(status)) throw new Error("Invalid expense transition");
  return prisma.$transaction(async (tx) => {
    const bill = await tx.financeExpenseBill.findUnique({ where: { id: billId } });
    if (!bill) throw new Error("Expense bill not found");
    const updated = await tx.financeExpenseBill.update({ where: { id: billId }, data: { status } });
    await tx.financeExpenseApproval.create({ data: { billId, approverId: userId, status: status === "REJECTED" ? "REJECTED" : "APPROVED", comment, decidedAt: new Date() } });
    if (status === "APPROVED") {
      const accounts = await ensureSystemAccounts(tx);
      await createPostedJournal(tx, { description: `Expense ${bill.billNumber}`, source: "EXPENSE_BILL", createdById: userId, lines: [
        { accountId: accounts["5000"].id, debit: bill.amount }, { accountId: accounts["2000"].id, credit: bill.amount },
      ] });
    }
    return updated;
  }, ACCOUNTING_TRANSACTION_OPTIONS);
}

async function createJournal(userId, input) {
  if (!input.description || !Array.isArray(input.lines) || input.lines.length < 2) throw new Error("A journal needs a description and at least two lines");
  return prisma.$transaction((tx) => createPostedJournal(tx, { description: input.description, source: "MANUAL", createdById: userId, lines: input.lines }), ACCOUNTING_TRANSACTION_OPTIONS);
}

module.exports = { dashboard, list, createInvoice, deleteInvoice, recordPayment, createExpense, updateExpense, createJournal };
