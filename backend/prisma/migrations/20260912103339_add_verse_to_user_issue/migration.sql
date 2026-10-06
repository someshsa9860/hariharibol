-- AlterTable
ALTER TABLE "UserIssue" ADD COLUMN     "verseId" TEXT;

-- CreateIndex
CREATE INDEX "UserIssue_verseId_idx" ON "UserIssue"("verseId");

-- AddForeignKey
ALTER TABLE "UserIssue" ADD CONSTRAINT "UserIssue_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
