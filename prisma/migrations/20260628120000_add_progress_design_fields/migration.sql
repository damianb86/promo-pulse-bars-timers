-- AddColumn: richer progress-bar configuration + target on CampaignDesign.
ALTER TABLE "CampaignDesign" ADD COLUMN "progressTarget" TEXT NOT NULL DEFAULT 'FREE_SHIPPING';
ALTER TABLE "CampaignDesign" ADD COLUMN "progressBarStyle" TEXT NOT NULL DEFAULT 'BAR';
ALTER TABLE "CampaignDesign" ADD COLUMN "progressSteps" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "CampaignDesign" ADD COLUMN "progressHeight" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "CampaignDesign" ADD COLUMN "progressRadius" INTEGER NOT NULL DEFAULT 999;
ALTER TABLE "CampaignDesign" ADD COLUMN "progressTrackColor" TEXT NOT NULL DEFAULT '#E5E7EB';
ALTER TABLE "CampaignDesign" ADD COLUMN "progressFillColor" TEXT NOT NULL DEFAULT '#22C55E';
ALTER TABLE "CampaignDesign" ADD COLUMN "progressTextColor" TEXT NOT NULL DEFAULT '#111827';
ALTER TABLE "CampaignDesign" ADD COLUMN "progressEffect" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "CampaignDesign" ADD COLUMN "progressShowLabel" BOOLEAN NOT NULL DEFAULT false;
