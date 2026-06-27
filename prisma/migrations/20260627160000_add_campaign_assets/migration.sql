-- CreateEnum
CREATE TYPE "CampaignAssetSource" AS ENUM ('GENERATED', 'EXTRACTED', 'SVG');

-- AlterTable: track whether AI visual-asset generation was requested.
ALTER TABLE "Campaign" ADD COLUMN "assetsRequested" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: AI-generated visual assets uploaded to the Shopify Files library.
CREATE TABLE "CampaignAsset" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "shopifyFileId" TEXT NOT NULL,
    "shopifyUrl" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "source" "CampaignAssetSource" NOT NULL,
    "modelUsed" TEXT,
    "promptUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignAsset_campaignId_idx" ON "CampaignAsset"("campaignId");

-- AddForeignKey
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
