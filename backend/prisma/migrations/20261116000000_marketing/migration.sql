-- Marketing: campaigns, templates, lists, contacts, and the consent and suppression records for email.
-- The Marketing permissions are given to the admin roles here so the deploy is enough; `npm run seed`
-- still owns the full role definitions. WhatsApp's tables come in 20261117000000_marketing_whatsapp.

-- CreateEnum
CREATE TYPE "MarketingChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "MarketingCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketingVariantStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "MarketingVariantSource" AS ENUM ('AI', 'HUMAN');

-- CreateEnum
CREATE TYPE "MarketingAudienceMode" AS ENUM ('MERGE', 'AI_PER_USER');

-- CreateEnum
CREATE TYPE "MarketingDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'BOUNCED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MarketingSuppressionReason" AS ENUM ('UNSUBSCRIBE', 'HARD_BOUNCE', 'COMPLAINT', 'WHATSAPP_STOP', 'MANUAL');

-- CreateEnum
CREATE TYPE "MarketingLinkKind" AS ENUM ('WEB', 'APP');

-- CreateEnum
CREATE TYPE "MarketingAttributionKind" AS ENUM ('CLICK', 'APP_OPEN', 'INSTALL_REFERRER', 'SIGNUP_EMAIL_MATCH');

-- CreateTable
CREATE TABLE "MarketingTemplate" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "brief" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingTemplateVariant" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "preheader" VARCHAR(200),
    "blocks" JSONB NOT NULL,
    "status" "MarketingVariantStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "MarketingVariantSource" NOT NULL DEFAULT 'HUMAN',
    "editedByHuman" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingTemplateVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingSegment" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "filter" JSONB NOT NULL,
    "lastCount" INTEGER,
    "lastCountAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingImport" (
    "id" TEXT NOT NULL,
    "fileName" VARCHAR(200),
    "attestation" TEXT NOT NULL,
    "wordingVersion" VARCHAR(20) NOT NULL,
    "attestsEmail" BOOLEAN NOT NULL DEFAULT false,
    "attestsWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "attestedById" TEXT,
    "attestedByName" TEXT,
    "rows" INTEGER NOT NULL DEFAULT 0,
    "added" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingContact" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254),
    "emailKey" VARCHAR(254),
    "phone" VARCHAR(20),
    "name" VARCHAR(120),
    "language" VARCHAR(10),
    "whatsappOptInAt" TIMESTAMP(3),
    "importId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingList" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(400),
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingListMember" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingListMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "channel" "MarketingChannel" NOT NULL DEFAULT 'EMAIL',
    "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "templateId" TEXT,
    "segmentId" TEXT,
    "audience" JSONB NOT NULL,
    "mode" "MarketingAudienceMode" NOT NULL DEFAULT 'MERGE',
    "provider" VARCHAR(20),
    "model" VARCHAR(100),
    "maxCostMicros" INTEGER,
    "ratePerMinute" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "jobId" TEXT,
    "pauseReason" VARCHAR(30),
    "statusMessage" TEXT,
    "resumeAt" TIMESTAMP(3),
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "retriesInARow" INTEGER NOT NULL DEFAULT 0,
    "heartbeatAt" TIMESTAMP(3),
    "materialisedAt" TIMESTAMP(3),
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "read" INTEGER NOT NULL DEFAULT 0,
    "bounced" INTEGER NOT NULL DEFAULT 0,
    "complained" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingLink" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "MarketingLinkKind" NOT NULL,
    "target" VARCHAR(500) NOT NULL,
    "label" VARCHAR(120),

    CONSTRAINT "MarketingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingDelivery" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channel" "MarketingChannel" NOT NULL,
    "userId" TEXT,
    "contactId" TEXT,
    "status" "MarketingDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "skipReason" VARCHAR(40),
    "language" VARCHAR(10),
    "subject" VARCHAR(200),
    "aiBlocks" JSONB,
    "providerMessageId" VARCHAR(200),
    "error" VARCHAR(500),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingClick" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAttribution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "kind" "MarketingAttributionKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingPreference" (
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappPhone" VARCHAR(20),
    "whatsappVerifiedAt" TIMESTAMP(3),
    "whatsappOptInAt" TIMESTAMP(3),
    "whatsappOptOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MarketingSuppression" (
    "id" TEXT NOT NULL,
    "channel" "MarketingChannel" NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "reason" "MarketingSuppressionReason" NOT NULL,
    "note" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingConsentLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "contactId" TEXT,
    "channel" "MarketingChannel" NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "wordingVersion" VARCHAR(20),
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingTemplateVariant_language_status_idx" ON "MarketingTemplateVariant"("language", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingTemplateVariant_templateId_language_key" ON "MarketingTemplateVariant"("templateId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingContact_emailKey_key" ON "MarketingContact"("emailKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingContact_phone_key" ON "MarketingContact"("phone");

-- CreateIndex
CREATE INDEX "MarketingContact_importId_idx" ON "MarketingContact"("importId");

-- CreateIndex
CREATE INDEX "MarketingListMember_contactId_idx" ON "MarketingListMember"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingListMember_listId_contactId_key" ON "MarketingListMember"("listId", "contactId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_status_scheduledAt_idx" ON "MarketingCampaign"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "MarketingCampaign_status_createdAt_idx" ON "MarketingCampaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingCampaign_channel_createdAt_idx" ON "MarketingCampaign"("channel", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingLink_campaignId_position_key" ON "MarketingLink"("campaignId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingDelivery_code_key" ON "MarketingDelivery"("code");

-- CreateIndex
CREATE INDEX "MarketingDelivery_campaignId_status_idx" ON "MarketingDelivery"("campaignId", "status");

-- CreateIndex
CREATE INDEX "MarketingDelivery_providerMessageId_idx" ON "MarketingDelivery"("providerMessageId");

-- CreateIndex
CREATE INDEX "MarketingDelivery_userId_createdAt_idx" ON "MarketingDelivery"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingDelivery_campaignId_userId_key" ON "MarketingDelivery"("campaignId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingDelivery_campaignId_contactId_key" ON "MarketingDelivery"("campaignId", "contactId");

-- CreateIndex
CREATE INDEX "MarketingClick_campaignId_createdAt_idx" ON "MarketingClick"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingClick_deliveryId_createdAt_idx" ON "MarketingClick"("deliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingAttribution_campaignId_kind_idx" ON "MarketingAttribution"("campaignId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAttribution_userId_campaignId_kind_key" ON "MarketingAttribution"("userId", "campaignId", "kind");

-- CreateIndex
CREATE INDEX "MarketingPreference_whatsappPhone_idx" ON "MarketingPreference"("whatsappPhone");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSuppression_channel_hash_key" ON "MarketingSuppression"("channel", "hash");

-- CreateIndex
CREATE INDEX "MarketingConsentLog_userId_createdAt_idx" ON "MarketingConsentLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingConsentLog_contactId_createdAt_idx" ON "MarketingConsentLog"("contactId", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketingTemplateVariant" ADD CONSTRAINT "MarketingTemplateVariant_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContact" ADD CONSTRAINT "MarketingContact_importId_fkey" FOREIGN KEY ("importId") REFERENCES "MarketingImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingListMember" ADD CONSTRAINT "MarketingListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MarketingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingListMember" ADD CONSTRAINT "MarketingListMember_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "MarketingContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "MarketingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingLink" ADD CONSTRAINT "MarketingLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDelivery" ADD CONSTRAINT "MarketingDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDelivery" ADD CONSTRAINT "MarketingDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDelivery" ADD CONSTRAINT "MarketingDelivery_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "MarketingContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingClick" ADD CONSTRAINT "MarketingClick_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingClick" ADD CONSTRAINT "MarketingClick_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MarketingLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingClick" ADD CONSTRAINT "MarketingClick_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "MarketingDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAttribution" ADD CONSTRAINT "MarketingAttribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAttribution" ADD CONSTRAINT "MarketingAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAttribution" ADD CONSTRAINT "MarketingAttribution_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "MarketingDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingPreference" ADD CONSTRAINT "MarketingPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- The Marketing permissions. `send` is super admin only: it reaches real people and spends money.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_marketing_read', 'marketing.read', 'See campaigns, templates, lists and their results', 'marketing', CURRENT_TIMESTAMP),
    ('perm_marketing_manage', 'marketing.manage', 'Write templates, build lists and segments, import contacts and draft campaigns', 'marketing', CURRENT_TIMESTAMP),
    ('perm_marketing_send', 'marketing.send', 'Start, pause and cancel campaigns that reach people, and send test messages (super admin only)', 'marketing', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" IN ('admin', 'super_admin')
  AND p."slug" IN ('marketing.read', 'marketing.manage')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" = 'super_admin'
  AND p."slug" = 'marketing.send'
ON CONFLICT DO NOTHING;
