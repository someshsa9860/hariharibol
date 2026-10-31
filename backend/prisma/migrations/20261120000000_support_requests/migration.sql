-- Feature and translation requests: the ticket carries what was asked for (a book and a language).
-- Nullable, so every ticket written before this migration is unchanged.
ALTER TABLE "SupportTicket" ADD COLUMN "details" JSONB;
