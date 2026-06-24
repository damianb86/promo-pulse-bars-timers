-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "DesignOfferCodeLayout" AS ENUM ('INLINE', 'STACKED', 'COMPACT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DesignOfferCopyBehavior" AS ENUM ('FEEDBACK', 'HIDE_OFFER', 'CLOSE_CAMPAIGN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DesignOfferApplyBehavior" AS ENUM ('SHOW_APPLIED', 'HIDE_OFFER', 'CLOSE_CAMPAIGN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "CampaignDesign"
  ALTER COLUMN "offerCodeLayout" DROP DEFAULT,
  ALTER COLUMN "offerCodeLayout" TYPE "DesignOfferCodeLayout"
    USING (
      CASE
        WHEN "offerCodeLayout" IN ('INLINE', 'STACKED', 'COMPACT')
          THEN "offerCodeLayout"
        ELSE 'INLINE'
      END
    )::"DesignOfferCodeLayout",
  ALTER COLUMN "offerCodeLayout" SET DEFAULT 'INLINE';

ALTER TABLE "CampaignDesign"
  ALTER COLUMN "offerCopyBehavior" DROP DEFAULT,
  ALTER COLUMN "offerCopyBehavior" TYPE "DesignOfferCopyBehavior"
    USING (
      CASE
        WHEN "offerCopyBehavior" IN ('FEEDBACK', 'HIDE_OFFER', 'CLOSE_CAMPAIGN')
          THEN "offerCopyBehavior"
        ELSE 'FEEDBACK'
      END
    )::"DesignOfferCopyBehavior",
  ALTER COLUMN "offerCopyBehavior" SET DEFAULT 'FEEDBACK';

ALTER TABLE "CampaignDesign"
  ALTER COLUMN "offerApplyBehavior" DROP DEFAULT,
  ALTER COLUMN "offerApplyBehavior" TYPE "DesignOfferApplyBehavior"
    USING (
      CASE
        WHEN "offerApplyBehavior" IN ('SHOW_APPLIED', 'HIDE_OFFER', 'CLOSE_CAMPAIGN')
          THEN "offerApplyBehavior"
        ELSE 'SHOW_APPLIED'
      END
    )::"DesignOfferApplyBehavior",
  ALTER COLUMN "offerApplyBehavior" SET DEFAULT 'SHOW_APPLIED';
