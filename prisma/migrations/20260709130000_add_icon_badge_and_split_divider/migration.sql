-- CreateEnum
CREATE TYPE "DesignIconBadgeMode" AS ENUM ('ICON', 'BADGE');

-- AlterTable
ALTER TABLE "CampaignDesign" ADD COLUMN "iconBadgeMode" "DesignIconBadgeMode" NOT NULL DEFAULT 'ICON';
ALTER TABLE "CampaignDesign" ADD COLUMN "iconBadgeText" TEXT NOT NULL DEFAULT 'FLASH SALE';
ALTER TABLE "CampaignDesign" ADD COLUMN "iconBadgeShowGlyph" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CampaignDesign" ADD COLUMN "iconBadgeBackgroundColor" TEXT NOT NULL DEFAULT '#FCE7F3';
ALTER TABLE "CampaignDesign" ADD COLUMN "iconBadgeTextColor" TEXT NOT NULL DEFAULT '#BE185D';
ALTER TABLE "CampaignDesign" ADD COLUMN "iconBadgeFontSize" INTEGER NOT NULL DEFAULT 13;
ALTER TABLE "CampaignDesign" ADD COLUMN "iconBadgeBorderRadius" INTEGER NOT NULL DEFAULT 999;
ALTER TABLE "CampaignDesign" ADD COLUMN "splitDividerEnabled" BOOLEAN NOT NULL DEFAULT true;
