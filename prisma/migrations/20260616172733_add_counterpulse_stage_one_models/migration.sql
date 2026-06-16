-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyDomain" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "type" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignPlacement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "placementType" TEXT NOT NULL,
    "customSelector" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CampaignPlacement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignTargeting" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "countries" JSONB NOT NULL,
    "markets" JSONB NOT NULL,
    "locales" JSONB NOT NULL,
    "productIds" JSONB NOT NULL,
    "collectionIds" JSONB NOT NULL,
    "productTags" JSONB NOT NULL,
    "customerTags" JSONB NOT NULL,
    "urlContains" JSONB NOT NULL,
    "utmSources" JSONB NOT NULL,
    "devices" JSONB NOT NULL,
    "excludeProductIds" JSONB NOT NULL,
    "excludeCollectionIds" JSONB NOT NULL,
    CONSTRAINT "CampaignTargeting_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignDesign" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "templateKey" TEXT NOT NULL DEFAULT 'default',
    "backgroundColor" TEXT NOT NULL DEFAULT '#111827',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "accentColor" TEXT NOT NULL DEFAULT '#22C55E',
    "buttonColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "buttonTextColor" TEXT NOT NULL DEFAULT '#111827',
    "fontSize" INTEGER NOT NULL DEFAULT 14,
    "borderRadius" INTEGER NOT NULL DEFAULT 0,
    "positionSticky" BOOLEAN NOT NULL DEFAULT true,
    "customCss" TEXT,
    "mobileEnabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CampaignDesign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimerSettings" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "recurringDays" JSONB NOT NULL,
    "resetBehavior" TEXT NOT NULL DEFAULT 'NEVER',
    CONSTRAINT "TimerSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FreeShippingSettings" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "thresholdAmount" DECIMAL NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "includeDiscountedSubtotal" BOOLEAN NOT NULL DEFAULT true,
    "successMessage" TEXT,
    "progressStyle" TEXT NOT NULL DEFAULT 'BAR',
    CONSTRAINT "FreeShippingSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryCutoffSettings" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "cutoffHour" INTEGER NOT NULL,
    "cutoffMinute" INTEGER NOT NULL DEFAULT 0,
    "processingDays" INTEGER NOT NULL DEFAULT 0,
    "minDeliveryDays" INTEGER NOT NULL,
    "maxDeliveryDays" INTEGER NOT NULL,
    "workingDays" JSONB NOT NULL,
    "holidays" JSONB NOT NULL,
    "countryRules" JSONB NOT NULL,
    CONSTRAINT "DeliveryCutoffSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LowStockSettings" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "threshold" INTEGER NOT NULL,
    "showExactQuantity" BOOLEAN NOT NULL DEFAULT false,
    "fallbackMessage" TEXT,
    CONSTRAINT "LowStockSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BadgeSettings" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "badgeText" TEXT NOT NULL,
    "badgeShape" TEXT NOT NULL DEFAULT 'PILL',
    "badgePosition" TEXT NOT NULL DEFAULT 'TOP_RIGHT',
    CONSTRAINT "BadgeSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscountSync" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "shopifyDiscountId" TEXT,
    "discountCode" TEXT,
    "method" TEXT NOT NULL,
    "syncStartEnd" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" DATETIME,
    CONSTRAINT "DiscountSync_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "headline" TEXT,
    "subheadline" TEXT,
    "ctaText" TEXT,
    "expiredText" TEXT,
    "freeShippingProgressText" TEXT,
    "freeShippingSuccessText" TEXT,
    "deliveryBeforeCutoffText" TEXT,
    "deliveryAfterCutoffText" TEXT,
    "lowStockText" TEXT,
    "badgeText" TEXT,
    CONSTRAINT "CampaignTranslation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT,
    "eventType" TEXT NOT NULL,
    "placementType" TEXT,
    "sessionId" TEXT,
    "cartToken" TEXT,
    "orderId" TEXT,
    "revenueAmount" DECIMAL,
    "currencyCode" TEXT,
    "country" TEXT,
    "locale" TEXT,
    "userAgent" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnalyticsEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopifyDomain_key" ON "Shop"("shopifyDomain");

-- CreateIndex
CREATE INDEX "Campaign_shopId_status_idx" ON "Campaign"("shopId", "status");

-- CreateIndex
CREATE INDEX "Campaign_shopId_type_idx" ON "Campaign"("shopId", "type");

-- CreateIndex
CREATE INDEX "Campaign_shopId_priority_idx" ON "Campaign"("shopId", "priority");

-- CreateIndex
CREATE INDEX "Campaign_startsAt_endsAt_idx" ON "Campaign"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "CampaignPlacement_campaignId_idx" ON "CampaignPlacement"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignPlacement_placementType_idx" ON "CampaignPlacement"("placementType");

-- CreateIndex
CREATE INDEX "DiscountSync_shopifyDiscountId_idx" ON "DiscountSync"("shopifyDiscountId");

-- CreateIndex
CREATE INDEX "DiscountSync_discountCode_idx" ON "DiscountSync"("discountCode");

-- CreateIndex
CREATE INDEX "CampaignTranslation_locale_idx" ON "CampaignTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTranslation_campaignId_locale_key" ON "CampaignTranslation"("campaignId", "locale");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shopId_occurredAt_idx" ON "AnalyticsEvent"("shopId", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_campaignId_eventType_occurredAt_idx" ON "AnalyticsEvent"("campaignId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_occurredAt_idx" ON "AnalyticsEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_orderId_idx" ON "AnalyticsEvent"("orderId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");
