const service = require("./finance.service");
const { analyzeFinance } = require("../../ai/finance-analysis.service");

const normalize = (value) => {
  if (value instanceof Date) return value.toISOString();
  // Prisma Decimal must be converted before generic object recursion. Otherwise
  // the client receives Decimal internals instead of a JSON number.
  if (value && typeof value.toNumber === "function") return value.toNumber();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
};

const csvEscape = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function rowsFor(resource, data) {
  if (!Array.isArray(data)) return [{ field: "value", value: JSON.stringify(normalize(data)) }];
  return data.map((row) => {
    const normalized = normalize(row);
    return {
      id: normalized.id || normalized.reference || normalized.invoiceNumber || normalized.billNumber || normalized.entryNumber || "",
      name: normalized.name || normalized.description || normalized.source || "",
      status: normalized.status || "",
      amount: normalized.amount ?? normalized.total ?? normalized.totalDebit ?? normalized.assignedAmount ?? normalized.fixedAmount ?? normalized.currentValue ?? normalized.allocated ?? normalized.paidAmount ?? normalized.payment?.amount ?? normalized.invoice?.total ?? "",
      date: normalized.paidAt || normalized.issueDate || normalized.billDate || normalized.entryDate || normalized.assignedAt || normalized.dueDate || normalized.receivedAt || normalized.issuedAt || normalized.syncedAt || normalized.createdAt || "",
      resource,
    };
  });
}

function pdfFor(title, rows) {
  const escape = (value) => String(value || "").replace(/([\\()])/g, "\\$1").slice(0, 110);
  const lines = [title, `Generated ${new Date().toISOString()}`, ...rows.slice(0, 42).map((row) => Object.values(row).join(" | "))];
  let y = 800;
  const commands = ["BT", "/F1 10 Tf"];
  for (const line of lines) { commands.push(`1 0 0 1 40 ${y} Tm (${escape(line)}) Tj`); y -= 17; if (y < 40) break; }
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

class FinanceController {
  async dashboard(req, res) { return this._run(res, () => service.dashboard()); }
  async list(req, res) { return this._run(res, () => service.list(req.params.resource)); }
  async createInvoice(req, res) { return this._run(res, () => service.createInvoice(req.user.id, req.body), 201); }
  async deleteInvoice(req, res) { return this._run(res, () => service.deleteInvoice(req.user.id, req.params.id)); }
  async recordPayment(req, res) { return this._run(res, () => service.recordPayment(req.user.id, req.body), 201); }
  async createExpense(req, res) { return this._run(res, () => service.createExpense(req.user.id, req.body), 201); }
  async updateExpense(req, res) { return this._run(res, () => service.updateExpense(req.user.id, req.params.id, req.body.status, req.body.comment)); }
  async createJournal(req, res) { return this._run(res, () => service.createJournal(req.user.id, req.body), 201); }

  async export(req, res) {
    try {
      const resource = req.query.resource || "invoices";
      const format = String(req.query.format || "csv").toLowerCase();
      const data = resource === "dashboard" ? await service.dashboard() : await service.list(resource);
      const rows = resource === "dashboard"
        ? Object.entries(data.kpis || {}).map(([metric, value]) => ({ metric, value }))
          .concat((data.trend || []).map((point) => ({ metric: point.month, income: point.income, expenses: point.expenses })))
        : rowsFor(resource, data);
      if (format === "pdf") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="radora-${resource}.pdf"`);
        return res.end(pdfFor(`Radora Finance — ${resource}`, rows));
      }
      const header = Object.keys(rows[0] || { resource: "" });
      const body = [header.join(","), ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="radora-${resource}.csv"`);
      return res.send(body);
    } catch (err) { return this._error(res, err); }
  }

  async intelligence(req, res) {
    try {
      const snapshot = await service.dashboard();
      return res.json({ generatedAt: snapshot.asOf, recommendations: snapshot.recommendations, forecast: snapshot.trend.map((point, index, series) => ({ month: point.month, projectedCollections: Math.round((point.income || (series[index - 1]?.income || 0)) * 1.03), projectedExpenses: Math.round((point.expenses || (series[index - 1]?.expenses || 0)) * 1.02) })), guardrail: "AI and analytics are read-only. Accounting records can only be changed through approved finance transactions." });
    } catch (err) { return this._error(res, err); }
  }

  async aiAnalysis(req, res) {
    try {
      const snapshot = await service.dashboard();
      const analysis = await analyzeFinance(snapshot);
      return res.json({ generatedAt: snapshot.asOf, analysis, kpis: snapshot.kpis, trend: snapshot.trend });
    } catch (err) { return this._error(res, err); }
  }

  async assistant(req, res) {
    try {
      const snapshot = await service.dashboard();
      const query = String(req.body.query || "").toLowerCase();
      let answer = `Current collections are ${snapshot.kpis.collected.toFixed(2)}, outstanding fees are ${snapshot.kpis.outstanding.toFixed(2)}, and expenses are ${snapshot.kpis.expenses.toFixed(2)}.`;
      if (query.includes("overdue")) answer = `${snapshot.kpis.overdueCount} invoice(s) are overdue. ${snapshot.recommendations[0]?.detail || "No additional action was detected."}`;
      if (query.includes("forecast")) answer = "The forecast is deterministic and read-only: it uses the recent six-month collections and expense trend with a conservative 3%/2% directional adjustment.";
      return res.json({ answer, sources: ["posted journal entries", "invoices", "completed payments", "expense bills"], canModifyAccounting: false });
    } catch (err) { return this._error(res, err); }
  }

  _run(res, action, status = 200) { return Promise.resolve().then(action).then((data) => res.status(status).json(normalize(data))).catch((err) => this._error(res, err)); }
  _error(res, err) { const notFound = /not found|Unknown/.test(err.message || ""); return res.status(notFound ? 404 : 400).json({ error: err.message || "Finance operation failed" }); }
}

module.exports = new FinanceController();
