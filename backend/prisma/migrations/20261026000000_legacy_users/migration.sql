-- Carrying people over from the old app's server (POST /api/app/auth/legacy).
--
-- A person who signed in on the old app trades the access token it saved for a session here;
-- the account is made on the way. See "Legacy users" in backend/CLAUDE.md.

-- An account made from an old-server token has no Google or Apple identity yet. The first
-- verified sign-in with the same email adopts it, and this value becomes GOOGLE or APPLE.
-- (The value is not used in this file, so it may share a transaction with the statements below.)
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'LEGACY';

-- The id the person had on the old server. Unique: the same old account always lands on the
-- same row here, so a phone that asks twice (or two phones at once) never makes two accounts.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legacyUserId" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "User_legacyUserId_key" ON "User"("legacyUserId");

-- The mantra they chanted most on the old server, matched to one of ours when they were carried
-- over. A starting point only; chanting here takes over from the first sitting.
ALTER TABLE "SadhanaProfile" ADD COLUMN IF NOT EXISTS "legacyFavoriteMantraId" TEXT;
CREATE INDEX IF NOT EXISTS "SadhanaProfile_legacyFavoriteMantraId_idx" ON "SadhanaProfile"("legacyFavoriteMantraId");

DO $$
BEGIN
  ALTER TABLE "SadhanaProfile"
    ADD CONSTRAINT "SadhanaProfile_legacyFavoriteMantraId_fkey"
    FOREIGN KEY ("legacyFavoriteMantraId") REFERENCES "Mantra"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
