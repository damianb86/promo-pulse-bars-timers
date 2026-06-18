-- Stage 2 premium campaign models. This migration is additive and does not
-- change existing Stage 1 tables or runtime contracts.

CREATE TABLE "UniqueDiscountCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "code" TEXT NOT NULL,
    "shopifyDiscountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "assignedAt" DATETIME,
    "expiresAt" DATETIME,
    "usedAt" DATETIME,
    "orderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UniqueDiscountCode_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UniqueDiscountCode_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DiscountCodePool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "value" DECIMAL,
    "startsAt" DATETIME,
    "expiresAt" DATETIME,
    "totalGenerated" INTEGER NOT NULL DEFAULT 0,
    "totalAssigned" INTEGER NOT NULL DEFAULT 0,
    "totalUsed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DiscountCodePool_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiscountCodePool_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "trafficSplitStrategy" TEXT NOT NULL DEFAULT 'WEIGHTED',
    "primaryMetric" TEXT NOT NULL,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "winnerVariantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Experiment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Experiment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ExperimentVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "designOverride" JSONB,
    "textOverride" JSONB,
    "discountOverride" JSONB,
    "placementOverride" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExperimentVariant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AttributionTouch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "experimentId" TEXT,
    "variantId" TEXT,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "placementType" TEXT,
    "path" TEXT,
    "country" TEXT,
    "locale" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttributionTouch_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttributionTouch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttributionTouch_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AttributionTouch_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AttributionConversion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "experimentId" TEXT,
    "variantId" TEXT,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "orderId" TEXT NOT NULL,
    "revenueAmount" DECIMAL,
    "currencyCode" TEXT,
    "attributionModel" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttributionConversion_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttributionConversion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttributionConversion_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AttributionConversion_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "EmailTimer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "expiredBehavior" TEXT NOT NULL DEFAULT 'SHOW_EXPIRED',
    "design" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailTimer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailTimer_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AdvancedBadgeRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL,
    "design" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdvancedBadgeRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdvancedBadgeRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MarketCampaignRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "marketId" TEXT,
    "countryCode" TEXT,
    "locale" TEXT,
    "currencyCode" TEXT,
    "thresholdAmount" DECIMAL,
    "deliverySettings" JSONB,
    "textOverrides" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketCampaignRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketCampaignRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CampaignRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "payload" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignRecommendation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignRecommendation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CampaignTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "countryCode" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "eventName" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "defaultTexts" JSONB NOT NULL,
    "defaultDesign" JSONB NOT NULL,
    "defaultSettings" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "AgencyAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "AgencyShopAccess" (
    "agencyId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyShopAccess_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "AgencyAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgencyShopAccess_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("agencyId", "shopId")
);

CREATE UNIQUE INDEX "UniqueDiscountCode_shopId_code_key" ON "UniqueDiscountCode"("shopId", "code");
CREATE INDEX "UniqueDiscountCode_campaignId_status_idx" ON "UniqueDiscountCode"("campaignId", "status");
CREATE INDEX "UniqueDiscountCode_campaignId_visitorId_idx" ON "UniqueDiscountCode"("campaignId", "visitorId");
CREATE INDEX "UniqueDiscountCode_sessionId_idx" ON "UniqueDiscountCode"("sessionId");
CREATE INDEX "UniqueDiscountCode_orderId_idx" ON "UniqueDiscountCode"("orderId");
CREATE INDEX "UniqueDiscountCode_expiresAt_idx" ON "UniqueDiscountCode"("expiresAt");

CREATE INDEX "DiscountCodePool_shopId_status_idx" ON "DiscountCodePool"("shopId", "status");
CREATE INDEX "DiscountCodePool_campaignId_status_idx" ON "DiscountCodePool"("campaignId", "status");
CREATE INDEX "DiscountCodePool_prefix_idx" ON "DiscountCodePool"("prefix");

