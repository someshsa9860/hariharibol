-- `matchKey` is a consonant skeleton (utils/legacy.js `skeleton`), capped at `MATCH.maxLength`
-- (400, config/legacy.js) before this column existed. VARCHAR(120) was narrower than that cap, so
-- a reader's own mantra whose skeleton ran past 120 characters overflowed the column (P2000) on
-- `prisma.mantra.create()`. Widen it to match the cap it can never exceed.
ALTER TABLE "Mantra" ALTER COLUMN "matchKey" TYPE VARCHAR(400);
