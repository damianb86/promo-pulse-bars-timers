-- Adds behavior targeting rules to existing campaign targeting rows.
-- AnalyticsEventType is stored as TEXT in SQLite, so PRODUCT_VIEWED does not
-- require a table rewrite.

ALTER TABLE "CampaignTargeting" ADD COLUMN "behaviorRules" JSONB;
