-- Plans become tiers; what they cost moves to PlanPrice (per store, per period);
-- what they unlock is Feature + PlanFeature. Existing plan rows and their store
-- product ids are carried across, so nothing already sold is orphaned.

-- CreateEnum
CREATE TYPE "FeatureKind" AS ENUM ('FLAG', 'LIMIT');

-- AlterTable
ALTER TABLE "SubscriptionPlan"
    ADD COLUMN "tier" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "isFree" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "grantedToDonors" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "priceId" TEXT;

-- CreateTable
CREATE TABLE "PlanPrice" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "productId" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "periodDays" INTEGER NOT NULL DEFAULT 30,
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "FeatureKind" NOT NULL DEFAULT 'FLAG',
    "unit" VARCHAR(40),
    "defaultEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanFeature" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limit" INTEGER,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

-- Carry each existing plan's store products over as prices, then the plan's own
-- columns for them can go. The old plan was the one paid tier.
UPDATE "SubscriptionPlan" SET "tier" = 1, "grantedToDonors" = true;
UPDATE "SubscriptionPlan" SET "slug" = 'premium' WHERE "slug" = 'premium-monthly';

INSERT INTO "PlanPrice" ("id", "planId", "provider", "productId", "priceMinor", "currency", "periodDays", "updatedAt")
SELECT 'pp_' || md5("id" || 'GOOGLE_PLAY'), "id", 'GOOGLE_PLAY', "googleProductId", "priceMinor", "currency", "periodDays", CURRENT_TIMESTAMP
FROM "SubscriptionPlan" WHERE "googleProductId" IS NOT NULL;

INSERT INTO "PlanPrice" ("id", "planId", "provider", "productId", "priceMinor", "currency", "periodDays", "updatedAt")
SELECT 'pp_' || md5("id" || 'APPLE_APP_STORE'), "id", 'APPLE_APP_STORE', "appleProductId", "priceMinor", "currency", "periodDays", CURRENT_TIMESTAMP
FROM "SubscriptionPlan" WHERE "appleProductId" IS NOT NULL;

INSERT INTO "PlanPrice" ("id", "planId", "provider", "productId", "priceMinor", "currency", "periodDays", "updatedAt")
SELECT 'pp_' || md5("id" || 'RAZORPAY'), "id", 'RAZORPAY', "razorpayPlanId", "priceMinor", "currency", "periodDays", CURRENT_TIMESTAMP
FROM "SubscriptionPlan" WHERE "razorpayPlanId" IS NOT NULL;

-- Point existing subscriptions at the price they were bought through.
UPDATE "Subscription" s SET "priceId" = pp."id"
FROM "PlanPrice" pp
WHERE pp."planId" = s."planId" AND pp."provider" = s."provider";

-- The free baseline.
INSERT INTO "SubscriptionPlan" ("id", "slug", "name", "description", "tier", "isFree", "isActive", "priceMinor", "currency", "updatedAt")
VALUES ('plan_free', 'free', 'Free', 'Everything that matters, for everyone.', 0, true, true, 0, 'INR', CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "SubscriptionPlan"
    DROP COLUMN "googleProductId",
    DROP COLUMN "appleProductId",
    DROP COLUMN "razorpayPlanId",
    DROP COLUMN "priceMinor",
    DROP COLUMN "currency",
    DROP COLUMN "periodDays";

-- CreateIndex
CREATE INDEX "SubscriptionPlan_isActive_tier_idx" ON "SubscriptionPlan"("isActive", "tier");
DROP INDEX "SubscriptionPlan_isActive_idx";

-- CreateIndex
CREATE INDEX "PlanPrice_planId_isActive_idx" ON "PlanPrice"("planId", "isActive");
CREATE UNIQUE INDEX "PlanPrice_provider_productId_key" ON "PlanPrice"("provider", "productId");
CREATE UNIQUE INDEX "Feature_key_key" ON "Feature"("key");
CREATE INDEX "Feature_isActive_sortOrder_idx" ON "Feature"("isActive", "sortOrder");
CREATE UNIQUE INDEX "PlanFeature_planId_featureId_key" ON "PlanFeature"("planId", "featureId");
CREATE INDEX "PlanFeature_featureId_idx" ON "PlanFeature"("featureId");

-- AddForeignKey
ALTER TABLE "PlanPrice" ADD CONSTRAINT "PlanPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "PlanPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
