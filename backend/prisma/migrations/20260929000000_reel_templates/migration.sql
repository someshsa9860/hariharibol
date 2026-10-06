-- AlterTable
ALTER TABLE "Reel" ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "ReelTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReelTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReelTemplate_isActive_idx" ON "ReelTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Reel_templateId_verseId_key" ON "Reel"("templateId", "verseId");

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReelTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
