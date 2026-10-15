-- Which AI provider a translation run used. Every run before this was Claude.
ALTER TABLE "TranslationRun" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(20) NOT NULL DEFAULT 'anthropic';

-- Which book a translation run is for. Every run before this was the Gita. A chapter id is the chapter number
-- for the Gita and canto * 100 + chapter for the Bhagavatam.
ALTER TABLE "TranslationRun" ADD COLUMN IF NOT EXISTS "book" VARCHAR(40) NOT NULL DEFAULT 'bhagavat-gita';
