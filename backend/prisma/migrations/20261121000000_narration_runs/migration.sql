-- CreateTable
-- A narration run (admin → Narration): one engine, model and voice reads a book's chapters aloud, one clip per verse.
-- A compare run (kind COMPARE) reads one verse with several targets, so the admin can hear them side by side.
CREATE TABLE "NarrationRun" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(10) NOT NULL DEFAULT 'NARRATION',
    "book" VARCHAR(40) NOT NULL DEFAULT 'srimad-bhagavatam',
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "engine" VARCHAR(30),
    "model" VARCHAR(100),
    "voice" VARCHAR(100),
    "targets" JSONB,
    "results" JSONB,
    "chapters" INTEGER[],
    "verseIds" TEXT[],
    "force" BOOLEAN NOT NULL DEFAULT false,
    "status" "TranslationRunStatus" NOT NULL DEFAULT 'QUEUED',
    "pauseReason" VARCHAR(30),
    "statusMessage" TEXT,
    "stopReason" VARCHAR(30),
    "currentVerse" VARCHAR(40),
    "errorVerse" VARCHAR(40),
    "resumeAt" TIMESTAMP(3),
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "jobId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "retriesInARow" INTEGER NOT NULL DEFAULT 0,
    "totalVerses" INTEGER NOT NULL DEFAULT 0,
    "doneVerses" INTEGER NOT NULL DEFAULT 0,
    "skippedVerses" INTEGER NOT NULL DEFAULT 0,
    "failedVerses" INTEGER NOT NULL DEFAULT 0,
    "characters" INTEGER NOT NULL DEFAULT 0,
    "audioSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),

    CONSTRAINT "NarrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- One audio clip of one verse in one engine, model and voice. The file is in S3 at s3Key; textHash says which text it
-- was made from, so a run skips a verse whose text has not changed.
CREATE TABLE "NarrationClip" (
    "id" TEXT NOT NULL,
    "book" VARCHAR(40) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "engine" VARCHAR(30) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "voice" VARCHAR(100) NOT NULL,
    "verseId" VARCHAR(40) NOT NULL,
    "textHash" VARCHAR(64) NOT NULL,
    "s3Key" VARCHAR(512) NOT NULL,
    "contentType" VARCHAR(60) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "seconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "characters" INTEGER NOT NULL DEFAULT 0,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NarrationClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NarrationRun_status_createdAt_idx" ON "NarrationRun"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NarrationClip_target_verse_key" ON "NarrationClip"("book", "language", "engine", "model", "voice", "verseId");

-- CreateIndex
CREATE INDEX "NarrationClip_verseId_idx" ON "NarrationClip"("verseId");

-- The Narration page's permissions, given to the admin roles by the migration itself (same as scenes_permissions), so
-- the deploy is enough and the seed does not have to be run. `npm run seed` still owns the full role definitions.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_narration_read', 'narration.read', 'View narration and voice comparisons and their runs', 'content', CURRENT_TIMESTAMP),
    ('perm_narration_run', 'narration.run', 'Start, resume and cancel narration runs and voice comparisons', 'content', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" IN ('admin', 'super_admin')
  AND p."slug" IN ('narration.read', 'narration.run')
ON CONFLICT DO NOTHING;
