-- Daily active users with history. See the UserActiveDay model.

CREATE TABLE "UserActiveDay" (
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform" VARCHAR(20),
    CONSTRAINT "UserActiveDay_pkey" PRIMARY KEY ("userId", "date")
);
CREATE INDEX "UserActiveDay_date_idx" ON "UserActiveDay"("date");
ALTER TABLE "UserActiveDay" ADD CONSTRAINT "UserActiveDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One-time backfill from what older tables remember (days are Indian calendar days, like the dashboard's).
-- Approximate by nature: it only knows days on which someone did something that left a row.
INSERT INTO "UserActiveDay" ("userId", "date")
SELECT DISTINCT "userId", "date" FROM "SadhanaDay"
ON CONFLICT DO NOTHING;

INSERT INTO "UserActiveDay" ("userId", "date")
SELECT DISTINCT "userId", ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date FROM "ChantSession"
ON CONFLICT DO NOTHING;

INSERT INTO "UserActiveDay" ("userId", "date")
SELECT DISTINCT "userId", ("lastViewedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date FROM "ReelView"
ON CONFLICT DO NOTHING;

INSERT INTO "UserActiveDay" ("userId", "date")
SELECT DISTINCT "userId", ("lastReadAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date FROM "ReadingProgress"
ON CONFLICT DO NOTHING;

INSERT INTO "UserActiveDay" ("userId", "date")
SELECT "id", ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date FROM "User"
ON CONFLICT DO NOTHING;

INSERT INTO "UserActiveDay" ("userId", "date")
SELECT "id", ("lastActiveAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date FROM "User" WHERE "lastActiveAt" IS NOT NULL
ON CONFLICT DO NOTHING;
