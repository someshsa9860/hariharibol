-- CreateTable
CREATE TABLE "ChantMala" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "beads" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "avgGapMs" INTEGER NOT NULL DEFAULT 0,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "taps" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChantMala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChantTapTranscript" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "malaIndex" INTEGER NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "confidence" DOUBLE PRECISION,
    "locale" VARCHAR(16),
    "audioKey" VARCHAR(255),
    "heardAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChantTapTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChantMala_userId_startedAt_idx" ON "ChantMala"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChantMala_sessionId_index_key" ON "ChantMala"("sessionId", "index");

-- CreateIndex
CREATE INDEX "ChantTapTranscript_expiresAt_idx" ON "ChantTapTranscript"("expiresAt");

-- CreateIndex
CREATE INDEX "ChantTapTranscript_userId_heardAt_idx" ON "ChantTapTranscript"("userId", "heardAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChantTapTranscript_sessionId_seq_key" ON "ChantTapTranscript"("sessionId", "seq");

-- AddForeignKey
ALTER TABLE "ChantMala" ADD CONSTRAINT "ChantMala_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChantSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantMala" ADD CONSTRAINT "ChantMala_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantTapTranscript" ADD CONSTRAINT "ChantTapTranscript_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChantSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantTapTranscript" ADD CONSTRAINT "ChantTapTranscript_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
