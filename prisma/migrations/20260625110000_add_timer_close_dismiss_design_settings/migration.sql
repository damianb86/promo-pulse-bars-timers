-- CreateEnum
CREATE TYPE "DesignTimerNumberLayout" AS ENUM ('INLINE', 'STACKED');

-- CreateEnum
CREATE TYPE "DesignDismissBehavior" AS ENUM ('SHOW_AGAIN', 'HIDE_PERMANENTLY');

-- AlterTable
ALTER TABLE "CampaignDesign" ADD COLUMN "timerNumberLayout" "DesignTimerNumberLayout" NOT NULL DEFAULT 'INLINE';
ALTER TABLE "CampaignDesign" ADD COLUMN "closeButtonSize" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "CampaignDesign" ADD COLUMN "dismissBehavior" "DesignDismissBehavior" NOT NULL DEFAULT 'SHOW_AGAIN';
