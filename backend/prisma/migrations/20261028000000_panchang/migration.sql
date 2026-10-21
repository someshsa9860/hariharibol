-- CreateEnum
CREATE TYPE "FestivalKind" AS ENUM ('EKADASHI', 'CHATURTHI', 'PRADOSH', 'PURNIMA', 'AMAVASYA', 'SANKRANTI', 'FESTIVAL');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FESTIVAL';

-- CreateTable
CREATE TABLE "PanchangDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "locationKey" VARCHAR(40) NOT NULL,
    "weekday" INTEGER NOT NULL,
    "sunrise" TIMESTAMP(3),
    "sunset" TIMESTAMP(3),
    "moonrise" TIMESTAMP(3),
    "tithiNumber" INTEGER NOT NULL,
    "tithiName" VARCHAR(40) NOT NULL,
    "paksha" VARCHAR(10) NOT NULL,
    "tithiEndsAt" TIMESTAMP(3),
    "nakshatra" VARCHAR(40) NOT NULL,
    "nakshatraNumber" INTEGER NOT NULL,
    "nakshatraEndsAt" TIMESTAMP(3),
    "yoga" VARCHAR(40) NOT NULL,
    "yogaEndsAt" TIMESTAMP(3),
    "karana" VARCHAR(40) NOT NULL,
    "monthAmanta" VARCHAR(40) NOT NULL,
    "monthPurnimanta" VARCHAR(40) NOT NULL,
    "isAdhika" BOOLEAN NOT NULL DEFAULT false,
    "sunSign" VARCHAR(40) NOT NULL,
    "moonSign" VARCHAR(40) NOT NULL,
    "vikramSamvat" INTEGER NOT NULL,
    "shakaSamvat" INTEGER NOT NULL,
    "notes" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanchangDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Festival" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "locationKey" VARCHAR(40) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "kind" "FestivalKind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "paksha" VARCHAR(10),
    "tithiNumber" INTEGER,
    "month" VARCHAR(40),
    "details" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notify" BOOLEAN NOT NULL DEFAULT true,
    "notifyDaysBefore" INTEGER[] DEFAULT ARRAY[1]::INTEGER[],
    "notifiedDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Festival_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PanchangDay_locationKey_date_idx" ON "PanchangDay"("locationKey", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PanchangDay_date_locationKey_key" ON "PanchangDay"("date", "locationKey");

-- CreateIndex
CREATE INDEX "Festival_locationKey_date_idx" ON "Festival"("locationKey", "date");

-- CreateIndex
CREATE INDEX "Festival_date_notify_idx" ON "Festival"("date", "notify");

-- CreateIndex
CREATE UNIQUE INDEX "Festival_date_locationKey_slug_key" ON "Festival"("date", "locationKey", "slug");

