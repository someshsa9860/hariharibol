-- The super admin's books: manual credit/debit lines and one row per confirmed month.
-- Revenue and AI spend are read from Payment and AiUsageLog, never copied here.
CREATE TYPE "FinanceDirection" AS ENUM ('CREDIT', 'DEBIT');

CREATE TABLE "FinanceEntry" (
    "id" TEXT NOT NULL,
    "direction" "FinanceDirection" NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "amountInr" INTEGER NOT NULL,
    "occurredOn" DATE NOT NULL,
    "note" VARCHAR(500),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FinanceEntry_occurredOn_idx" ON "FinanceEntry"("occurredOn");

CREATE TABLE "FinanceMonth" (
    "month" VARCHAR(7) NOT NULL,
    "usdInrRate" DECIMAL(10,4),
    "costsConfirmedAt" TIMESTAMP(3),
    "costsConfirmedById" TEXT,
    "lastRemindedOn" DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinanceMonth_pkey" PRIMARY KEY ("month")
);

-- finance.manage belongs to super_admin alone; the admin role does not get it.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_finance_manage', 'finance.manage', 'View revenue, AI cost and the books; add credit and debit entries (super admin only)', 'system', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" = 'super_admin' AND p."slug" = 'finance.manage'
ON CONFLICT DO NOTHING;
