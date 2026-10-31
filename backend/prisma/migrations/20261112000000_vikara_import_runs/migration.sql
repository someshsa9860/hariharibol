-- The import queue now also carries the Bhagavatam's vikara tags (kind VIKARA), apart from a language's translations (kind TRANSLATION).
-- AlterTable
ALTER TABLE "TranslationImportRun" ADD COLUMN "kind" VARCHAR(20) NOT NULL DEFAULT 'TRANSLATION';
