-- The phone's own id for a chanting sitting, so a sitting kept on the phone and
-- sent later (or sent twice) is one session and never two. Nullable: sessions
-- opened the older way and manual ones have none, and Postgres lets a unique
-- index hold any number of nulls.
ALTER TABLE "ChantSession" ADD COLUMN "clientId" VARCHAR(64);

CREATE UNIQUE INDEX "ChantSession_userId_clientId_key" ON "ChantSession"("userId", "clientId");
