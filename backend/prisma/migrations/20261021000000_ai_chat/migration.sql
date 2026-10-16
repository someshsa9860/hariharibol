-- CreateEnum
CREATE TYPE "AiWalletTxType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "AiWalletSource" AS ENUM ('CHAT', 'SUMMARIZATION', 'ADMIN_GRANT', 'ADMIN_ADJUST', 'PLAN_RENEWAL', 'OTHER_AI_FEATURE');

-- CreateEnum
CREATE TYPE "AiModelTier" AS ENUM ('BASIC', 'ADVANCED');

-- CreateEnum
CREATE TYPE "AiRenewal" AS ENUM ('MONTHLY', 'NEVER');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ChatMessageStatus" AS ENUM ('COMPLETE', 'PARTIAL', 'STOPPED', 'ERROR');

-- AlterTable
ALTER TABLE "AiUsageLog" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "AiPlanConfig" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "levelName" VARCHAR(50) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyTokens" INTEGER NOT NULL DEFAULT 0,
    "walletTokens" INTEGER NOT NULL DEFAULT 0,
    "renewal" "AiRenewal" NOT NULL DEFAULT 'MONTHLY',
    "conversationTokens" INTEGER NOT NULL DEFAULT 0,
    "modelTier" "AiModelTier" NOT NULL DEFAULT 'BASIC',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiPlanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "balance" INTEGER NOT NULL,
    "allocation" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiWalletTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AiWalletTxType" NOT NULL,
    "tokens" INTEGER NOT NULL,
    "source" "AiWalletSource" NOT NULL,
    "referenceId" TEXT,
    "note" TEXT,
    "balanceAfter" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiWalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiDailyUsage" (
    "userId" TEXT NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiDailyUsage_pkey" PRIMARY KEY ("userId","date")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL DEFAULT 'New chat',
    "contextSummary" TEXT,
    "summarizedThroughSeq" INTEGER NOT NULL DEFAULT 0,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "carriedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ChatMessageStatus" NOT NULL DEFAULT 'COMPLETE',
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "model" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiPlanConfig_planId_key" ON "AiPlanConfig"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "AiWallet_userId_key" ON "AiWallet"("userId");

-- CreateIndex
CREATE INDEX "AiWallet_periodEnd_idx" ON "AiWallet"("periodEnd");

-- CreateIndex
CREATE INDEX "AiWalletTransaction_userId_createdAt_idx" ON "AiWalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiWalletTransaction_source_createdAt_idx" ON "AiWalletTransaction"("source", "createdAt");

-- CreateIndex
CREATE INDEX "AiDailyUsage_date_idx" ON "AiDailyUsage"("date");

-- CreateIndex
CREATE INDEX "ChatConversation_userId_lastMessageAt_idx" ON "ChatConversation"("userId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_conversationId_seq_key" ON "ChatMessage"("conversationId", "seq");

-- AddForeignKey
ALTER TABLE "AiPlanConfig" ADD CONSTRAINT "AiPlanConfig_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWallet" ADD CONSTRAINT "AiWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWalletTransaction" ADD CONSTRAINT "AiWalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDailyUsage" ADD CONSTRAINT "AiDailyUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The permission, and the starting allowances. Production runs `migrate deploy` on every
-- release and the seed does not, so what the page needs on day one is inserted here.
-- The seed's own upserts of the same rows are no-ops afterwards.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_chat_manage', 'chat.manage', 'Edit the AI chat persona, limits and plan allowances; grant credits', 'system', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" IN ('admin', 'super_admin')
  AND p."slug" = 'chat.manage'
ON CONFLICT DO NOTHING;

INSERT INTO "AiPlanConfig" ("id", "planId", "levelName", "dailyTokens", "walletTokens", "renewal", "conversationTokens", "modelTier", "updatedAt")
SELECT 'aipc_' || sp."slug", sp."id",
       CASE WHEN sp."isFree" THEN 'Jigyasu' ELSE 'Bhakta' END,
       CASE WHEN sp."isFree" THEN 6000 ELSE 40000 END,
       CASE WHEN sp."isFree" THEN 60000 ELSE 800000 END,
       'MONTHLY'::"AiRenewal",
       CASE WHEN sp."isFree" THEN 20000 ELSE 80000 END,
       CASE WHEN sp."isFree" THEN 'BASIC' ELSE 'ADVANCED' END::"AiModelTier",
       CURRENT_TIMESTAMP
FROM "SubscriptionPlan" sp
WHERE sp."slug" IN ('free', 'premium')
ON CONFLICT ("planId") DO NOTHING;
