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
  campaignIds: string[];
  lookbackDays: number;
  inactiveCartMinutes: number;
  highIntentMinEvents: number;
  highIntentWindowMinutes: number;
};

export const defaultBehaviorTargetingRules: BehaviorTargetingRules = {
  enabled: false,
  segments: [],
  campaignIds: [],
  lookbackDays: 30,
  inactiveCartMinutes: 60,
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

  return {
    enabled: input.enabled === true || input.enabled === "true",
    segments: readSegmentList(input.segments),
    campaignIds: readStringList(input.campaignIds),
    lookbackDays: readBoundedInteger(
      input.lookbackDays,
      defaultBehaviorTargetingRules.lookbackDays,
      1,
      365,
    ),
    inactiveCartMinutes: readBoundedInteger(
      input.inactiveCartMinutes,
      defaultBehaviorTargetingRules.inactiveCartMinutes,
      15,
      10080,
    ),
    highIntentMinEvents: readBoundedInteger(
      input.highIntentMinEvents,
      defaultBehaviorTargetingRules.highIntentMinEvents,
      2,
      20,
    ),
    highIntentWindowMinutes: readBoundedInteger(
      input.highIntentWindowMinutes,
      defaultBehaviorTargetingRules.highIntentWindowMinutes,
      5,
      1440,
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
