-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('SCRIPTURE', 'STOTRA', 'AARTI', 'PRAYER', 'POEM', 'TEXT');

-- CreateEnum
CREATE TYPE "VerseType" AS ENUM ('SHLOKA', 'PROSE', 'LINE', 'REFRAIN', 'MANTRA');

-- CreateEnum
CREATE TYPE "TranslationType" AS ENUM ('TRANSLATION', 'COMMENTARY', 'POETIC_EXPANSION');

-- CreateEnum
CREATE TYPE "ChantSource" AS ENUM ('IN_APP', 'MANUAL');

-- CreateEnum
CREATE TYPE "SlokaSource" AS ENUM ('MANUAL', 'RULE', 'AI');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('VIKARA', 'PRACTICE', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'DONE', 'MOVED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('GEMINI', 'OPENAI');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SLOKA', 'SADHANA', 'ANNOUNCEMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "VerseLinkRelation" AS ENUM ('SAME_CONCEPT', 'EXPANDS_ON', 'QUOTED_IN', 'CONTRASTS_WITH');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('GOOGLE_PLAY', 'APPLE_APP_STORE', 'RAZORPAY');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('SUBSCRIPTION', 'DONATION');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('IN_TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED', 'EXPIRED', 'REFUNDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "authProvider" "AuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "appLanguage" VARCHAR(10) NOT NULL DEFAULT 'en',
    "mantraLanguage" VARCHAR(10) NOT NULL DEFAULT 'sa',
    "readingLanguage" VARCHAR(10) NOT NULL DEFAULT 'en',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    "roleId" TEXT NOT NULL,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "premiumSince" TIMESTAMP(3),
    "premiumUntil" TIMESTAMP(3),
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedReason" TEXT,
    "bannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "group" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "deviceModel" TEXT,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "fcmToken" TEXT,
    "userId" TEXT,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedReason" TEXT,
    "bannedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "bookNumber" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "titleI18n" JSONB,
    "description" TEXT,
    "descriptionI18n" JSONB,
    "sourceLanguage" VARCHAR(10) NOT NULL DEFAULT 'sa',
    "sampradaya" VARCHAR(50) NOT NULL DEFAULT 'vaishnav',
    "deityId" TEXT,
    "coverImagePath" TEXT,
    "audioPath" TEXT,
    "totalCantos" INTEGER NOT NULL DEFAULT 0,
    "totalChapters" INTEGER NOT NULL DEFAULT 0,
    "totalVerses" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Canto" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "titleI18n" JSONB,
    "summary" TEXT,
    "summaryI18n" JSONB,
    "totalChapters" INTEGER NOT NULL DEFAULT 0,
    "totalVerses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Canto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "cantoId" TEXT,
    "cantoNumber" INTEGER,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "titleI18n" JSONB,
    "summary" TEXT,
    "summaryI18n" JSONB,
    "totalVerses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verse" (
    "id" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "bookNumber" INTEGER NOT NULL,
    "cantoNumber" INTEGER,
    "chapterId" TEXT,
    "chapterNumber" INTEGER,
    "verseNumber" INTEGER NOT NULL,
    "verseNumberEnd" INTEGER,
    "type" "VerseType" NOT NULL DEFAULT 'SHLOKA',
    "sanskrit" TEXT,
    "transliteration" TEXT,
    "wordMeanings" JSONB NOT NULL DEFAULT '[]',
    "audioPath" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSlokaEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translator" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" TEXT NOT NULL,
    "nameI18n" JSONB,
    "bio" TEXT,
    "imagePath" TEXT,
    "sampradaya" VARCHAR(50) NOT NULL DEFAULT 'vaishnav',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookTranslator" (
    "bookId" TEXT NOT NULL,
    "translatorId" TEXT NOT NULL,
    "seriesName" TEXT,
    "publishedYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BookTranslator_pkey" PRIMARY KEY ("bookId","translatorId")
);

-- CreateTable
CREATE TABLE "VerseTranslation" (
    "id" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "translatorId" TEXT NOT NULL,
    "languageCode" VARCHAR(10) NOT NULL,
    "type" "TranslationType" NOT NULL DEFAULT 'TRANSLATION',
    "meaning" TEXT NOT NULL,
    "purport" TEXT,
    "sourceRef" VARCHAR(50),
    "audioPath" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerseTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerseExplanation" (
    "id" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "languageCode" VARCHAR(10) NOT NULL,
    "text" TEXT NOT NULL,
    "source" "SlokaSource" NOT NULL DEFAULT 'AI',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerseExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Narration" (
    "id" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "guruId" TEXT,
    "languageCode" VARCHAR(10) NOT NULL,
    "title" TEXT,
    "text" TEXT,
    "audioPath" TEXT,
    "durationMs" INTEGER,
    "sourceNote" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Narration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerseLink" (
    "id" TEXT NOT NULL,
    "sourceVerseId" TEXT NOT NULL,
    "targetVerseId" TEXT NOT NULL,
    "relation" "VerseLinkRelation" NOT NULL DEFAULT 'SAME_CONCEPT',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerseLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" TEXT NOT NULL,
    "nameI18n" JSONB,
    "description" TEXT,
    "category" "IssueCategory" NOT NULL,
    "imagePath" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerseIssue" (
    "verseId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VerseIssue_pkey" PRIMARY KEY ("verseId","issueId")
);

-- CreateTable
CREATE TABLE "UserIssue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "sadhanaDayId" TEXT,
    "intensity" INTEGER,
    "note" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferenceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issueScores" JSONB NOT NULL DEFAULT '{}',
    "topicScores" JSONB NOT NULL DEFAULT '{}',
    "preferredBookNumber" INTEGER,
    "preferredTranslatorId" TEXT,
    "bestDeliveryHour" INTEGER,
    "avgRoundsPerDay" DOUBLE PRECISION,
    "chantConsistency" DOUBLE PRECISION,
    "windowStart" DATE NOT NULL,
    "windowEnd" DATE NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPreferenceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySloka" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "verseId" TEXT NOT NULL,
    "source" "SlokaSource" NOT NULL DEFAULT 'MANUAL',
    "imagePath" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySloka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDailySloka" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "verseId" TEXT NOT NULL,
    "source" "SlokaSource" NOT NULL DEFAULT 'RULE',
    "issueId" TEXT,
    "reason" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDailySloka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verseId" TEXT,
    "mantraId" TEXT,
    "bookId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "verseId" TEXT,
    "cantoNumber" INTEGER,
    "chapterNumber" INTEGER,
    "verseNumber" INTEGER,
    "versesRead" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FcmTopic" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FcmTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FcmSubscription" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FcmSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "googleProductId" TEXT,
    "appleProductId" TEXT,
    "razorpayPlanId" TEXT,
    "priceMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "periodDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "externalId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "externalId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "providerPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "targetType" VARCHAR(50),
    "targetId" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ban" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT,
    "actorId" TEXT,
    "reason" TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),
    "liftedById" TEXT,
    "liftReason" TEXT,

    CONSTRAINT "Ban_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "nativeName" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "isRtl" BOOLEAN NOT NULL DEFAULT false,
    "isAppLanguage" BOOLEAN NOT NULL DEFAULT true,
    "isMantraLanguage" BOOLEAN NOT NULL DEFAULT true,
    "isReadingLanguage" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deity" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" TEXT NOT NULL,
    "nameI18n" JSONB,
    "description" TEXT,
    "imagePath" TEXT,
    "sampradaya" VARCHAR(50) NOT NULL DEFAULT 'vaishnav',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guru" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" TEXT NOT NULL,
    "nameI18n" JSONB,
    "description" TEXT,
    "imagePath" TEXT,
    "sampradaya" VARCHAR(50) NOT NULL DEFAULT 'vaishnav',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guru_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mantra" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deityId" TEXT,
    "guruId" TEXT,
    "sanskrit" TEXT NOT NULL,
    "transliteration" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "sampradaya" VARCHAR(50) NOT NULL DEFAULT 'vaishnav',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audioPath" TEXT,
    "durationMs" INTEGER,
    "standardRounds" INTEGER,
    "standardCount" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mantra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MantraTranslation" (
    "id" TEXT NOT NULL,
    "mantraId" TEXT NOT NULL,
    "languageCode" VARCHAR(10) NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "text" TEXT NOT NULL,
    "meaning" TEXT,
    "purport" TEXT,
    "audioPath" TEXT,
    "durationMs" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MantraTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SadhanaProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyRoundTarget" INTEGER NOT NULL DEFAULT 16,
    "reminderTime" VARCHAR(5),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SadhanaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SadhanaDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "roundTarget" INTEGER NOT NULL DEFAULT 0,
    "roundsCompleted" INTEGER NOT NULL DEFAULT 0,
    "tasksTotal" INTEGER NOT NULL DEFAULT 0,
    "tasksDone" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SadhanaDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChantSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sadhanaDayId" TEXT NOT NULL,
    "mantraId" TEXT,
    "source" "ChantSource" NOT NULL DEFAULT 'IN_APP',
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "beads" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SadhanaTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sadhanaDayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "doneAt" TIMESTAMP(3),
    "movedFromId" TEXT,
    "deferCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SadhanaTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_providerUserId_key" ON "User"("providerUserId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_isBanned_idx" ON "User"("isBanned");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_slug_key" ON "Permission"("slug");

-- CreateIndex
CREATE INDEX "Permission_group_idx" ON "Permission"("group");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId");

-- CreateIndex
CREATE INDEX "Device_isBanned_idx" ON "Device"("isBanned");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Book_bookNumber_key" ON "Book"("bookNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");

-- CreateIndex
CREATE INDEX "Book_type_idx" ON "Book"("type");

-- CreateIndex
CREATE INDEX "Book_sampradaya_idx" ON "Book"("sampradaya");

-- CreateIndex
CREATE INDEX "Book_deityId_idx" ON "Book"("deityId");

-- CreateIndex
CREATE INDEX "Book_isPublished_idx" ON "Book"("isPublished");

-- CreateIndex
CREATE INDEX "Book_displayOrder_idx" ON "Book"("displayOrder");

-- CreateIndex
CREATE INDEX "Canto_bookId_idx" ON "Canto"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "Canto_bookId_number_key" ON "Canto"("bookId", "number");

-- CreateIndex
CREATE INDEX "Chapter_bookId_idx" ON "Chapter"("bookId");

-- CreateIndex
CREATE INDEX "Chapter_cantoId_idx" ON "Chapter"("cantoId");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_bookId_cantoNumber_number_key" ON "Chapter"("bookId", "cantoNumber", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Verse_verseId_key" ON "Verse"("verseId");

-- CreateIndex
CREATE INDEX "Verse_bookId_idx" ON "Verse"("bookId");

-- CreateIndex
CREATE INDEX "Verse_chapterId_idx" ON "Verse"("chapterId");

-- CreateIndex
CREATE INDEX "Verse_bookNumber_idx" ON "Verse"("bookNumber");

-- CreateIndex
CREATE INDEX "Verse_isSlokaEligible_idx" ON "Verse"("isSlokaEligible");

-- CreateIndex
CREATE INDEX "Verse_bookId_cantoNumber_chapterNumber_verseNumber_idx" ON "Verse"("bookId", "cantoNumber", "chapterNumber", "verseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Translator_slug_key" ON "Translator"("slug");

-- CreateIndex
CREATE INDEX "Translator_sampradaya_idx" ON "Translator"("sampradaya");

-- CreateIndex
CREATE INDEX "Translator_isPublished_idx" ON "Translator"("isPublished");

-- CreateIndex
CREATE INDEX "BookTranslator_translatorId_idx" ON "BookTranslator"("translatorId");

-- CreateIndex
CREATE INDEX "VerseTranslation_verseId_languageCode_idx" ON "VerseTranslation"("verseId", "languageCode");

-- CreateIndex
CREATE INDEX "VerseTranslation_translatorId_idx" ON "VerseTranslation"("translatorId");

-- CreateIndex
CREATE INDEX "VerseTranslation_isPublished_idx" ON "VerseTranslation"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "VerseTranslation_verseId_translatorId_languageCode_type_key" ON "VerseTranslation"("verseId", "translatorId", "languageCode", "type");

-- CreateIndex
CREATE INDEX "VerseExplanation_isPublished_idx" ON "VerseExplanation"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "VerseExplanation_verseId_languageCode_key" ON "VerseExplanation"("verseId", "languageCode");

-- CreateIndex
CREATE INDEX "Narration_verseId_languageCode_idx" ON "Narration"("verseId", "languageCode");

-- CreateIndex
CREATE INDEX "Narration_guruId_idx" ON "Narration"("guruId");

-- CreateIndex
CREATE INDEX "Narration_isPublished_idx" ON "Narration"("isPublished");

-- CreateIndex
CREATE INDEX "VerseLink_sourceVerseId_idx" ON "VerseLink"("sourceVerseId");

-- CreateIndex
CREATE INDEX "VerseLink_targetVerseId_idx" ON "VerseLink"("targetVerseId");

-- CreateIndex
CREATE UNIQUE INDEX "VerseLink_sourceVerseId_targetVerseId_relation_key" ON "VerseLink"("sourceVerseId", "targetVerseId", "relation");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_slug_key" ON "Issue"("slug");

-- CreateIndex
CREATE INDEX "Issue_category_idx" ON "Issue"("category");

-- CreateIndex
CREATE INDEX "Issue_isPublished_idx" ON "Issue"("isPublished");

-- CreateIndex
CREATE INDEX "VerseIssue_issueId_weight_idx" ON "VerseIssue"("issueId", "weight");

-- CreateIndex
CREATE INDEX "UserIssue_userId_reportedAt_idx" ON "UserIssue"("userId", "reportedAt");

-- CreateIndex
CREATE INDEX "UserIssue_issueId_idx" ON "UserIssue"("issueId");

-- CreateIndex
CREATE INDEX "UserIssue_sadhanaDayId_idx" ON "UserIssue"("sadhanaDayId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferenceProfile_userId_key" ON "UserPreferenceProfile"("userId");

-- CreateIndex
CREATE INDEX "UserPreferenceProfile_computedAt_idx" ON "UserPreferenceProfile"("computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailySloka_date_key" ON "DailySloka"("date");

-- CreateIndex
CREATE INDEX "DailySloka_verseId_idx" ON "DailySloka"("verseId");

-- CreateIndex
CREATE INDEX "UserDailySloka_userId_date_idx" ON "UserDailySloka"("userId", "date");

-- CreateIndex
CREATE INDEX "UserDailySloka_date_notifiedAt_idx" ON "UserDailySloka"("date", "notifiedAt");

-- CreateIndex
CREATE INDEX "UserDailySloka_verseId_idx" ON "UserDailySloka"("verseId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDailySloka_userId_date_key" ON "UserDailySloka"("userId", "date");

-- CreateIndex
CREATE INDEX "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_verseId_key" ON "Favorite"("userId", "verseId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_mantraId_key" ON "Favorite"("userId", "mantraId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_bookId_key" ON "Favorite"("userId", "bookId");

-- CreateIndex
CREATE INDEX "ReadingProgress_userId_lastReadAt_idx" ON "ReadingProgress"("userId", "lastReadAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_userId_bookId_key" ON "ReadingProgress"("userId", "bookId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "FcmTopic_key_key" ON "FcmTopic"("key");

-- CreateIndex
CREATE INDEX "FcmSubscription_topicId_idx" ON "FcmSubscription"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "FcmSubscription_deviceId_topicId_key" ON "FcmSubscription"("deviceId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_slug_key" ON "SubscriptionPlan"("slug");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_isActive_idx" ON "SubscriptionPlan"("isActive");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_provider_externalId_key" ON "Subscription"("provider", "externalId");

-- CreateIndex
CREATE INDEX "Payment_userId_purpose_idx" ON "Payment"("userId", "purpose");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_purpose_paidAt_idx" ON "Payment"("purpose", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_externalId_key" ON "Payment"("provider", "externalId");

-- CreateIndex
CREATE INDEX "AiUsageLog_operation_createdAt_idx" ON "AiUsageLog"("operation", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_provider_createdAt_idx" ON "AiUsageLog"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_targetType_targetId_idx" ON "AiUsageLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Ban_userId_idx" ON "Ban"("userId");

-- CreateIndex
CREATE INDEX "Ban_deviceId_idx" ON "Ban"("deviceId");

-- CreateIndex
CREATE INDEX "Ban_bannedAt_idx" ON "Ban"("bannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");

-- CreateIndex
CREATE INDEX "Language_isActive_idx" ON "Language"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Deity_slug_key" ON "Deity"("slug");

-- CreateIndex
CREATE INDEX "Deity_sampradaya_idx" ON "Deity"("sampradaya");

-- CreateIndex
CREATE INDEX "Deity_isPublished_idx" ON "Deity"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "Guru_slug_key" ON "Guru"("slug");

-- CreateIndex
CREATE INDEX "Guru_sampradaya_idx" ON "Guru"("sampradaya");

-- CreateIndex
CREATE INDEX "Guru_isPublished_idx" ON "Guru"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "Mantra_slug_key" ON "Mantra"("slug");

-- CreateIndex
CREATE INDEX "Mantra_category_idx" ON "Mantra"("category");

-- CreateIndex
CREATE INDEX "Mantra_sampradaya_idx" ON "Mantra"("sampradaya");

-- CreateIndex
CREATE INDEX "Mantra_deityId_idx" ON "Mantra"("deityId");

-- CreateIndex
CREATE INDEX "Mantra_guruId_idx" ON "Mantra"("guruId");

-- CreateIndex
CREATE INDEX "Mantra_isPublished_idx" ON "Mantra"("isPublished");

-- CreateIndex
CREATE INDEX "MantraTranslation_mantraId_languageCode_idx" ON "MantraTranslation"("mantraId", "languageCode");

-- CreateIndex
CREATE INDEX "MantraTranslation_isPublished_idx" ON "MantraTranslation"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "MantraTranslation_mantraId_languageCode_key" ON "MantraTranslation"("mantraId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "SadhanaProfile_userId_key" ON "SadhanaProfile"("userId");

-- CreateIndex
CREATE INDEX "SadhanaDay_userId_date_idx" ON "SadhanaDay"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SadhanaDay_userId_date_key" ON "SadhanaDay"("userId", "date");

-- CreateIndex
CREATE INDEX "ChantSession_userId_startedAt_idx" ON "ChantSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "ChantSession_sadhanaDayId_idx" ON "ChantSession"("sadhanaDayId");

-- CreateIndex
CREATE UNIQUE INDEX "SadhanaTask_movedFromId_key" ON "SadhanaTask"("movedFromId");

-- CreateIndex
CREATE INDEX "SadhanaTask_sadhanaDayId_idx" ON "SadhanaTask"("sadhanaDayId");

-- CreateIndex
CREATE INDEX "SadhanaTask_userId_status_idx" ON "SadhanaTask"("userId", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_deityId_fkey" FOREIGN KEY ("deityId") REFERENCES "Deity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Canto" ADD CONSTRAINT "Canto_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_cantoId_fkey" FOREIGN KEY ("cantoId") REFERENCES "Canto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verse" ADD CONSTRAINT "Verse_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verse" ADD CONSTRAINT "Verse_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookTranslator" ADD CONSTRAINT "BookTranslator_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookTranslator" ADD CONSTRAINT "BookTranslator_translatorId_fkey" FOREIGN KEY ("translatorId") REFERENCES "Translator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseTranslation" ADD CONSTRAINT "VerseTranslation_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseTranslation" ADD CONSTRAINT "VerseTranslation_translatorId_fkey" FOREIGN KEY ("translatorId") REFERENCES "Translator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseExplanation" ADD CONSTRAINT "VerseExplanation_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Narration" ADD CONSTRAINT "Narration_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Narration" ADD CONSTRAINT "Narration_guruId_fkey" FOREIGN KEY ("guruId") REFERENCES "Guru"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseLink" ADD CONSTRAINT "VerseLink_sourceVerseId_fkey" FOREIGN KEY ("sourceVerseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseLink" ADD CONSTRAINT "VerseLink_targetVerseId_fkey" FOREIGN KEY ("targetVerseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseIssue" ADD CONSTRAINT "VerseIssue_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseIssue" ADD CONSTRAINT "VerseIssue_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIssue" ADD CONSTRAINT "UserIssue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIssue" ADD CONSTRAINT "UserIssue_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIssue" ADD CONSTRAINT "UserIssue_sadhanaDayId_fkey" FOREIGN KEY ("sadhanaDayId") REFERENCES "SadhanaDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferenceProfile" ADD CONSTRAINT "UserPreferenceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySloka" ADD CONSTRAINT "DailySloka_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDailySloka" ADD CONSTRAINT "UserDailySloka_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDailySloka" ADD CONSTRAINT "UserDailySloka_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDailySloka" ADD CONSTRAINT "UserDailySloka_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_mantraId_fkey" FOREIGN KEY ("mantraId") REFERENCES "Mantra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FcmSubscription" ADD CONSTRAINT "FcmSubscription_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FcmSubscription" ADD CONSTRAINT "FcmSubscription_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "FcmTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mantra" ADD CONSTRAINT "Mantra_deityId_fkey" FOREIGN KEY ("deityId") REFERENCES "Deity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mantra" ADD CONSTRAINT "Mantra_guruId_fkey" FOREIGN KEY ("guruId") REFERENCES "Guru"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MantraTranslation" ADD CONSTRAINT "MantraTranslation_mantraId_fkey" FOREIGN KEY ("mantraId") REFERENCES "Mantra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SadhanaProfile" ADD CONSTRAINT "SadhanaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SadhanaDay" ADD CONSTRAINT "SadhanaDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantSession" ADD CONSTRAINT "ChantSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantSession" ADD CONSTRAINT "ChantSession_sadhanaDayId_fkey" FOREIGN KEY ("sadhanaDayId") REFERENCES "SadhanaDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantSession" ADD CONSTRAINT "ChantSession_mantraId_fkey" FOREIGN KEY ("mantraId") REFERENCES "Mantra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SadhanaTask" ADD CONSTRAINT "SadhanaTask_movedFromId_fkey" FOREIGN KEY ("movedFromId") REFERENCES "SadhanaTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SadhanaTask" ADD CONSTRAINT "SadhanaTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SadhanaTask" ADD CONSTRAINT "SadhanaTask_sadhanaDayId_fkey" FOREIGN KEY ("sadhanaDayId") REFERENCES "SadhanaDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
