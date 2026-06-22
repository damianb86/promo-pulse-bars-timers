UPDATE "CampaignPlacement"
SET "placementType" = 'PRODUCT_PAGE_BADGE'
WHERE "placementType" = 'PRODUCT_PAGE'
  AND "campaignId" IN (
    SELECT "id"
    FROM "Campaign"
    WHERE "type" = 'PRODUCT_BADGE'
  );
