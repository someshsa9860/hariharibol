-- AlterTable
ALTER TABLE "Mantra" ADD COLUMN "prayerMantraId" TEXT;

-- CreateIndex
CREATE INDEX "Mantra_prayerMantraId_idx" ON "Mantra"("prayerMantraId");

-- AddForeignKey
ALTER TABLE "Mantra" ADD CONSTRAINT "Mantra_prayerMantraId_fkey" FOREIGN KEY ("prayerMantraId") REFERENCES "Mantra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The mahamantra is chanted after the Pancha-tattva mantra. Only a mantra with no prayer
-- yet is touched, so an admin's choice stays. (`prisma migrate deploy` runs on every
-- release; the seed does not.)
UPDATE "Mantra" AS m SET "prayerMantraId" = p."id"
FROM "Mantra" AS p
WHERE m."slug" = 'hare-krishna-mahamantra' AND p."slug" = 'panchatattva-mantra' AND m."prayerMantraId" IS NULL;
