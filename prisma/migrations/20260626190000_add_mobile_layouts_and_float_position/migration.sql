-- AlterEnum: mobile-specific layout variants
ALTER TYPE "DesignLayout" ADD VALUE 'MOBILE_BANNER';
ALTER TYPE "DesignLayout" ADD VALUE 'MOBILE_CARD';
ALTER TYPE "DesignLayout" ADD VALUE 'MOBILE_SHEET';
ALTER TYPE "DesignLayout" ADD VALUE 'MOBILE_COMPACT_BAR';
ALTER TYPE "DesignLayout" ADD VALUE 'MOBILE_SPOTLIGHT';

-- CreateEnum: float positioning for "Float over page"
CREATE TYPE "DesignFloatPosition" AS ENUM ('ABSOLUTE', 'FIXED');

-- AlterTable: float position + offsets (defaults pin a full-width top banner)
ALTER TABLE "CampaignDesign" ADD COLUMN "floatPosition" "DesignFloatPosition" NOT NULL DEFAULT 'FIXED';
ALTER TABLE "CampaignDesign" ADD COLUMN "floatOffsetTop" TEXT NOT NULL DEFAULT '0';
ALTER TABLE "CampaignDesign" ADD COLUMN "floatOffsetBottom" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "CampaignDesign" ADD COLUMN "floatOffsetLeft" TEXT NOT NULL DEFAULT '0';
ALTER TABLE "CampaignDesign" ADD COLUMN "floatOffsetRight" TEXT NOT NULL DEFAULT '0';
