export const behaviorSegmentOptions = [
  { key: "NEW_VISITOR", label: "New visitor" },
  { key: "RETURNING_VISITOR", label: "Returning visitor" },
  {
    key: "VIEWED_PRODUCT_NO_ADD_TO_CART",
    label: "Viewed product but no add to cart",
  },
  {
    key: "ADDED_TO_CART_NO_CHECKOUT",
    label: "Added to cart but no checkout",
  },
  { key: "CHECKOUT_STARTED", label: "Checkout started" },
  { key: "SAW_CAMPAIGN", label: "Saw campaign X" },
  { key: "CLICKED_CAMPAIGN", label: "Clicked campaign X" },
  { key: "USED_UNIQUE_CODE", label: "Used unique code" },
  { key: "HIGH_INTENT", label: "High intent visitor" },
  { key: "INACTIVE_CART", label: "Inactive cart" },
] as const;

export type BehaviorSegmentKey = (typeof behaviorSegmentOptions)[number]["key"];

export type BehaviorTargetingRules = {
  enabled: boolean;
  segments: BehaviorSegmentKey[];
  /**
   * Legacy shared campaign IDs list. Kept for backward compatibility and used
   * to seed sawCampaignIds/clickedCampaignIds when those are absent.
   */
  campaignIds: string[];
  lookbackDays: number;

  // Visitor state
  returningMinPriorSessions: number;
  returningMinDaysSinceFirstSeen: number;

  // Shopping journey
  viewedProductMinViews: number;
  viewedProductDelayMinutes: number;
  addedToCartDelayMinutes: number;
  checkoutStartedDelayMinutes: number;
  checkoutStartedExcludePurchasers: boolean;
  inactiveCartMinutes: number;

  // Campaign and intent signals
  sawCampaignIds: string[];
  clickedCampaignIds: string[];
  usedUniqueCodeIncludeAssigned: boolean;
  highIntentMinEvents: number;
  highIntentWindowMinutes: number;
};

export const behaviorTargetingBounds = {
  lookbackDays: { min: 1, max: 365 },
  returningMinPriorSessions: { min: 1, max: 50 },
  returningMinDaysSinceFirstSeen: { min: 0, max: 365 },
  viewedProductMinViews: { min: 1, max: 50 },
  viewedProductDelayMinutes: { min: 0, max: 10080 },
  addedToCartDelayMinutes: { min: 0, max: 10080 },
  checkoutStartedDelayMinutes: { min: 0, max: 10080 },
  inactiveCartMinutes: { min: 15, max: 10080 },
  highIntentMinEvents: { min: 2, max: 20 },
  highIntentWindowMinutes: { min: 5, max: 1440 },
} as const;

export const defaultBehaviorTargetingRules: BehaviorTargetingRules = {
  enabled: false,
  segments: [],
  campaignIds: [],
  lookbackDays: 30,

  returningMinPriorSessions: 1,
  returningMinDaysSinceFirstSeen: 0,

  viewedProductMinViews: 1,
  viewedProductDelayMinutes: 0,
  addedToCartDelayMinutes: 0,
  checkoutStartedDelayMinutes: 0,
  checkoutStartedExcludePurchasers: true,
  inactiveCartMinutes: 60,

  sawCampaignIds: [],
  clickedCampaignIds: [],
  usedUniqueCodeIncludeAssigned: false,
  highIntentMinEvents: 3,
  highIntentWindowMinutes: 60,
};

const behaviorSegmentKeys = new Set(
  behaviorSegmentOptions.map((option) => option.key),
);

export function normalizeBehaviorTargetingRules(
  value: unknown,
): BehaviorTargetingRules {
  const input = readObject(value);
  const legacyCampaignIds = readStringList(input.campaignIds);
  const sawCampaignIds = hasOwn(input, "sawCampaignIds")
    ? readStringList(input.sawCampaignIds)
    : legacyCampaignIds;
  const clickedCampaignIds = hasOwn(input, "clickedCampaignIds")
    ? readStringList(input.clickedCampaignIds)
    : legacyCampaignIds;

  return {
    enabled: input.enabled === true || input.enabled === "true",
    segments: readSegmentList(input.segments),
    campaignIds: legacyCampaignIds,
    lookbackDays: readBound(input.lookbackDays, "lookbackDays"),

    returningMinPriorSessions: readBound(
      input.returningMinPriorSessions,
      "returningMinPriorSessions",
    ),
    returningMinDaysSinceFirstSeen: readBound(
      input.returningMinDaysSinceFirstSeen,
      "returningMinDaysSinceFirstSeen",
    ),

    viewedProductMinViews: readBound(
      input.viewedProductMinViews,
      "viewedProductMinViews",
    ),
    viewedProductDelayMinutes: readBound(
      input.viewedProductDelayMinutes,
      "viewedProductDelayMinutes",
    ),
    addedToCartDelayMinutes: readBound(
      input.addedToCartDelayMinutes,
      "addedToCartDelayMinutes",
    ),
    checkoutStartedDelayMinutes: readBound(
      input.checkoutStartedDelayMinutes,
      "checkoutStartedDelayMinutes",
    ),
    checkoutStartedExcludePurchasers: readBoolean(
      input.checkoutStartedExcludePurchasers,
      defaultBehaviorTargetingRules.checkoutStartedExcludePurchasers,
    ),
    inactiveCartMinutes: readBound(
      input.inactiveCartMinutes,
      "inactiveCartMinutes",
    ),

    sawCampaignIds,
    clickedCampaignIds,
    usedUniqueCodeIncludeAssigned: readBoolean(
      input.usedUniqueCodeIncludeAssigned,
      defaultBehaviorTargetingRules.usedUniqueCodeIncludeAssigned,
    ),
    highIntentMinEvents: readBound(
      input.highIntentMinEvents,
      "highIntentMinEvents",
    ),
    highIntentWindowMinutes: readBound(
      input.highIntentWindowMinutes,
      "highIntentWindowMinutes",
    ),
  };
}

export function hasBehaviorTargetingRules(value: unknown) {
  const rules = normalizeBehaviorTargetingRules(value);

  return rules.enabled && rules.segments.length > 0;
}

export function getBehaviorTargetingLookbackDays(value: unknown) {
  return normalizeBehaviorTargetingRules(value).lookbackDays;
}

export function behaviorSegmentsNeedCampaignIds(segments: BehaviorSegmentKey[]) {
  return (
    segments.includes("SAW_CAMPAIGN") ||
    segments.includes("CLICKED_CAMPAIGN")
  );
}

function readObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasOwn(input: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function readSegmentList(value: unknown): BehaviorSegmentKey[] {
  return readStringList(value).filter((item): item is BehaviorSegmentKey =>
    behaviorSegmentKeys.has(item as BehaviorSegmentKey),
  );
}

function readBoolean(value: unknown, fallback: boolean) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;

  return fallback;
}

function readBound(value: unknown, key: keyof typeof behaviorTargetingBounds) {
  const { min, max } = behaviorTargetingBounds[key];

  return readBoundedInteger(
    value,
    defaultBehaviorTargetingRules[key] as number,
    min,
    max,
  );
}

function readBoundedInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) return fallback;

  return Math.min(max, Math.max(min, parsed));
}
