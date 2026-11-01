ALTER TABLE "FeeInvoice"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT,
  ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "FeeInvoice_deletedAt_idx" ON "FeeInvoice"("deletedAt");

ALTER TABLE "FeeInvoice"
  ADD CONSTRAINT "FeeInvoice_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
