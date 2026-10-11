-- AlterTable
ALTER TABLE "Book" ADD COLUMN "recitationParent" TEXT;

-- The Gita's 701 recordings were copied from the old bucket to
-- legacy/bhagvat-gita/mp3/chpaters-sloks/<chapter>/<verse>.mp3 (one per verse,
-- checked against the verse rows). Setting it here, not only in the seed, is what
-- makes a deploy enough: `prisma migrate deploy` runs on every release, the seed
-- does not. A database with no Gita row yet matches nothing — the seed sets it
-- when it creates the book.
UPDATE "Book"
SET "recitationParent" = 'legacy/bhagvat-gita/mp3/chpaters-sloks'
WHERE "slug" = 'bhagavad-gita' AND "recitationParent" IS NULL;
