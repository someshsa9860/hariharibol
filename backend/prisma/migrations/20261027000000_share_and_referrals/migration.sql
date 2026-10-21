-- Verse/mantra/reel share links, referral codes with a reward ledger, and AI share backgrounds.
-- See "Sharing and referrals" in backend/CLAUDE.md.

ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'REFERRAL';

CREATE TYPE "ShareKind" AS ENUM ('SHLOKA', 'MANTRA', 'REEL');
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'REWARDED', 'REJECTED');

CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "kind" "ShareKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "opens" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShareLink_code_key" ON "ShareLink"("code");
CREATE UNIQUE INDEX "ShareLink_kind_targetId_key" ON "ShareLink"("kind", "targetId");

CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferralCode_userId_key" ON "ReferralCode"("userId");
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" VARCHAR(100),
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifiedAt" TIMESTAMP(3),
    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Referral_refereeId_key" ON "Referral"("refereeId");
CREATE INDEX "Referral_referrerId_status_idx" ON "Referral"("referrerId", "status");
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferralReward_referralId_key" ON "ReferralReward"("referralId");
CREATE INDEX "ReferralReward_userId_createdAt_idx" ON "ReferralReward"("userId", "createdAt");
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ShareBackground" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" VARCHAR(64) NOT NULL,
    "prompt" VARCHAR(600) NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'PENDING',
    "tokens" INTEGER NOT NULL,
    "imagePath" TEXT,
    "failReason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareBackground_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShareBackground_userId_requestId_key" ON "ShareBackground"("userId", "requestId");
