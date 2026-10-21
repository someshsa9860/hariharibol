-- CreateEnum
CREATE TYPE "ShareContentType" AS ENUM ('VERSE', 'MANTRA', 'REEL');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ReferralSource" AS ENUM ('LINK', 'CODE');

-- CreateEnum
CREATE TYPE "EntitlementGrantSource" AS ENUM ('REFERRAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "ShareImageStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- AlterEnum
ALTER TYPE "AiWalletSource" ADD VALUE 'SHARE_IMAGE';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REFERRAL';

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "type" "ShareContentType" NOT NULL,
    "targetId" VARCHAR(120) NOT NULL,
    "createdById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "source" "ReferralSource" NOT NULL DEFAULT 'LINK',
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" VARCHAR(120),
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifiedAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "source" "EntitlementGrantSource" NOT NULL,
    "referralId" TEXT,
    "note" VARCHAR(200),
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntitlementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareImageJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestKey" VARCHAR(80) NOT NULL,
    "prompt" VARCHAR(600) NOT NULL,
    "status" "ShareImageStatus" NOT NULL DEFAULT 'PENDING',
    "tokens" INTEGER NOT NULL,
    "imagePath" TEXT,
    "error" VARCHAR(200),
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareImageJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_code_key" ON "ShareLink"("code");

-- CreateIndex
CREATE INDEX "ShareLink_type_targetId_idx" ON "ShareLink"("type", "targetId");

-- CreateIndex
CREATE INDEX "ShareLink_createdById_type_targetId_idx" ON "ShareLink"("createdById", "type", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_userId_key" ON "ReferralCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_refereeId_key" ON "Referral"("refereeId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_status_idx" ON "Referral"("referrerId", "status");

-- CreateIndex
CREATE INDEX "Referral_status_attributedAt_idx" ON "Referral"("status", "attributedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EntitlementGrant_referralId_key" ON "EntitlementGrant"("referralId");

-- CreateIndex
CREATE INDEX "EntitlementGrant_userId_endsAt_idx" ON "EntitlementGrant"("userId", "endsAt");

-- CreateIndex
CREATE INDEX "ShareImageJob_createdAt_idx" ON "ShareImageJob"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShareImageJob_userId_requestKey_key" ON "ShareImageJob"("userId", "requestKey");

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareImageJob" ADD CONSTRAINT "ShareImageJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

