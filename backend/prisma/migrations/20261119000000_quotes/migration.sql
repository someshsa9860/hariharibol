-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "text" VARCHAR(1000) NOT NULL,
    "author" VARCHAR(200),
    "reference" VARCHAR(200),
    "sourceName" VARCHAR(200),
    "sourceUrl" VARCHAR(500),
    "status" "EtiquetteStatus" NOT NULL DEFAULT 'PUBLISHED',
    "excludedReason" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTranslation" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "languageCode" VARCHAR(10) NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "translatedBy" VARCHAR(60),
    "runId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRun" (
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

    CONSTRAINT "QuoteRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_slug_key" ON "Quote"("slug");

-- CreateIndex
CREATE INDEX "Quote_status_sortOrder_idx" ON "Quote"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "QuoteTranslation_languageCode_idx" ON "QuoteTranslation"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteTranslation_quoteId_languageCode_key" ON "QuoteTranslation"("quoteId", "languageCode");

-- CreateIndex
CREATE INDEX "QuoteRun_status_createdAt_idx" ON "QuoteRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteRun_language_createdAt_idx" ON "QuoteRun"("language", "createdAt");

-- AddForeignKey
ALTER TABLE "QuoteTranslation" ADD CONSTRAINT "QuoteTranslation_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The Quotes page's permissions, given to the admin roles here so the deploy is enough.
-- `npm run seed` still owns the full role definitions.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_quote_manage', 'quote.manage', 'View and edit the quotes shown while chanting, and set one aside', 'content', CURRENT_TIMESTAMP),
    ('perm_quote_translate', 'quote.translate', 'Start, resume and cancel quote translation runs', 'content', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" IN ('admin', 'super_admin')
  AND p."slug" IN ('quote.manage', 'quote.translate')
ON CONFLICT DO NOTHING;
