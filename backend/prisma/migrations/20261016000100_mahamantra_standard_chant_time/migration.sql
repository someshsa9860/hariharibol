-- The mahamantra was seeded at 8 s a chant, about twice an ordinary japa pace (a round of
-- 108 takes 6-8 minutes, so 3.5-4.5 s a chant), which made auto count lag behind a chanter.
-- Only a mantra still on the old seeded value is touched: an admin's own number stays.
UPDATE "Mantra" SET "durationMs" = 4000 WHERE "slug" = 'hare-krishna-mahamantra' AND "durationMs" = 8000;
