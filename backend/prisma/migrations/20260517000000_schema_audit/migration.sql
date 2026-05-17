-- Schema audit: add missing indexes, updatedAt fields, and cascade rules
-- Generated: 2026-05-17

-- User: index on createdAt for chronological queries
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");

-- Verse: index on createdAt for chronological queries
CREATE INDEX IF NOT EXISTS "Verse_createdAt_idx" ON "Verse"("createdAt");

-- VerseTranslation: composite index for verse+language lookups (without requiring translatorId)
CREATE INDEX IF NOT EXISTS "VerseTranslation_verseId_language_idx" ON "VerseTranslation"("verseId", "language");

-- ChantLog: index on createdAt for time-range queries
CREATE INDEX IF NOT EXISTS "ChantLog_createdAt_idx" ON "ChantLog"("createdAt");

-- GuruSignal: add createdAt and updatedAt tracking
ALTER TABLE "GuruSignal" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "GuruSignal" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Ban: add updatedAt for tracking when ban records are modified (e.g. unban)
ALTER TABLE "Ban" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Ban: ensure admin FK uses SET NULL on admin user deletion (orphan prevention)
ALTER TABLE "Ban" DROP CONSTRAINT IF EXISTS "Ban_adminId_fkey";
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
