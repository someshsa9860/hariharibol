-- CreateEnum
CREATE TYPE "MantraType" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "Mantra" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "mantraType" "MantraType" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "matchKey" VARCHAR(120);

-- CreateTable
CREATE TABLE "MantraAccess" (
    "id" TEXT NOT NULL,
    "mantraId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MantraAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MantraAccess_userId_idx" ON "MantraAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MantraAccess_mantraId_userId_key" ON "MantraAccess"("mantraId", "userId");

-- CreateIndex
CREATE INDEX "Mantra_mantraType_idx" ON "Mantra"("mantraType");

-- CreateIndex
CREATE INDEX "Mantra_createdById_idx" ON "Mantra"("createdById");

-- CreateIndex
CREATE INDEX "Mantra_matchKey_idx" ON "Mantra"("matchKey");

-- AddForeignKey
ALTER TABLE "MantraAccess" ADD CONSTRAINT "MantraAccess_mantraId_fkey" FOREIGN KEY ("mantraId") REFERENCES "Mantra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MantraAccess" ADD CONSTRAINT "MantraAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mantra" ADD CONSTRAINT "Mantra_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
