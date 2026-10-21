-- CreateEnum
CREATE TYPE "PushEventType" AS ENUM ('DELIVERED', 'OPENED', 'ENGAGED');

-- CreateTable
CREATE TABLE "PushCampaign" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "type" "NotificationType" NOT NULL,
    "source" VARCHAR(40) NOT NULL DEFAULT 'system',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetedUsers" INTEGER NOT NULL DEFAULT 0,
    "sentDevices" INTEGER NOT NULL DEFAULT 0,
    "failedDevices" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT,
    "event" "PushEventType" NOT NULL,
    "durationMs" INTEGER,
    "screen" VARCHAR(200),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushEvent_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "campaignId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PushCampaign_key_key" ON "PushCampaign"("key");
CREATE INDEX "PushCampaign_createdAt_idx" ON "PushCampaign"("createdAt");
CREATE UNIQUE INDEX "PushEvent_campaignId_deviceId_event_key" ON "PushEvent"("campaignId", "deviceId", "event");
CREATE INDEX "PushEvent_campaignId_event_idx" ON "PushEvent"("campaignId", "event");
CREATE INDEX "Notification_campaignId_idx" ON "Notification"("campaignId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PushCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PushEvent" ADD CONSTRAINT "PushEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PushCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushEvent" ADD CONSTRAINT "PushEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
