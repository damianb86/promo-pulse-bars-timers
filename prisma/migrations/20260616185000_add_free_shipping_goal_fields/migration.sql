-- AlterTable
ALTER TABLE "FreeShippingSettings" ADD COLUMN "emptyCartMessage" TEXT;

-- AlterTable
ALTER TABLE "FreeShippingSettings" ADD COLUMN "thresholdRules" JSONB;

-- AlterTable
ALTER TABLE "CampaignTranslation" ADD COLUMN "freeShippingEmptyText" TEXT;
