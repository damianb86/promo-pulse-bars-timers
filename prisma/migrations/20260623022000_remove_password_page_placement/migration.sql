DELETE FROM "CampaignPlacement"
WHERE "placementType"::text = 'PASSWORD_PAGE';

UPDATE "AnalyticsEvent"
SET "placementType" = NULL
WHERE "placementType"::text = 'PASSWORD_PAGE';

UPDATE "AttributionTouch"
SET "placementType" = NULL
WHERE "placementType"::text = 'PASSWORD_PAGE';

ALTER TYPE "PlacementType" RENAME TO "PlacementType_old";

CREATE TYPE "PlacementType" AS ENUM (
  'TOP_BAR',
  'BOTTOM_BAR',
  'PRODUCT_PAGE',
  'PRODUCT_PAGE_BADGE',
  'COLLECTION_CARD',
  'CART_PAGE',
  'CART_DRAWER',
  'THANK_YOU_PAGE',
  'ORDER_STATUS_PAGE',
  'CUSTOM_SELECTOR'
);

ALTER TABLE "CampaignPlacement"
ALTER COLUMN "placementType" TYPE "PlacementType"
USING "placementType"::text::"PlacementType";

ALTER TABLE "AnalyticsEvent"
ALTER COLUMN "placementType" TYPE "PlacementType"
USING "placementType"::text::"PlacementType";

ALTER TABLE "AttributionTouch"
ALTER COLUMN "placementType" TYPE "PlacementType"
USING "placementType"::text::"PlacementType";

DROP TYPE "PlacementType_old";
