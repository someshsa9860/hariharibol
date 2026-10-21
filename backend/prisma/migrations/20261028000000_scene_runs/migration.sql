-- CreateTable
CREATE TABLE "SceneRun" (
    "id" TEXT NOT NULL,
    "book" VARCHAR(40) NOT NULL DEFAULT 'srimad-bhagavatam',
    "provider" VARCHAR(20) NOT NULL DEFAULT 'gemini',
    "model" VARCHAR(100) NOT NULL,
    "chapters" INTEGER[],
    "force" BOOLEAN NOT NULL DEFAULT false,
    "status" "TranslationRunStatus" NOT NULL DEFAULT 'QUEUED',
    "pauseReason" VARCHAR(30),
    "statusMessage" TEXT,
    "stopReason" VARCHAR(30),
    "errorChapter" INTEGER,
    "resumeAt" TIMESTAMP(3),
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "jobId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "retriesInARow" INTEGER NOT NULL DEFAULT 0,
    "totalChapters" INTEGER NOT NULL DEFAULT 0,
    "doneChapters" INTEGER NOT NULL DEFAULT 0,
    "skippedChapters" INTEGER NOT NULL DEFAULT 0,
    "currentChapter" INTEGER,
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

    CONSTRAINT "SceneRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SceneRun_status_createdAt_idx" ON "SceneRun"("status", "createdAt");
