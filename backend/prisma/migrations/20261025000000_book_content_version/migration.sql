-- A book now has a version of its own text, and it goes up by itself.
--
-- Why: the offline export (services/book-cache.js) used to run once a week and nothing told it, or
-- the phones, that a book had changed in between. The Bhagavatam's Hindi was imported four hours
-- after a Sunday run and so stayed out of the files the app downloads for a week.
--
--   contentVersion    goes up whenever something the export carries changes (the triggers below)
--   contentChangedAt  when it last did, in UTC — the export waits for a burst of writes to stop
--   exportedVersion   the contentVersion the files on S3 were last built from; set by the export
--
-- contentVersion ahead of exportedVersion means "this book owes an export", and the worker looks for
-- exactly that every minute. exportedVersion starts at 0, so the first look after this migration
-- exports every book once; a unit whose content has not changed is skipped by its hash, so that
-- costs nothing but the Bhagavatam's Hindi, which it picks up.
ALTER TABLE "Book"
    ADD COLUMN IF NOT EXISTS "contentVersion" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "contentChangedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "exportedVersion" INTEGER NOT NULL DEFAULT 0;

-- Triggers, not code in each writer: the content is written by import scripts, the admin panel, the
-- translation import and psql, and a writer that forgot to call something would leave phones on old
-- text with nothing to say so. They are per statement (not per row) so importing 13,000 verses in
-- one statement is one bump, and they only touch "Book", which has a handful of rows.
--
-- Bumping when nothing the export carries really changed (a flag the export does not read) is
-- harmless: the export rebuilds, finds every unit's hash unchanged, uploads nothing, and the phones
-- find the same units. A missed bump is the harmful direction, so these err on the side of bumping.

-- Rows that carry their book's id: verses, chapters, cantos.
CREATE OR REPLACE FUNCTION book_content_bump_by_book_id() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE "Book"
           SET "contentVersion" = "contentVersion" + 1,
               "contentChangedAt" = timezone('UTC', clock_timestamp())
         WHERE "id" IN (SELECT DISTINCT "bookId" FROM old_rows);
    ELSE
        UPDATE "Book"
           SET "contentVersion" = "contentVersion" + 1,
               "contentChangedAt" = timezone('UTC', clock_timestamp())
         WHERE "id" IN (SELECT DISTINCT "bookId" FROM new_rows);
    END IF;
    RETURN NULL;
END;
$$;

-- A translation belongs to a book through its verse.
CREATE OR REPLACE FUNCTION book_content_bump_by_verse_id() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE "Book"
           SET "contentVersion" = "contentVersion" + 1,
               "contentChangedAt" = timezone('UTC', clock_timestamp())
         WHERE "id" IN (SELECT DISTINCT v."bookId" FROM "Verse" v JOIN old_rows r ON r."verseId" = v."id");
    ELSE
        UPDATE "Book"
           SET "contentVersion" = "contentVersion" + 1,
               "contentChangedAt" = timezone('UTC', clock_timestamp())
         WHERE "id" IN (SELECT DISTINCT v."bookId" FROM "Verse" v JOIN new_rows r ON r."verseId" = v."id");
    END IF;
    RETURN NULL;
END;
$$;

-- A translator's name is in every file their renderings are in.
CREATE OR REPLACE FUNCTION book_content_bump_by_translator() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "Book"
       SET "contentVersion" = "contentVersion" + 1,
           "contentChangedAt" = timezone('UTC', clock_timestamp())
     WHERE "id" IN (
         SELECT DISTINCT v."bookId"
           FROM "VerseTranslation" t
           JOIN "Verse" v ON v."id" = t."verseId"
          WHERE t."translatorId" IN (SELECT "id" FROM new_rows)
     );
    RETURN NULL;
END;
$$;

-- The book's own row: only the fields the export writes into a file (and whether it is published at
-- all). The export setting exportedVersion, or an admin editing the description, must not count.
CREATE OR REPLACE FUNCTION book_content_bump_self() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW."slug", NEW."bookNumber", NEW."title", NEW."titleI18n", NEW."sourceLanguage",
        NEW."recitationParent", NEW."isPublished")
       IS DISTINCT FROM
       (OLD."slug", OLD."bookNumber", OLD."title", OLD."titleI18n", OLD."sourceLanguage",
        OLD."recitationParent", OLD."isPublished") THEN
        NEW."contentVersion" := OLD."contentVersion" + 1;
        NEW."contentChangedAt" := timezone('UTC', clock_timestamp());
    END IF;
    RETURN NEW;
END;
$$;

-- Verse, Chapter, Canto: one trigger per kind of statement, because a transition table is named per
-- kind (an insert has only new rows, a delete only old ones).
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['Verse', 'Chapter', 'Canto']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'book_content_ins_' || t, t);
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'book_content_upd_' || t, t);
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'book_content_del_' || t, t);
        EXECUTE format(
            'CREATE TRIGGER %I AFTER INSERT ON %I REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION book_content_bump_by_book_id()',
            'book_content_ins_' || t, t);
        EXECUTE format(
            'CREATE TRIGGER %I AFTER UPDATE ON %I REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION book_content_bump_by_book_id()',
            'book_content_upd_' || t, t);
        EXECUTE format(
            'CREATE TRIGGER %I AFTER DELETE ON %I REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION book_content_bump_by_book_id()',
            'book_content_del_' || t, t);
    END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS book_content_ins_translation ON "VerseTranslation";
DROP TRIGGER IF EXISTS book_content_upd_translation ON "VerseTranslation";
DROP TRIGGER IF EXISTS book_content_del_translation ON "VerseTranslation";
CREATE TRIGGER book_content_ins_translation AFTER INSERT ON "VerseTranslation"
    REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION book_content_bump_by_verse_id();
CREATE TRIGGER book_content_upd_translation AFTER UPDATE ON "VerseTranslation"
    REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION book_content_bump_by_verse_id();
CREATE TRIGGER book_content_del_translation AFTER DELETE ON "VerseTranslation"
    REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION book_content_bump_by_verse_id();

DROP TRIGGER IF EXISTS book_content_upd_translator ON "Translator";
CREATE TRIGGER book_content_upd_translator AFTER UPDATE ON "Translator"
    REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION book_content_bump_by_translator();

DROP TRIGGER IF EXISTS book_content_upd_book ON "Book";
CREATE TRIGGER book_content_upd_book BEFORE UPDATE ON "Book"
    FOR EACH ROW EXECUTE FUNCTION book_content_bump_self();
