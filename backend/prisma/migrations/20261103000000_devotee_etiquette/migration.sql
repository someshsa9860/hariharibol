-- CreateEnum
CREATE TYPE "EtiquetteStatus" AS ENUM ('PUBLISHED', 'DRAFT', 'EXCLUDED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ETIQUETTE';

-- CreateTable
CREATE TABLE "Etiquette" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" VARCHAR(160) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "body" TEXT NOT NULL,
    "reference" VARCHAR(200),
    "sourceName" VARCHAR(200),
    "sourceUrl" VARCHAR(500),
    "status" "EtiquetteStatus" NOT NULL DEFAULT 'PUBLISHED',
    "excludedReason" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Etiquette_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtiquetteTranslation" (
    "id" TEXT NOT NULL,
    "etiquetteId" TEXT NOT NULL,
    "languageCode" VARCHAR(10) NOT NULL,
    "title" VARCHAR(400) NOT NULL,
    "summary" VARCHAR(800) NOT NULL,
    "body" TEXT NOT NULL,
    "translatedBy" VARCHAR(60),
    "runId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtiquetteTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtiquetteDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "etiquetteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EtiquetteDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtiquetteDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "etiquetteId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EtiquetteDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtiquetteRun" (
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

    CONSTRAINT "EtiquetteRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Etiquette_slug_key" ON "Etiquette"("slug");

-- CreateIndex
CREATE INDEX "Etiquette_status_category_sortOrder_idx" ON "Etiquette"("status", "category", "sortOrder");

-- CreateIndex
CREATE INDEX "EtiquetteTranslation_languageCode_idx" ON "EtiquetteTranslation"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "EtiquetteTranslation_etiquetteId_languageCode_key" ON "EtiquetteTranslation"("etiquetteId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "EtiquetteDay_date_key" ON "EtiquetteDay"("date");

-- CreateIndex
CREATE INDEX "EtiquetteDay_etiquetteId_date_idx" ON "EtiquetteDay"("etiquetteId", "date");

-- CreateIndex
CREATE INDEX "EtiquetteDelivery_date_idx" ON "EtiquetteDelivery"("date");

-- CreateIndex
CREATE UNIQUE INDEX "EtiquetteDelivery_userId_date_key" ON "EtiquetteDelivery"("userId", "date");

-- CreateIndex
CREATE INDEX "EtiquetteRun_status_createdAt_idx" ON "EtiquetteRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EtiquetteRun_language_createdAt_idx" ON "EtiquetteRun"("language", "createdAt");

-- AddForeignKey
ALTER TABLE "EtiquetteTranslation" ADD CONSTRAINT "EtiquetteTranslation_etiquetteId_fkey" FOREIGN KEY ("etiquetteId") REFERENCES "Etiquette"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtiquetteDay" ADD CONSTRAINT "EtiquetteDay_etiquetteId_fkey" FOREIGN KEY ("etiquetteId") REFERENCES "Etiquette"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtiquetteDelivery" ADD CONSTRAINT "EtiquetteDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtiquetteDelivery" ADD CONSTRAINT "EtiquetteDelivery_etiquetteId_fkey" FOREIGN KEY ("etiquetteId") REFERENCES "Etiquette"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The Etiquette page's permissions, given to the admin roles here so the deploy is enough (same as scenes_permissions).
-- `npm run seed` still owns the full role definitions.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_etiquette_manage', 'etiquette.manage', 'View and edit devotee etiquette, and set one aside', 'content', CURRENT_TIMESTAMP),
    ('perm_etiquette_translate', 'etiquette.translate', 'Start, resume and cancel devotee etiquette translation runs', 'content', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" IN ('admin', 'super_admin')
  AND p."slug" IN ('etiquette.manage', 'etiquette.translate')
ON CONFLICT DO NOTHING;
