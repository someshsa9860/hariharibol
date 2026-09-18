-- AlterEnum
ALTER TYPE "ReelMediaType" ADD VALUE 'AUDIO';

-- CreateTable
CREATE TABLE "ReelAudioTrack" (
    "id" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "languageCode" VARCHAR(10) NOT NULL,
    "audioPath" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelAudioTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReelAudioTrack_reelId_idx" ON "ReelAudioTrack"("reelId");

-- CreateIndex
CREATE UNIQUE INDEX "ReelAudioTrack_reelId_languageCode_key" ON "ReelAudioTrack"("reelId", "languageCode");

-- AddForeignKey
ALTER TABLE "ReelAudioTrack" ADD CONSTRAINT "ReelAudioTrack_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
