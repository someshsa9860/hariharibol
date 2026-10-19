-- Accounts carried over from the old (Laravel) server: the id they had there, and the mantra they chanted most.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legacyUserId" VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS "User_legacyUserId_key" ON "User"("legacyUserId");
ALTER TABLE "SadhanaProfile" ADD COLUMN IF NOT EXISTS "legacyFavoriteMantraId" TEXT;
