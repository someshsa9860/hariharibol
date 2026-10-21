-- How the app draws a reel. Reels made from a verse by a template are drawn by the app as pages
-- (Sanskrit, meaning, purport) instead of playing their picture and audio.
ALTER TABLE "Reel" ADD COLUMN "layout" VARCHAR(20) NOT NULL DEFAULT 'MEDIA';

UPDATE "Reel" SET "layout" = 'VERSE_PAGES' WHERE "templateId" IS NOT NULL AND "verseId" IS NOT NULL;

CREATE INDEX "Reel_layout_verseId_idx" ON "Reel"("layout", "verseId");
