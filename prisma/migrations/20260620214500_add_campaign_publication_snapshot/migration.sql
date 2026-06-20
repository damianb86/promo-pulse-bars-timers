ALTER TABLE "Campaign" ADD COLUMN "lastSavedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE "Campaign" ADD COLUMN "publishedAt" DATETIME;
ALTER TABLE "Campaign" ADD COLUMN "publishedSnapshot" JSONB;

CREATE INDEX "Campaign_shopId_publishedAt_idx" ON "Campaign"("shopId", "publishedAt");
