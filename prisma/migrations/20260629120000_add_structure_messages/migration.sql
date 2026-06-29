-- AddColumn: custom reusable message snippets (JSON array of {id, text}) that
-- merchants place in the custom structural HTML via data-cp-slot="custom-<id>".
ALTER TABLE "CampaignDesign" ADD COLUMN "structureMessages" TEXT;
