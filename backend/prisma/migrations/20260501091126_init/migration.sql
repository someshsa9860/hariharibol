-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT,
    "avatarUrl" TEXT,
    "authProvider" VARCHAR(50) NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "languagePreference" VARCHAR(10) NOT NULL DEFAULT 'en',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedReason" TEXT,
    "bannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceType" VARCHAR(20) NOT NULL,
    "deviceModel" TEXT,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "userIds" TEXT[],
    "fcmToken" TEXT,
    "apnsToken" TEXT,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedReason" TEXT,
    "bannedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuruSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sampradayAffinity" JSONB NOT NULL DEFAULT '{}',
    "deityAffinity" JSONB NOT NULL DEFAULT '{}',
    "lastCalculated" TIMESTAMP(3),

    CONSTRAINT "GuruSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ban" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "cascadedFromId" TEXT,
    "cascadeChain" TEXT[],
    "triggeredBy" VARCHAR(20) NOT NULL,
    "adminId" TEXT,
    "evidenceMessageIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unbannedAt" TIMESTAMP(3),
    "unbannedBy" TEXT,
    "unbanReason" TEXT,

    CONSTRAINT "Ban_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sampraday" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "descriptionKey" TEXT,
    "shortDescriptionKey" TEXT,
    "founderKey" TEXT,
    "founderImageUrl" TEXT,
    "primaryDeityKey" TEXT,
    "primaryDeityImageUrl" TEXT,
    "philosophyKey" TEXT,
    "keyDisciples" JSONB NOT NULL DEFAULT '[]',
    "heroImageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "categoryKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "foundingYear" INTEGER,
    "regionKey" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sampraday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "descriptionKey" TEXT,
    "coverImageUrl" TEXT,
    "authorKey" TEXT,
    "totalChapters" INTEGER NOT NULL DEFAULT 0,
    "totalVerses" INTEGER NOT NULL DEFAULT 0,
    "displayOrder" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "titleKey" TEXT NOT NULL,
    "summaryKey" TEXT,
    "totalVerses" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verse" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "verseNumber" INTEGER NOT NULL,
    "sanskrit" TEXT,
    "transliteration" TEXT,
    "wordMeanings" JSONB NOT NULL DEFAULT '[]',
    "translationKey" TEXT,
    "categoryKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedDeityKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audioUrl" TEXT,
    "isVerseOfDayEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerseRelation" (
    "id" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "sampradayId" TEXT NOT NULL,

    CONSTRAINT "VerseRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Narration" (
    "id" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "saintNameKey" TEXT NOT NULL,
    "saintImageUrl" TEXT,
    "sourceKey" TEXT,
    "sourceYear" INTEGER,
    "narrationKey" TEXT NOT NULL,
    "sampradayId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Narration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mantra" (
    "id" TEXT NOT NULL,
    "sampradayId" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "sanskrit" TEXT,
    "transliteration" TEXT,
    "meaningKey" TEXT,
    "significanceKey" TEXT,
    "audioUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "recommendedCount" INTEGER NOT NULL DEFAULT 108,
    "category" VARCHAR(50) NOT NULL DEFAULT 'mahamantra',
    "relatedDeityKey" TEXT,
    "displayOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mantra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "namespace" VARCHAR(50) NOT NULL,
    "translations" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "nameNative" TEXT NOT NULL,
    "nameEnglish" TEXT NOT NULL,
    "isRtl" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER,
    "fallbackCode" VARCHAR(10) NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sampradayId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChantLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mantraId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChantLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "sampradayId" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "descriptionKey" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "aiVerdict" VARCHAR(50),
    "aiConfidence" DOUBLE PRECISION,
    "aiReason" TEXT,
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "guruPersonaUsed" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatbotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "excerpt" TEXT,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" TEXT,
    "changesBefore" JSONB,
    "changesAfter" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueJob" (
    "id" TEXT NOT NULL,
    "jobType" VARCHAR(100) NOT NULL,
    "jobData" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'string',
    "description" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerseOfDay" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "verseId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "explanation" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerseOfDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FCMTopic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subscriberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FCMTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FCMSubscription" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FCMSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_providerUserId_key" ON "User"("providerUserId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isBanned_idx" ON "User"("isBanned");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");

-- CreateIndex
CREATE INDEX "Device_deviceId_idx" ON "Device"("deviceId");

-- CreateIndex
CREATE INDEX "Device_isBanned_idx" ON "Device"("isBanned");

-- CreateIndex
CREATE UNIQUE INDEX "GuruSignal_userId_key" ON "GuruSignal"("userId");

-- CreateIndex
CREATE INDEX "Ban_type_value_idx" ON "Ban"("type", "value");

-- CreateIndex
CREATE INDEX "Ban_isActive_idx" ON "Ban"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Ban_type_value_key" ON "Ban"("type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Sampraday_slug_key" ON "Sampraday"("slug");

-- CreateIndex
CREATE INDEX "Sampraday_slug_idx" ON "Sampraday"("slug");

-- CreateIndex
CREATE INDEX "Sampraday_isPublished_idx" ON "Sampraday"("isPublished");

-- CreateIndex
CREATE INDEX "Sampraday_displayOrder_idx" ON "Sampraday"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");

-- CreateIndex
CREATE INDEX "Book_slug_idx" ON "Book"("slug");

-- CreateIndex
CREATE INDEX "Book_isPublished_idx" ON "Book"("isPublished");

-- CreateIndex
CREATE INDEX "Chapter_bookId_idx" ON "Chapter"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_bookId_number_key" ON "Chapter"("bookId", "number");

-- CreateIndex
CREATE INDEX "Verse_bookId_idx" ON "Verse"("bookId");

-- CreateIndex
CREATE INDEX "Verse_isVerseOfDayEligible_idx" ON "Verse"("isVerseOfDayEligible");

-- CreateIndex
CREATE UNIQUE INDEX "Verse_bookId_chapterNumber_verseNumber_key" ON "Verse"("bookId", "chapterNumber", "verseNumber");

-- CreateIndex
CREATE INDEX "VerseRelation_verseId_idx" ON "VerseRelation"("verseId");

-- CreateIndex
CREATE INDEX "VerseRelation_sampradayId_idx" ON "VerseRelation"("sampradayId");

-- CreateIndex
CREATE UNIQUE INDEX "VerseRelation_verseId_sampradayId_key" ON "VerseRelation"("verseId", "sampradayId");

-- CreateIndex
CREATE INDEX "Narration_verseId_idx" ON "Narration"("verseId");

-- CreateIndex
CREATE INDEX "Narration_isPublished_idx" ON "Narration"("isPublished");

-- CreateIndex
CREATE INDEX "Mantra_sampradayId_idx" ON "Mantra"("sampradayId");

-- CreateIndex
CREATE INDEX "Mantra_isPublic_idx" ON "Mantra"("isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_key_key" ON "Translation"("key");

-- CreateIndex
CREATE INDEX "Translation_key_idx" ON "Translation"("key");

-- CreateIndex
CREATE INDEX "Translation_namespace_idx" ON "Translation"("namespace");

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE INDEX "Favorite_type_idx" ON "Favorite"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_type_targetId_key" ON "Favorite"("userId", "type", "targetId");

-- CreateIndex
CREATE INDEX "Follow_userId_idx" ON "Follow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_userId_sampradayId_key" ON "Follow"("userId", "sampradayId");

-- CreateIndex
CREATE INDEX "ChantLog_userId_idx" ON "ChantLog"("userId");

-- CreateIndex
CREATE INDEX "ChantLog_date_idx" ON "ChantLog"("date");

-- CreateIndex
CREATE INDEX "Group_sampradayId_idx" ON "Group"("sampradayId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_sampradayId_key" ON "Group"("sampradayId");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "Message_groupId_idx" ON "Message"("groupId");

-- CreateIndex
CREATE INDEX "Message_userId_idx" ON "Message"("userId");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "ChatbotSession_userId_idx" ON "ChatbotSession"("userId");

-- CreateIndex
CREATE INDEX "ChatbotSession_createdAt_idx" ON "ChatbotSession"("createdAt");

-- CreateIndex
CREATE INDEX "ChatbotMessage_sessionId_idx" ON "ChatbotMessage"("sessionId");

-- CreateIndex
CREATE INDEX "ChatbotMessage_role_idx" ON "ChatbotMessage"("role");

-- CreateIndex
CREATE INDEX "Citation_messageId_idx" ON "Citation"("messageId");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_idx" ON "AuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "QueueJob_jobType_idx" ON "QueueJob"("jobType");

-- CreateIndex
CREATE INDEX "QueueJob_status_idx" ON "QueueJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_key_key" ON "AppSettings"("key");

-- CreateIndex
CREATE INDEX "AppSettings_key_idx" ON "AppSettings"("key");

-- CreateIndex
CREATE INDEX "VerseOfDay_verseId_idx" ON "VerseOfDay"("verseId");

-- CreateIndex
CREATE INDEX "VerseOfDay_date_idx" ON "VerseOfDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "VerseOfDay_date_key" ON "VerseOfDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "FCMTopic_name_key" ON "FCMTopic"("name");

-- CreateIndex
CREATE INDEX "FCMTopic_name_idx" ON "FCMTopic"("name");

-- CreateIndex
CREATE INDEX "FCMSubscription_topicId_idx" ON "FCMSubscription"("topicId");

-- CreateIndex
CREATE INDEX "FCMSubscription_deviceId_idx" ON "FCMSubscription"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "FCMSubscription_topicId_deviceToken_key" ON "FCMSubscription"("topicId", "deviceToken");

-- AddForeignKey
ALTER TABLE "GuruSignal" ADD CONSTRAINT "GuruSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_cascadedFromId_fkey" FOREIGN KEY ("cascadedFromId") REFERENCES "Ban"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verse" ADD CONSTRAINT "Verse_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verse" ADD CONSTRAINT "Verse_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseRelation" ADD CONSTRAINT "VerseRelation_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseRelation" ADD CONSTRAINT "VerseRelation_sampradayId_fkey" FOREIGN KEY ("sampradayId") REFERENCES "Sampraday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Narration" ADD CONSTRAINT "Narration_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mantra" ADD CONSTRAINT "Mantra_sampradayId_fkey" FOREIGN KEY ("sampradayId") REFERENCES "Sampraday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_verseTargetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Verse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_mantraTargetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Mantra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_sampradayId_fkey" FOREIGN KEY ("sampradayId") REFERENCES "Sampraday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantLog" ADD CONSTRAINT "ChantLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantLog" ADD CONSTRAINT "ChantLog_mantraId_fkey" FOREIGN KEY ("mantraId") REFERENCES "Mantra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_sampradayId_fkey" FOREIGN KEY ("sampradayId") REFERENCES "Sampraday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotSession" ADD CONSTRAINT "ChatbotSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotMessage" ADD CONSTRAINT "ChatbotMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatbotSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatbotMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseOfDay" ADD CONSTRAINT "VerseOfDay_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FCMSubscription" ADD CONSTRAINT "FCMSubscription_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "FCMTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
