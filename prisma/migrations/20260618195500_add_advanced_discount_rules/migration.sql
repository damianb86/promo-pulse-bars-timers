-- CreateTable
CREATE TABLE "AdvancedDiscountRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "thresholds" JSONB,
    "productIds" JSONB,
    "collectionIds" JSONB,
    "discountValue" DECIMAL,
    "shippingDiscountValue" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "functionId" TEXT,
    "shopifyDiscountId" TEXT,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdvancedDiscountRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdvancedDiscountRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdvancedDiscountRule_shopId_status_idx" ON "AdvancedDiscountRule"("shopId", "status");

-- CreateIndex
CREATE INDEX "AdvancedDiscountRule_campaignId_status_idx" ON "AdvancedDiscountRule"("campaignId", "status");

-- CreateIndex
CREATE INDEX "AdvancedDiscountRule_shopifyDiscountId_idx" ON "AdvancedDiscountRule"("shopifyDiscountId");
