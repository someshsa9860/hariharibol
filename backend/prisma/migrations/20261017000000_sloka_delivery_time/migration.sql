-- The daily sloka went from "an hour" (sloka.delivery.default_hour, seeded 6) to "a time of day"
-- (sloka.delivery.time, 04:30), so it can land on the half hour. The old row is read by nothing now:
-- left in place it would show in the admin panel as a setting that does something. The new row is
-- only added if there is none, so an admin's own time is kept.
DELETE FROM "AppSetting" WHERE "key" = 'sloka.delivery.default_hour';

INSERT INTO "AppSetting" ("key", "value", "isSecret", "updatedAt")
VALUES ('sloka.delivery.time', '04:30', false, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
