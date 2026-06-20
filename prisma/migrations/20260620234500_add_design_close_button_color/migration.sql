ALTER TABLE "CampaignDesign" ADD COLUMN "closeButtonColor" TEXT NOT NULL DEFAULT '#111827';

UPDATE "CampaignDesign"
SET "closeButtonColor" = "textColor";
