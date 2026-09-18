-- AlterTable
ALTER TABLE "SadhanaProfile" ADD COLUMN     "preferredMantraId" TEXT;

-- CreateIndex
CREATE INDEX "SadhanaProfile_preferredMantraId_idx" ON "SadhanaProfile"("preferredMantraId");

-- AddForeignKey
ALTER TABLE "SadhanaProfile" ADD CONSTRAINT "SadhanaProfile_preferredMantraId_fkey" FOREIGN KEY ("preferredMantraId") REFERENCES "Mantra"("id") ON DELETE SET NULL ON UPDATE CASCADE;
