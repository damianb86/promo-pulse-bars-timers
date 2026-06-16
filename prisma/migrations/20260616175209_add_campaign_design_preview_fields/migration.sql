-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CampaignDesign" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "templateKey" TEXT NOT NULL DEFAULT 'clean-minimal',
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
    "alignment" TEXT NOT NULL DEFAULT 'CENTER',
    "showCloseButton" BOOLEAN NOT NULL DEFAULT true,
    "showIcon" BOOLEAN NOT NULL DEFAULT true,
    "icon" TEXT NOT NULL DEFAULT 'NONE',
    CONSTRAINT "CampaignDesign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CampaignDesign" ("accentColor", "backgroundColor", "borderRadius", "buttonColor", "buttonTextColor", "campaignId", "customCss", "fontSize", "mobileEnabled", "positionSticky", "templateKey", "textColor") SELECT "accentColor", "backgroundColor", "borderRadius", "buttonColor", "buttonTextColor", "campaignId", "customCss", "fontSize", "mobileEnabled", "positionSticky", "templateKey", "textColor" FROM "CampaignDesign";
DROP TABLE "CampaignDesign";
ALTER TABLE "new_CampaignDesign" RENAME TO "CampaignDesign";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
