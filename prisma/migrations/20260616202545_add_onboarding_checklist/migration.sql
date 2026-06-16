-- CreateTable
CREATE TABLE "ShopOnboardingChecklist" (
    "shopId" TEXT NOT NULL PRIMARY KEY,
    "firstCampaignCreated" BOOLEAN NOT NULL DEFAULT false,
    "appEmbedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "productBlockAdded" BOOLEAN NOT NULL DEFAULT false,
    "cartBlockAdded" BOOLEAN NOT NULL DEFAULT false,
    "firstImpressionReceived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopOnboardingChecklist_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
