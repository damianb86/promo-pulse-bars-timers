ALTER TABLE "CampaignTargeting"
ADD COLUMN "excludedUrlContains" JSONB NOT NULL DEFAULT '[]';
