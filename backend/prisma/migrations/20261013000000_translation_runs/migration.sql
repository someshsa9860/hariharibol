-- CreateEnum
CREATE TYPE "TranslationRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "TranslationRun" (
    "id" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "chapters" INTEGER[],
    "verseLimit" INTEGER,
    "budgetMicros" INTEGER,
    "status" "TranslationRunStatus" NOT NULL DEFAULT 'QUEUED',
    "pauseReason" VARCHAR(30),
    "statusMessage" TEXT,
    "stopReason" VARCHAR(30),
    "errorVerseId" TEXT,
    "resumeAt" TIMESTAMP(3),
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "jobId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "retriesInARow" INTEGER NOT NULL DEFAULT 0,
    "totalVerses" INTEGER NOT NULL DEFAULT 0,
    "doneVerses" INTEGER NOT NULL DEFAULT 0,
    "currentVerseId" TEXT,
    "score1" INTEGER NOT NULL DEFAULT 0,
    "score2" INTEGER NOT NULL DEFAULT 0,
    "score3" INTEGER NOT NULL DEFAULT 0,
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
    "heartbeatAt" TIMESTAMP(3),

    CONSTRAINT "TranslationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranslationRun_status_createdAt_idx" ON "TranslationRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TranslationRun_language_createdAt_idx" ON "TranslationRun"("language", "createdAt");

-- The permissions the Translations page checks. Inserted here, not only in the seed: `prisma
-- migrate deploy` runs on every release and the seed does not, so without this an admin on the
-- server would not see the page until someone seeded by hand. A database with no roles yet matches
-- nothing in the second statement; the seed upserts the permissions and links them when it creates
-- the roles.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_translation_read', 'translation.read', 'View Claude translation runs and their output', 'content', CURRENT_TIMESTAMP),
    ('perm_translation_run', 'translation.run', 'Start, resume and cancel Claude translation runs', 'content', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" IN ('admin', 'super_admin')
  AND p."slug" IN ('translation.read', 'translation.run')
ON CONFLICT DO NOTHING;
