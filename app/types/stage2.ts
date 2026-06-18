export const premiumFeatureKeys = [
  "UNIQUE_CODES",
  "AB_TESTING",
  "AUTO_WINNER",
  "ADVANCED_DISCOUNTS",
  "CHECKOUT_EXTENSIONS",
  "EMAIL_TIMERS",
  "ADVANCED_BADGES",
  "MARKETS_ADVANCED",
  "AI_CAMPAIGN_BUILDER",
  "AGENCY_DASHBOARD",
  "ADVANCED_REPORTING",
  "BEHAVIORAL_TARGETING",
  "RECOMMENDATIONS",
  "CAMPAIGN_LIBRARY",
] as const;

export type PremiumFeatureKey = (typeof premiumFeatureKeys)[number];

export const internalStage2FeatureFlags = [
  "UNIQUE_CODES",
  "AB_TESTING",
  "AUTO_WINNER",
  "ADVANCED_DISCOUNTS",
  "CHECKOUT_EXTENSIONS",
  "EMAIL_TIMERS",
  "ADVANCED_BADGES",
  "MARKETS_ADVANCED",
  "AI_CAMPAIGN_BUILDER",
  "AGENCY_DASHBOARD",
] as const;

export type InternalStage2FeatureFlag =
  (typeof internalStage2FeatureFlags)[number];

export const experimentStatuses = [
  "DRAFT",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
] as const;

export type ExperimentStatus = (typeof experimentStatuses)[number];

export const experimentVariantStatuses = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "WINNER",
  "LOSER",
  "ARCHIVED",
] as const;

export type ExperimentVariantStatus =
  (typeof experimentVariantStatuses)[number];

export const attributionModels = [
  "LAST_CLICK",
  "FIRST_CLICK",
  "LINEAR",
  "POSITION_BASED",
  "TIME_DECAY",
] as const;

export type AttributionModel = (typeof attributionModels)[number];

export const uniqueCodeStatuses = [
  "AVAILABLE",
  "ASSIGNED",
  "USED",
  "EXPIRED",
  "REVOKED",
] as const;

export type UniqueCodeStatus = (typeof uniqueCodeStatuses)[number];

export const recommendationTypes = [
  "CAMPAIGN_TEMPLATE",
  "PLACEMENT",
  "DISCOUNT_VALUE",
  "MESSAGE",
  "TARGETING",
  "TIMING",
  "MARKET_LOCALIZATION",
] as const;

export type RecommendationType = (typeof recommendationTypes)[number];

export const campaignTemplateCategories = [
  "HOLIDAY",
  "SEASONAL",
  "COUNTRY_EVENT",
  "FLASH_SALE",
  "FREE_SHIPPING",
  "PRODUCT_LAUNCH",
  "CART_RECOVERY",
  "BFCM",
] as const;

export type CampaignTemplateCategory =
  (typeof campaignTemplateCategories)[number];
