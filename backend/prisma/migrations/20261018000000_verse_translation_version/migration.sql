-- A translation row can now carry the whole of what Claude made for a verse: the verse in the
-- language's own script, its word-by-word list in that language, who made it and with which
-- TRANSLATION_VERSION. Verse.transliteration and Verse.wordMeanings stay language-neutral (Roman
-- text, English meanings); copying a Hindi or Tamil rendering into them would overwrite those, so
-- the language's version lives beside its meaning and purport, on the VerseTranslation row.
-- All four are null on every existing row.
ALTER TABLE "VerseTranslation"
    ADD COLUMN IF NOT EXISTS "transliteration" TEXT,
    ADD COLUMN IF NOT EXISTS "wordMeanings" JSONB,
    ADD COLUMN IF NOT EXISTS "translatedBy" VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "version" VARCHAR(40);

-- The permission the Translations page checks before it shows Import. Inserted here, not only in
-- the seed, for the reason the earlier translation migration gives: `prisma migrate deploy` runs on
-- every release and the seed does not.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_translation_import', 'translation.import', 'Import Claude translations from storage into the database', 'content', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" IN ('admin', 'super_admin')
  AND p."slug" = 'translation.import'
ON CONFLICT DO NOTHING;
