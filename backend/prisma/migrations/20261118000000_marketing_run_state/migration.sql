-- A campaign run's pause request, the AI sample approval, and how many recipients are still to be attempted.
ALTER TABLE "MarketingCampaign" ADD COLUMN "pauseRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MarketingCampaign" ADD COLUMN "sampleApprovedAt" TIMESTAMP(3);
ALTER TABLE "MarketingCampaign" ADD COLUMN "pending" INTEGER NOT NULL DEFAULT 0;
