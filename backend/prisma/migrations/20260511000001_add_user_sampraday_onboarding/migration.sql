-- Add onboarding fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "primarySampradayId" TEXT;

-- Foreign key from User.primarySampradayId -> Sampraday.id
ALTER TABLE "User"
  ADD CONSTRAINT "User_primarySampradayId_fkey"
  FOREIGN KEY ("primarySampradayId")
  REFERENCES "Sampraday"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Index for fast lookup by primary sampraday
CREATE INDEX IF NOT EXISTS "User_primarySampradayId_idx" ON "User"("primarySampradayId");
