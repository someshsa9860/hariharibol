-- A translation run can give each part (translation, purport, transliteration, word meanings) its own
-- provider, model and effort. Both columns are null on an older run, which used one model for everything.
ALTER TABLE "TranslationRun" ADD COLUMN IF NOT EXISTS "plan" JSONB;
ALTER TABLE "TranslationRun" ADD COLUMN IF NOT EXISTS "lanes" JSONB;
