-- Revenue per payment: original currency, INR gross / commission / net, and the
-- exchange rate used. Store subscription lifecycle fields. See services/payments/money.js.

ALTER TABLE "Payment"
  ADD COLUMN "isTrial" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "commissionMinor" INTEGER,
  ADD COLUMN "netMinor" INTEGER,
  ADD COLUMN "grossInrMinor" INTEGER,
  ADD COLUMN "commissionInrMinor" INTEGER,
  ADD COLUMN "netInrMinor" INTEGER,
  ADD COLUMN "commissionSource" TEXT,
  ADD COLUMN "commissionRate" DECIMAL(6,4),
  ADD COLUMN "fxRate" DECIMAL(18,8),
  ADD COLUMN "fxSource" TEXT,
  ADD COLUMN "fxDate" DATE;

CREATE INDEX "Payment_grossInrMinor_paidAt_idx" ON "Payment"("grossInrMinor", "paidAt");

ALTER TABLE "Subscription"
  ADD COLUMN "lastEvent" TEXT,
  ADD COLUMN "lastEventAt" TIMESTAMP(3),
  ADD COLUMN "billingIssueAt" TIMESTAMP(3);

CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "date" DATE NOT NULL,
    "inrPerUnit" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FxRate_currency_date_key" ON "FxRate"("currency", "date");

-- Rows written before this migration that are already in rupees: no conversion
-- is needed, and the commission is the configured default (15% store, 2% Razorpay).
-- Rows in another currency are left null; the nightly job converts them.
UPDATE "Payment" SET
  "grossInrMinor" = "amountMinor",
  "fxRate" = 1, "fxSource" = 'IDENTITY', "fxDate" = COALESCE("paidAt", "createdAt")::date,
  "commissionRate" = CASE WHEN "provider" = 'RAZORPAY' THEN 0.02 ELSE 0.15 END,
  "commissionSource" = 'RATE'
WHERE "currency" = 'INR' AND "status" IN ('SUCCEEDED','REFUNDED');

UPDATE "Payment" SET
  "commissionMinor" = ROUND("amountMinor" * "commissionRate"),
  "commissionInrMinor" = ROUND("amountMinor" * "commissionRate")
WHERE "grossInrMinor" IS NOT NULL;

UPDATE "Payment" SET
  "netMinor" = "amountMinor" - "commissionMinor",
  "netInrMinor" = "amountMinor" - "commissionInrMinor"
WHERE "grossInrMinor" IS NOT NULL;
