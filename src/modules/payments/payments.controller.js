const service = require("./payments.service");

function normalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toNumber === "function") return value.toNumber();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
}

function pdfForReceipt(receipt) {
  const escape = (value) => String(value ?? "").replace(/([\\()])/g, "\\$1").replace(/[^\x20-\x7E]/g, "?").slice(0, 110);
  const lines = ["Radora School", "Official Fee Receipt", `Receipt: ${receipt.receiptNumber}`, `Invoice: ${receipt.invoice.invoiceNumber}`, `Student: ${receipt.invoice.student?.name || "-"}`, `Roll number: ${receipt.invoice.student?.rollNumber || "-"}`, `Amount paid: INR ${Number(receipt.payment?.amount || 0).toFixed(2)}`, `Payment reference: ${receipt.payment?.reference || "-"}`, `Paid on: ${new Date(receipt.payment?.paidAt || receipt.issuedAt).toISOString()}`];
  let y = 780; const commands = ["BT", "/F1 12 Tf"];
  for (const line of lines) { commands.push(`1 0 0 1 50 ${y} Tm (${escape(line)}) Tj`); y -= 28; }
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

class PaymentsController {
  async studentFees(req, res) { return this.run(res, () => service.listStudentFees(req.user.id)); }
  async checkout(req, res) { return this.run(res, () => service.createCheckout(req.user.id, req.params.invoiceId), 201); }
  async orderStatus(req, res) { return this.run(res, () => service.syncOrder(req.user.id, req.params.orderId)); }
  async studentReceipt(req, res) { return this.receipt(req, res, req.user.id); }
  async adminReceipt(req, res) {
    try { const receipt = await service.getAdminReceipt(req.params.receiptId); res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `inline; filename="${receipt.receiptNumber}.pdf"`); return res.end(pdfForReceipt(receipt)); }
    catch (error) { return res.status(/not found/i.test(error.message) ? 404 : 400).json({ error: error.message }); }
  }
  async webhook(req, res) {
    try { await service.processWebhook({ signature: req.headers["x-webhook-signature"], timestamp: req.headers["x-webhook-timestamp"], rawBody: req.rawBody?.toString() || "", payload: req.body }); return res.status(200).json({ received: true }); }
    catch (error) { return res.status(/signature/i.test(error.message) ? 401 : 400).json({ error: error.message }); }
  }
  async receipt(req, res, studentId) {
    try { const receipt = await service.getReceipt(studentId, req.params.receiptId); res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `inline; filename="${receipt.receiptNumber}.pdf"`); return res.end(pdfForReceipt(receipt)); }
    catch (error) { return res.status(/not found/i.test(error.message) ? 404 : 400).json({ error: error.message }); }
  }
  run(res, action, status = 200) { return Promise.resolve().then(action).then((data) => res.status(status).json(normalize(data))).catch((error) => res.status(/not found/i.test(error.message) ? 404 : 400).json({ error: error.message || "Payment operation failed" })); }
}

module.exports = new PaymentsController();
