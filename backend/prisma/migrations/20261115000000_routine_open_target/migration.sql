-- AlterTable
ALTER TABLE "RoutineKind" ADD COLUMN "opensKind" VARCHAR(20),
ADD COLUMN "prayerSlug" VARCHAR(80);

-- What the seeded routines open. Set here as well as by the seed, so production (which does not run the seed)
-- gets it from `prisma migrate deploy`. The meal prayer is a DRAFT until an admin publishes it; until then the
-- prayer page is a 404 and the app shows the alert without its button.
UPDATE "RoutineKind" SET "opensKind" = 'prayer', "prayerSlug" = 'prasada-sevaya' WHERE "key" IN ('breakfast', 'lunch', 'dinner');
UPDATE "RoutineKind" SET "opensKind" = 'chant' WHERE "key" IN ('morningChant', 'breakChant', 'eveningChant');
UPDATE "RoutineKind" SET "opensKind" = 'read' WHERE "key" = 'scriptureReading';
