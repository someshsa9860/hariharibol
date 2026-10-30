-- Marketing on WhatsApp: the approved message templates, the messages sent and received, and the chat per
-- number. Follows 20261116000000_marketing, which holds the email tables and the Marketing permissions.

-- CreateEnum
CREATE TYPE "WhatsAppDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "MarketingCampaign" ADD COLUMN     "whatsappTemplateId" TEXT;

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(512) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "metaTemplateId" VARCHAR(64),
    "components" JSONB NOT NULL,
    "variableMap" JSONB NOT NULL,
    "rejectionReason" VARCHAR(500),
    "quality" VARCHAR(20),
    "lastSyncedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "direction" "WhatsAppDirection" NOT NULL,
    "waId" VARCHAR(20) NOT NULL,
    "messageId" VARCHAR(120),
    "kind" VARCHAR(20) NOT NULL,
    "body" TEXT,
    "templateId" TEXT,
    "deliveryId" TEXT,
    "status" VARCHAR(20),
    "errorCode" INTEGER,
    "errorMessage" VARCHAR(300),
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppChat" (
    "waId" VARCHAR(20) NOT NULL,
    "userId" TEXT,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "unhandled" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppChat_pkey" PRIMARY KEY ("waId")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_metaTemplateId_key" ON "WhatsAppTemplate"("metaTemplateId");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_status_idx" ON "WhatsAppTemplate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_name_language_key" ON "WhatsAppTemplate"("name", "language");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_messageId_key" ON "WhatsAppMessage"("messageId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_waId_createdAt_idx" ON "WhatsAppMessage"("waId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_direction_handled_createdAt_idx" ON "WhatsAppMessage"("direction", "handled", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_deliveryId_idx" ON "WhatsAppMessage"("deliveryId");

-- CreateIndex
CREATE INDEX "WhatsAppChat_lastInboundAt_idx" ON "WhatsAppChat"("lastInboundAt");

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_whatsappTemplateId_fkey" FOREIGN KEY ("whatsappTemplateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "MarketingDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

