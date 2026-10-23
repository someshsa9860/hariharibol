-- CreateTable
CREATE TABLE "TranslationImportRun" (
    "id" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "book" VARCHAR(40) NOT NULL DEFAULT 'bhagavat-gita',
    "publish" BOOLEAN NOT NULL DEFAULT false,
    "chapters" INTEGER[],
    "status" "TranslationRunStatus" NOT NULL DEFAULT 'QUEUED',
    "statusMessage" TEXT,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "jobId" TEXT,
    "totalChapters" INTEGER NOT NULL DEFAULT 0,
    "doneChapters" INTEGER NOT NULL DEFAULT 0,
    "currentChapter" INTEGER,
    "result" JSONB,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),

    CONSTRAINT "TranslationImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranslationImportRun_status_createdAt_idx" ON "TranslationImportRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TranslationImportRun_language_createdAt_idx" ON "TranslationImportRun"("language", "createdAt");
