-- AlterTable: per-side margins for the campaign surface
ALTER TABLE "CampaignDesign" ADD COLUMN "marginTop" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CampaignDesign" ADD COLUMN "marginBottom" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CampaignDesign" ADD COLUMN "marginLeft" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CampaignDesign" ADD COLUMN "marginRight" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: optional mobile-specific theme selectors
ALTER TABLE "ShopSettings" ADD COLUMN "separateMobileSelectors" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopSettings" ADD COLUMN "mobileSelectors" JSONB;
