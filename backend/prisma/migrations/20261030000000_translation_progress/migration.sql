-- CreateTable
CREATE TABLE "TranslationProgress" (
    "book" VARCHAR(40) NOT NULL,
    "chapter" INTEGER NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "total" INTEGER NOT NULL,
    "saved" INTEGER NOT NULL DEFAULT 0,
    "upToDate" INTEGER NOT NULL DEFAULT 0,
    "byClaude" INTEGER NOT NULL DEFAULT 0,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "versions" JSONB NOT NULL DEFAULT '{}',
    "parts" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(10) NOT NULL DEFAULT 'EMPTY',
    "version" VARCHAR(40),
    "s3Key" VARCHAR(200) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationProgress_pkey" PRIMARY KEY ("book","chapter","language")
);

-- CreateIndex
CREATE INDEX "TranslationProgress_book_language_idx" ON "TranslationProgress"("book", "language");
