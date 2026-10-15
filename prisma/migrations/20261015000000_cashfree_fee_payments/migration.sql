ALTER TYPE "FinancePaymentStatus" ADD VALUE IF NOT EXISTS 'FAILED';

CREATE TYPE "CashfreeOrderStatus" AS ENUM ('ACTIVE', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

ALTER TABLE "FinancePayment"
  ADD COLUMN "gatewayOrderId" TEXT,
  ADD COLUMN "gatewayPaymentId" TEXT,
  ADD COLUMN "gatewayPayload" JSONB;

CREATE TABLE "FinanceGatewayOrder" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "paymentSessionId" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "CashfreeOrderStatus" NOT NULL DEFAULT 'ACTIVE',
  "cashfreePaymentId" TEXT,
  "lastEventType" TEXT,
  "lastWebhookAt" TIMESTAMP(3),
  "rawPayload" JSONB,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceGatewayOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancePayment_gatewayOrderId_key" ON "FinancePayment"("gatewayOrderId");
CREATE UNIQUE INDEX "FinanceGatewayOrder_orderId_key" ON "FinanceGatewayOrder"("orderId");
CREATE UNIQUE INDEX "FinanceGatewayOrder_active_invoice_key" ON "FinanceGatewayOrder"("invoiceId") WHERE "status" = 'ACTIVE';
CREATE INDEX "FinanceGatewayOrder_invoiceId_status_idx" ON "FinanceGatewayOrder"("invoiceId", "status");
CREATE INDEX "FinanceGatewayOrder_studentId_status_idx" ON "FinanceGatewayOrder"("studentId", "status");

ALTER TABLE "FinanceGatewayOrder" ADD CONSTRAINT "FinanceGatewayOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceGatewayOrder" ADD CONSTRAINT "FinanceGatewayOrder_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_gatewayOrderId_fkey" FOREIGN KEY ("gatewayOrderId") REFERENCES "FinanceGatewayOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