CREATE INDEX "Experiment_shopId_status_idx" ON "Experiment"("shopId", "status");
CREATE INDEX "Experiment_campaignId_status_idx" ON "Experiment"("campaignId", "status");
CREATE INDEX "Experiment_winnerVariantId_idx" ON "Experiment"("winnerVariantId");

CREATE INDEX "ExperimentVariant_experimentId_status_idx" ON "ExperimentVariant"("experimentId", "status");
CREATE INDEX "ExperimentVariant_campaignId_idx" ON "ExperimentVariant"("campaignId");

CREATE INDEX "AttributionTouch_shopId_occurredAt_idx" ON "AttributionTouch"("shopId", "occurredAt");
CREATE INDEX "AttributionTouch_campaignId_occurredAt_idx" ON "AttributionTouch"("campaignId", "occurredAt");
CREATE INDEX "AttributionTouch_experimentId_variantId_idx" ON "AttributionTouch"("experimentId", "variantId");
CREATE INDEX "AttributionTouch_visitorId_idx" ON "AttributionTouch"("visitorId");
CREATE INDEX "AttributionTouch_sessionId_idx" ON "AttributionTouch"("sessionId");

CREATE INDEX "AttributionConversion_shopId_occurredAt_idx" ON "AttributionConversion"("shopId", "occurredAt");
CREATE INDEX "AttributionConversion_campaignId_occurredAt_idx" ON "AttributionConversion"("campaignId", "occurredAt");
CREATE INDEX "AttributionConversion_experimentId_variantId_idx" ON "AttributionConversion"("experimentId", "variantId");
CREATE INDEX "AttributionConversion_orderId_idx" ON "AttributionConversion"("orderId");
CREATE INDEX "AttributionConversion_visitorId_idx" ON "AttributionConversion"("visitorId");

CREATE UNIQUE INDEX "EmailTimer_publicToken_key" ON "EmailTimer"("publicToken");
CREATE INDEX "EmailTimer_shopId_idx" ON "EmailTimer"("shopId");
CREATE INDEX "EmailTimer_campaignId_idx" ON "EmailTimer"("campaignId");
CREATE INDEX "EmailTimer_endsAt_idx" ON "EmailTimer"("endsAt");

CREATE INDEX "AdvancedBadgeRule_shopId_status_idx" ON "AdvancedBadgeRule"("shopId", "status");
CREATE INDEX "AdvancedBadgeRule_campaignId_priority_idx" ON "AdvancedBadgeRule"("campaignId", "priority");

CREATE INDEX "MarketCampaignRule_shopId_idx" ON "MarketCampaignRule"("shopId");
CREATE INDEX "MarketCampaignRule_campaignId_idx" ON "MarketCampaignRule"("campaignId");
CREATE INDEX "MarketCampaignRule_marketId_idx" ON "MarketCampaignRule"("marketId");
CREATE INDEX "MarketCampaignRule_countryCode_locale_idx" ON "MarketCampaignRule"("countryCode", "locale");

CREATE INDEX "CampaignRecommendation_shopId_status_idx" ON "CampaignRecommendation"("shopId", "status");
CREATE INDEX "CampaignRecommendation_campaignId_status_idx" ON "CampaignRecommendation"("campaignId", "status");
CREATE INDEX "CampaignRecommendation_type_idx" ON "CampaignRecommendation"("type");

CREATE UNIQUE INDEX "CampaignTemplate_key_key" ON "CampaignTemplate"("key");
CREATE INDEX "CampaignTemplate_category_idx" ON "CampaignTemplate"("category");
CREATE INDEX "CampaignTemplate_countryCode_locale_idx" ON "CampaignTemplate"("countryCode", "locale");
CREATE INDEX "CampaignTemplate_goal_type_idx" ON "CampaignTemplate"("goal", "type");

CREATE INDEX "AgencyShopAccess_shopId_idx" ON "AgencyShopAccess"("shopId");
CREATE INDEX "AgencyShopAccess_role_idx" ON "AgencyShopAccess"("role");
