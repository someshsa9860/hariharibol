-- Tokens a reader spent from the day's free-tier bonus (they leave the wallet and the daily cap alone).
ALTER TABLE "AiDailyUsage" ADD COLUMN IF NOT EXISTS "bonusTokens" INTEGER NOT NULL DEFAULT 0;
