-- CreateEnum
CREATE TYPE "PrayerStatus" AS ENUM ('PUBLISHED', 'DRAFT');

-- CreateTable
CREATE TABLE "Prayer" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "originalLanguage" VARCHAR(10) NOT NULL DEFAULT 'sa',
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(400),
    "about" TEXT,
    "author" VARCHAR(200),
    "reference" VARCHAR(200),
    "sourceName" VARCHAR(200),
    "sourceUrl" VARCHAR(500),
    "status" "PrayerStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrayerTranslation" (
    "id" TEXT NOT NULL,
    "prayerId" TEXT NOT NULL,
    "languageCode" VARCHAR(10) NOT NULL,
    "title" VARCHAR(400) NOT NULL,
    "summary" VARCHAR(800),
    "about" TEXT,
    "translatedBy" VARCHAR(60),
    "runId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrayerTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrayerVerse" (
    "id" TEXT NOT NULL,
    "prayerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "meaning" TEXT,
    "textChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrayerVerse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrayerVerseTranslation" (
    "id" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "languageCode" VARCHAR(10) NOT NULL,
    "text" TEXT,
    "renderedAt" TIMESTAMP(3),
    "meaning" TEXT,
    "translatedBy" VARCHAR(60),
    "runId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrayerVerseTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrayerRun" (
    "id" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'openai',
    "model" VARCHAR(100) NOT NULL,
    "force" BOOLEAN NOT NULL DEFAULT false,
    "status" "TranslationRunStatus" NOT NULL DEFAULT 'QUEUED',
    "pauseReason" VARCHAR(30),
    "statusMessage" TEXT,
    "stopReason" VARCHAR(30),
    "resumeAt" TIMESTAMP(3),
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "jobId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "retriesInARow" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "doneItems" INTEGER NOT NULL DEFAULT 0,
    "currentSlug" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),

    CONSTRAINT "PrayerRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prayer_slug_key" ON "Prayer"("slug");

-- CreateIndex
CREATE INDEX "Prayer_status_category_sortOrder_idx" ON "Prayer"("status", "category", "sortOrder");

-- CreateIndex
CREATE INDEX "PrayerTranslation_languageCode_idx" ON "PrayerTranslation"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "PrayerTranslation_prayerId_languageCode_key" ON "PrayerTranslation"("prayerId", "languageCode");

-- CreateIndex
CREATE INDEX "PrayerVerse_prayerId_position_idx" ON "PrayerVerse"("prayerId", "position");

-- CreateIndex
CREATE INDEX "PrayerVerseTranslation_languageCode_idx" ON "PrayerVerseTranslation"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "PrayerVerseTranslation_verseId_languageCode_key" ON "PrayerVerseTranslation"("verseId", "languageCode");

-- CreateIndex
CREATE INDEX "PrayerRun_status_createdAt_idx" ON "PrayerRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PrayerRun_language_createdAt_idx" ON "PrayerRun"("language", "createdAt");

-- AddForeignKey
ALTER TABLE "PrayerTranslation" ADD CONSTRAINT "PrayerTranslation_prayerId_fkey" FOREIGN KEY ("prayerId") REFERENCES "Prayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerVerse" ADD CONSTRAINT "PrayerVerse_prayerId_fkey" FOREIGN KEY ("prayerId") REFERENCES "Prayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerVerseTranslation" ADD CONSTRAINT "PrayerVerseTranslation_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "PrayerVerse"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- The Prayers page's permissions, given to the admin roles here so the deploy is enough (same as devotee_etiquette).
-- `npm run seed` still owns the full role definitions.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_prayer_manage', 'prayer.manage', 'View and edit prayers, and publish or hold them back', 'content', CURRENT_TIMESTAMP),
    ('perm_prayer_translate', 'prayer.translate', 'Start, resume and cancel prayer transliteration and translation runs', 'content', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" IN ('admin', 'super_admin')
  AND p."slug" IN ('prayer.manage', 'prayer.translate')
ON CONFLICT DO NOTHING;
