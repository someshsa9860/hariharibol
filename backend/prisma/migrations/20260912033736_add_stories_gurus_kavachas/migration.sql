-- CreateEnum
CREATE TYPE "StoryKind" AS ENUM ('DEVOTEE_STORY', 'GURU_LESSON', 'KAVACHA');

-- AlterTable
ALTER TABLE "Favorite" ADD COLUMN     "storyId" TEXT;

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "kind" "StoryKind" NOT NULL,
    "title" TEXT NOT NULL,
    "titleI18n" JSONB,
    "description" TEXT,
    "descriptionI18n" JSONB,
    "bookId" TEXT NOT NULL,
    "cantoNumber" INTEGER,
    "imagePath" TEXT,
    "audioPath" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryPart" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "titleI18n" JSONB,
    "description" TEXT,
    "descriptionI18n" JSONB,
    "chapterId" TEXT NOT NULL,
    "verseNumberStart" INTEGER NOT NULL,
    "verseNumberEnd" INTEGER,
    "imagePath" TEXT,
    "audioPath" TEXT,
    "isDailyEligible" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryPartIssue" (
    "storyPartId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StoryPartIssue_pkey" PRIMARY KEY ("storyPartId","issueId")
);

-- CreateTable
CREATE TABLE "DailyStoryPart" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "storyPartId" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyStoryPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Story_slug_key" ON "Story"("slug");

-- CreateIndex
CREATE INDEX "Story_bookId_idx" ON "Story"("bookId");

-- CreateIndex
CREATE INDEX "Story_kind_idx" ON "Story"("kind");

-- CreateIndex
CREATE INDEX "Story_isPublished_idx" ON "Story"("isPublished");

-- CreateIndex
CREATE INDEX "StoryPart_chapterId_idx" ON "StoryPart"("chapterId");

-- CreateIndex
CREATE INDEX "StoryPart_isDailyEligible_idx" ON "StoryPart"("isDailyEligible");

-- CreateIndex
CREATE INDEX "StoryPart_isPublished_idx" ON "StoryPart"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "StoryPart_storyId_number_key" ON "StoryPart"("storyId", "number");

-- CreateIndex
CREATE INDEX "StoryPartIssue_issueId_weight_idx" ON "StoryPartIssue"("issueId", "weight");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStoryPart_date_key" ON "DailyStoryPart"("date");

-- CreateIndex
CREATE INDEX "DailyStoryPart_storyPartId_idx" ON "DailyStoryPart"("storyPartId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_storyId_key" ON "Favorite"("userId", "storyId");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryPart" ADD CONSTRAINT "StoryPart_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryPart" ADD CONSTRAINT "StoryPart_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryPartIssue" ADD CONSTRAINT "StoryPartIssue_storyPartId_fkey" FOREIGN KEY ("storyPartId") REFERENCES "StoryPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryPartIssue" ADD CONSTRAINT "StoryPartIssue_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStoryPart" ADD CONSTRAINT "DailyStoryPart_storyPartId_fkey" FOREIGN KEY ("storyPartId") REFERENCES "StoryPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

