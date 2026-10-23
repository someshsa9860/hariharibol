-- CreateTable
CREATE TABLE "CalendarTranslation" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(12) NOT NULL,
    "languageCode" VARCHAR(10) NOT NULL,
    "sourceKey" VARCHAR(40) NOT NULL,
    "source" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "translatedBy" VARCHAR(60),
    "runId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarRun" (
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
    "currentItem" VARCHAR(200),
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

    CONSTRAINT "CalendarRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarTranslation_languageCode_kind_idx" ON "CalendarTranslation"("languageCode", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarTranslation_kind_languageCode_sourceKey_key" ON "CalendarTranslation"("kind", "languageCode", "sourceKey");

-- CreateIndex
CREATE INDEX "CalendarRun_status_createdAt_idx" ON "CalendarRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CalendarRun_language_createdAt_idx" ON "CalendarRun"("language", "createdAt");

-- The Hindu calendar page's translation permission, given to the admin roles here so the deploy is enough (same as
-- devotee_etiquette). `npm run seed` still owns the full role definitions.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_panchang_translate', 'panchang.translate', 'Start, resume and cancel Hindu calendar translation runs, and edit its translations', 'content', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" IN ('admin', 'super_admin')
  AND p."slug" = 'panchang.translate'
ON CONFLICT DO NOTHING;
