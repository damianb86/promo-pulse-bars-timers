ALTER TABLE "CampaignDesign" ADD COLUMN "backgroundImageSize" TEXT NOT NULL DEFAULT 'COVER';
ALTER TABLE "CampaignDesign" ADD COLUMN "backgroundImagePosition" TEXT NOT NULL DEFAULT 'CENTER';
ALTER TABLE "CampaignDesign" ADD COLUMN "backgroundImageRepeat" TEXT NOT NULL DEFAULT 'NO_REPEAT';
ALTER TABLE "CampaignDesign" ADD COLUMN "backgroundImageAttachment" TEXT NOT NULL DEFAULT 'SCROLL';
