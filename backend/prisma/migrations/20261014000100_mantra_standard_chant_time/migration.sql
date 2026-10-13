-- Standard chanting time of the seeded mantras, in ms. The app's auto count counts one
-- chant for each of these of sound. Only a mantra with no time yet is touched, so an
-- admin's value stays. (`prisma migrate deploy` runs on every release; the seed does not.)
UPDATE "Mantra" SET "durationMs" = 8000 WHERE "slug" = 'hare-krishna-mahamantra' AND ("durationMs" IS NULL OR "durationMs" = 0);
UPDATE "Mantra" SET "durationMs" = 7000 WHERE "slug" = 'panchatattva-mantra' AND ("durationMs" IS NULL OR "durationMs" = 0);
UPDATE "Mantra" SET "durationMs" = 4000 WHERE "slug" = 'om-namo-bhagavate-vasudevaya' AND ("durationMs" IS NULL OR "durationMs" = 0);
UPDATE "Mantra" SET "durationMs" = 3500 WHERE "slug" = 'rama-taraka-mantra' AND ("durationMs" IS NULL OR "durationMs" = 0);
UPDATE "Mantra" SET "durationMs" = 7000 WHERE "slug" = 'nrisimha-mantra' AND ("durationMs" IS NULL OR "durationMs" = 0);
UPDATE "Mantra" SET "durationMs" = 8000 WHERE "slug" = 'krishna-gayatri' AND ("durationMs" IS NULL OR "durationMs" = 0);
UPDATE "Mantra" SET "durationMs" = 3000 WHERE "slug" = 'pranava-om' AND ("durationMs" IS NULL OR "durationMs" = 0);
UPDATE "Mantra" SET "durationMs" = 1500 WHERE "slug" = 'om-namah-shivaya' AND ("durationMs" IS NULL OR "durationMs" = 0);
UPDATE "Mantra" SET "durationMs" = 12000 WHERE "slug" = 'maha-mrityunjaya-mantra' AND ("durationMs" IS NULL OR "durationMs" = 0);
UPDATE "Mantra" SET "durationMs" = 8000 WHERE "slug" = 'shiva-gayatri' AND ("durationMs" IS NULL OR "durationMs" = 0);
UPDATE "Mantra" SET "durationMs" = 4000 WHERE "slug" = 'datta-mala-mantra' AND ("durationMs" IS NULL OR "durationMs" = 0);
