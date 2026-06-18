-- Add optional unique discount code configuration to existing discount sync rows.
ALTER TABLE "DiscountSync" ADD COLUMN "title" TEXT;
ALTER TABLE "DiscountSync" ADD COLUMN "valueType" TEXT;
ALTER TABLE "DiscountSync" ADD COLUMN "value" DECIMAL;
ALTER TABLE "DiscountSync" ADD COLUMN "minimumSubtotal" DECIMAL;
ALTER TABLE "DiscountSync" ADD COLUMN "appliesOncePerCustomer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiscountSync" ADD COLUMN "uniqueCodePrefix" TEXT;
ALTER TABLE "DiscountSync" ADD COLUMN "uniqueCodeExpiresMinutes" INTEGER;
ALTER TABLE "DiscountSync" ADD COLUMN "uniqueCodeAutoApply" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiscountSync" ADD COLUMN "uniqueCodeStartsAt" DATETIME;
ALTER TABLE "DiscountSync" ADD COLUMN "uniqueCodeEndsAt" DATETIME;

-- Store one issued Shopify discount code per visitor claim without exposing the raw visitor id.
CREATE TABLE "DiscountCodeGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "cartToken" TEXT,
    "code" TEXT NOT NULL,
    "shopifyDiscountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "expiresAt" DATETIME,
    "claimedAt" DATETIME,
    "appliedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DiscountCodeGrant_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiscountCodeGrant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DiscountCodeGrant_shopId_code_key" ON "DiscountCodeGrant"("shopId", "code");
CREATE INDEX "DiscountCodeGrant_campaignId_visitorKey_idx" ON "DiscountCodeGrant"("campaignId", "visitorKey");
CREATE INDEX "DiscountCodeGrant_campaignId_status_expiresAt_idx" ON "DiscountCodeGrant"("campaignId", "status", "expiresAt");
CREATE INDEX "DiscountCodeGrant_shopId_createdAt_idx" ON "DiscountCodeGrant"("shopId", "createdAt");
