ALTER TABLE "CampaignTemplate"
ADD COLUMN "shopId" TEXT;

ALTER TABLE "CampaignTemplate"
ADD CONSTRAINT "CampaignTemplate_shopId_fkey"
FOREIGN KEY ("shopId")
REFERENCES "Shop"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE INDEX "CampaignTemplate_shopId_idx" ON "CampaignTemplate"("shopId");

CREATE INDEX "CampaignTemplate_isSystem_shopId_idx" ON "CampaignTemplate"("isSystem", "shopId");
