-- AlterTable
ALTER TABLE "UserIssue" ADD COLUMN     "date" DATE;

-- CreateIndex
CREATE INDEX "UserIssue_userId_date_idx" ON "UserIssue"("userId", "date");
