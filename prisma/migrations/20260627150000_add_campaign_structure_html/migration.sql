-- AddColumn: per-campaign structural HTML (dictionary-packed + gzip), associated
-- CSS, a version marker, and a flag indicating the merchant hand-edited the HTML.
ALTER TABLE "CampaignDesign" ADD COLUMN "structureCompact" TEXT;
ALTER TABLE "CampaignDesign" ADD COLUMN "structureCss" TEXT;
ALTER TABLE "CampaignDesign" ADD COLUMN "structureVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CampaignDesign" ADD COLUMN "structureEdited" BOOLEAN NOT NULL DEFAULT false;
