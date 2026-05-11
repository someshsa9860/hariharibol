/*
  Warnings:

  - You are about to drop the column `authorKey` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `translationKey` on the `Verse` table. All the data in the column will be lost.
  - You are about to drop the `VerseRelation` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[bookNumber]` on the table `Book` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bookId,cantoNumber,number]` on the table `Chapter` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[verseId]` on the table `Verse` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bookId,cantoNumber,chapterNumber,verseNumber]` on the table `Verse` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bookNumber` to the `Book` table without a default value. This is not possible if the table is not empty.
  - Made the column `displayOrder` on table `Book` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `Chapter` table without a default value. This is not possible if the table is not empty.
  - Made the column `totalVerses` on table `Chapter` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `bookNumber` to the `Verse` table without a default value. This is not possible if the table is not empty.
  - Added the required column `verseId` to the `Verse` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "VerseRelation" DROP CONSTRAINT "VerseRelation_sampradayId_fkey";

-- DropForeignKey
ALTER TABLE "VerseRelation" DROP CONSTRAINT "VerseRelation_verseId_fkey";

-- DropIndex
DROP INDEX "Chapter_bookId_number_key";

-- DropIndex
DROP INDEX "Verse_bookId_chapterNumber_verseNumber_key";

-- AlterTable
ALTER TABLE "Book" DROP COLUMN "authorKey",
ADD COLUMN     "bookNumber" INTEGER NOT NULL,
ADD COLUMN     "language" VARCHAR(10) NOT NULL DEFAULT 'sa',
ADD COLUMN     "totalCantos" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "displayOrder" SET NOT NULL,
ALTER COLUMN "displayOrder" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "cantoId" TEXT,
ADD COLUMN     "cantoNumber" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "totalVerses" SET NOT NULL,
ALTER COLUMN "totalVerses" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Verse" DROP COLUMN "translationKey",
ADD COLUMN     "bookNumber" INTEGER NOT NULL,
ADD COLUMN     "cantoNumber" INTEGER,
ADD COLUMN     "globalVerseNumber" INTEGER,
ADD COLUMN     "verseId" TEXT NOT NULL,
ADD COLUMN     "verseNumberEnd" INTEGER;

-- DropTable
DROP TABLE "VerseRelation";

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT,
    "adminId" TEXT,
    "deviceId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translator" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "bioKey" TEXT,
    "imageUrl" TEXT,
    "sampradayId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookTranslator" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "translatorId" TEXT NOT NULL,
    "seriesName" TEXT,
    "publishedYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BookTranslator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Canto" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "titleKey" TEXT NOT NULL,
    "summaryKey" TEXT,
    "totalChapters" INTEGER NOT NULL DEFAULT 0,
    "totalVerses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Canto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerseTranslation" (
    "id" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "translatorId" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "meaning" TEXT NOT NULL,
    "purport" TEXT,
    "audioUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerseTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerseLink" (
    "id" TEXT NOT NULL,
    "sourceVerseId" TEXT NOT NULL,
    "targetVerseId" TEXT NOT NULL,
    "relationKey" VARCHAR(100) NOT NULL,
    "noteKey" TEXT,

    CONSTRAINT "VerseLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerseSampradayLink" (
    "id" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "sampradayId" TEXT NOT NULL,
    "preferredTranslatorId" TEXT,

    CONSTRAINT "VerseSampradayLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_adminId_idx" ON "RefreshToken"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "Translator_slug_key" ON "Translator"("slug");

-- CreateIndex
CREATE INDEX "Translator_slug_idx" ON "Translator"("slug");

-- CreateIndex
CREATE INDEX "Translator_sampradayId_idx" ON "Translator"("sampradayId");

-- CreateIndex
CREATE INDEX "Translator_isPublished_idx" ON "Translator"("isPublished");

-- CreateIndex
CREATE INDEX "BookTranslator_bookId_idx" ON "BookTranslator"("bookId");

-- CreateIndex
CREATE INDEX "BookTranslator_translatorId_idx" ON "BookTranslator"("translatorId");

-- CreateIndex
CREATE UNIQUE INDEX "BookTranslator_bookId_translatorId_key" ON "BookTranslator"("bookId", "translatorId");

-- CreateIndex
CREATE INDEX "Canto_bookId_idx" ON "Canto"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "Canto_bookId_number_key" ON "Canto"("bookId", "number");

-- CreateIndex
CREATE INDEX "VerseTranslation_verseId_idx" ON "VerseTranslation"("verseId");

-- CreateIndex
CREATE INDEX "VerseTranslation_translatorId_idx" ON "VerseTranslation"("translatorId");

-- CreateIndex
CREATE INDEX "VerseTranslation_language_idx" ON "VerseTranslation"("language");

-- CreateIndex
CREATE INDEX "VerseTranslation_isPublished_idx" ON "VerseTranslation"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "VerseTranslation_verseId_translatorId_language_key" ON "VerseTranslation"("verseId", "translatorId", "language");

-- CreateIndex
CREATE INDEX "VerseLink_sourceVerseId_idx" ON "VerseLink"("sourceVerseId");

-- CreateIndex
CREATE INDEX "VerseLink_targetVerseId_idx" ON "VerseLink"("targetVerseId");

-- CreateIndex
CREATE UNIQUE INDEX "VerseLink_sourceVerseId_targetVerseId_key" ON "VerseLink"("sourceVerseId", "targetVerseId");

-- CreateIndex
CREATE INDEX "VerseSampradayLink_verseId_idx" ON "VerseSampradayLink"("verseId");

-- CreateIndex
CREATE INDEX "VerseSampradayLink_sampradayId_idx" ON "VerseSampradayLink"("sampradayId");

-- CreateIndex
CREATE UNIQUE INDEX "VerseSampradayLink_verseId_sampradayId_key" ON "VerseSampradayLink"("verseId", "sampradayId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_bookNumber_key" ON "Book"("bookNumber");

-- CreateIndex
CREATE INDEX "Book_displayOrder_idx" ON "Book"("displayOrder");

-- CreateIndex
CREATE INDEX "Chapter_cantoId_idx" ON "Chapter"("cantoId");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_bookId_cantoNumber_number_key" ON "Chapter"("bookId", "cantoNumber", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Verse_verseId_key" ON "Verse"("verseId");

-- CreateIndex
CREATE INDEX "Verse_verseId_idx" ON "Verse"("verseId");

-- CreateIndex
CREATE INDEX "Verse_bookNumber_idx" ON "Verse"("bookNumber");

-- CreateIndex
CREATE INDEX "Verse_chapterId_idx" ON "Verse"("chapterId");

-- CreateIndex
CREATE INDEX "Verse_cantoNumber_idx" ON "Verse"("cantoNumber");

-- CreateIndex
CREATE INDEX "Verse_globalVerseNumber_idx" ON "Verse"("globalVerseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Verse_bookId_cantoNumber_chapterNumber_verseNumber_key" ON "Verse"("bookId", "cantoNumber", "chapterNumber", "verseNumber");

-- AddForeignKey
ALTER TABLE "Translator" ADD CONSTRAINT "Translator_sampradayId_fkey" FOREIGN KEY ("sampradayId") REFERENCES "Sampraday"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookTranslator" ADD CONSTRAINT "BookTranslator_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookTranslator" ADD CONSTRAINT "BookTranslator_translatorId_fkey" FOREIGN KEY ("translatorId") REFERENCES "Translator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Canto" ADD CONSTRAINT "Canto_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_cantoId_fkey" FOREIGN KEY ("cantoId") REFERENCES "Canto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseTranslation" ADD CONSTRAINT "VerseTranslation_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseTranslation" ADD CONSTRAINT "VerseTranslation_translatorId_fkey" FOREIGN KEY ("translatorId") REFERENCES "Translator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseLink" ADD CONSTRAINT "VerseLink_sourceVerseId_fkey" FOREIGN KEY ("sourceVerseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseLink" ADD CONSTRAINT "VerseLink_targetVerseId_fkey" FOREIGN KEY ("targetVerseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseSampradayLink" ADD CONSTRAINT "VerseSampradayLink_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseSampradayLink" ADD CONSTRAINT "VerseSampradayLink_sampradayId_fkey" FOREIGN KEY ("sampradayId") REFERENCES "Sampraday"("id") ON DELETE CASCADE ON UPDATE CASCADE;
