-- CreateTable
CREATE TABLE "ShopSettings" (
    "shopId" TEXT NOT NULL PRIMARY KEY,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "enabledLocales" JSONB NOT NULL,
    "defaultTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "enableDebugMode" BOOLEAN NOT NULL DEFAULT false,
    "brandName" TEXT,
    "supportEmail" TEXT,
    "defaultCountry" TEXT,
    "customCartDrawerSelector" TEXT,
    "customCartPageSelector" TEXT,
    "customProductFormSelector" TEXT,
    "analyticsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "respectDoNotTrack" BOOLEAN NOT NULL DEFAULT true,
    "consentMode" TEXT NOT NULL DEFAULT 'BASIC',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopSettings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
