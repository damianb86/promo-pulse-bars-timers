import {
  defaultBehaviorTargetingRules,
  normalizeBehaviorTargetingRules,
  type BehaviorSegmentKey,
  type BehaviorTargetingRules,
} from "../../types/behavior-targeting";

/**
 * The visitor profile exposes raw timing/count primitives rather than
 * precomputed booleans. The matcher applies each campaign's configured
 * thresholds at evaluation time so that a single shared profile can be matched
 * against many campaigns with different per-segment settings.
 */
export type VisitorBehaviorProfile = {
  canUseBehaviorTargeting: boolean;
  reason: string;
  visitorId: string | null;
  sessionId: string | null;
  generatedAt: Date;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  totalTouches: number;
  sessionCount: number;
  /** Distinct prior sessions (sessions other than the current one). */
  priorSessionCount: number;
  productViewCount: number;
  latestProductViewedAt: Date | null;
  latestAddToCartAt: Date | null;
  latestCheckoutStartedAt: Date | null;
  latestOrderAt: Date | null;
  /** Timestamps of high-intent events within the lookback window (asc). */
  intentEventTimes: Date[];
  sawCampaignIds: string[];
  clickedCampaignIds: string[];
  usedUniqueCodeCampaignIds: string[];
  assignedUniqueCodeCampaignIds: string[];
};

export function campaignMatchesBehaviorTargeting(
  behaviorRules: unknown,
  profile: VisitorBehaviorProfile | null | undefined,
) {
  const rules = normalizeBehaviorTargetingRules(behaviorRules);

  if (!rules.enabled || rules.segments.length === 0) return true;
  if (!profile?.canUseBehaviorTargeting) return false;

  return rules.segments.some((segment) =>
    segmentMatchesProfile(segment, profile, rules),
  );
}

function segmentMatchesProfile(
  segment: BehaviorSegmentKey,
  profile: VisitorBehaviorProfile,
  rules: BehaviorTargetingRules,
) {
  const now = profile.generatedAt;

  if (segment === "NEW_VISITOR") return matchesNewVisitor(profile, rules, now);
  if (segment === "RETURNING_VISITOR") {
    return matchesReturningVisitor(profile, rules, now);
  }
  if (segment === "VIEWED_PRODUCT_NO_ADD_TO_CART") {
    return matchesViewedProductNoAddToCart(profile, rules, now);
  }
  if (segment === "ADDED_TO_CART_NO_CHECKOUT") {
    return matchesAddedToCartNoCheckout(profile, rules, now);
  }
  if (segment === "CHECKOUT_STARTED") {
    return matchesCheckoutStarted(profile, rules, now);
  }
  if (segment === "SAW_CAMPAIGN") {
    return matchesCampaignSet(profile.sawCampaignIds, rules.sawCampaignIds);
  }
  if (segment === "CLICKED_CAMPAIGN") {
    return matchesCampaignSet(
      profile.clickedCampaignIds,
      rules.clickedCampaignIds,
    );
  }
  if (segment === "USED_UNIQUE_CODE") {
    return matchesUsedUniqueCode(profile, rules);
  }
  if (segment === "HIGH_INTENT") return matchesHighIntent(profile, rules, now);
  if (segment === "INACTIVE_CART") {
    return matchesInactiveCart(profile, rules, now);
  }

  return false;
}

function matchesNewVisitor(
  profile: VisitorBehaviorProfile,
  rules: BehaviorTargetingRules,
  now: Date,
) {
  const isNew =
    profile.totalTouches === 0 &&
    profile.usedUniqueCodeCampaignIds.length === 0 &&
    profile.assignedUniqueCodeCampaignIds.length === 0;

  if (!isNew) return false;
  if (rules.newVisitorWithinMinutes <= 0) return true;

  // When a freshness window is configured, only count visitors whose first
  // observed activity is recent enough to be considered a brand-new session.
  if (!profile.firstSeenAt) return true;

  return (
    minutesBetween(profile.firstSeenAt, now) <= rules.newVisitorWithinMinutes
  );
}

function matchesReturningVisitor(
  profile: VisitorBehaviorProfile,
  rules: BehaviorTargetingRules,
  now: Date,
) {
  if (!profile.visitorId) return false;
  if (profile.priorSessionCount < rules.returningMinPriorSessions) return false;

  if (rules.returningMinDaysSinceFirstSeen > 0) {
    if (!profile.firstSeenAt) return false;
    if (
      daysBetween(profile.firstSeenAt, now) <
      rules.returningMinDaysSinceFirstSeen
    ) {
      return false;
    }
  }

  return true;
}

function matchesViewedProductNoAddToCart(
  profile: VisitorBehaviorProfile,
  rules: BehaviorTargetingRules,
  now: Date,
) {
  if (!profile.latestProductViewedAt) return false;
  if (profile.productViewCount < rules.viewedProductMinViews) return false;
  if (
    profile.latestAddToCartAt &&
    profile.latestAddToCartAt >= profile.latestProductViewedAt
  ) {
    return false;
  }

  return (
    minutesBetween(profile.latestProductViewedAt, now) >=
    rules.viewedProductDelayMinutes
  );
}

function matchesAddedToCartNoCheckout(
  profile: VisitorBehaviorProfile,
  rules: BehaviorTargetingRules,
  now: Date,
) {
  if (!profile.latestAddToCartAt) return false;
  if (
    profile.latestCheckoutStartedAt &&
    profile.latestCheckoutStartedAt >= profile.latestAddToCartAt
  ) {
    return false;
  }

  return (
    minutesBetween(profile.latestAddToCartAt, now) >=
    rules.addedToCartDelayMinutes
  );
}

function matchesCheckoutStarted(
  profile: VisitorBehaviorProfile,
  rules: BehaviorTargetingRules,
  now: Date,
) {
  if (!profile.latestCheckoutStartedAt) return false;

  if (
    rules.checkoutStartedExcludePurchasers &&
    profile.latestOrderAt &&
    profile.latestOrderAt >= profile.latestCheckoutStartedAt
  ) {
    return false;
  }

  return (
    minutesBetween(profile.latestCheckoutStartedAt, now) >=
    rules.checkoutStartedDelayMinutes
  );
}

function matchesUsedUniqueCode(
  profile: VisitorBehaviorProfile,
  rules: BehaviorTargetingRules,
) {
  if (profile.usedUniqueCodeCampaignIds.length > 0) return true;

  return (
    rules.usedUniqueCodeIncludeAssigned &&
    profile.assignedUniqueCodeCampaignIds.length > 0
  );
}

function matchesHighIntent(
  profile: VisitorBehaviorProfile,
  rules: BehaviorTargetingRules,
  now: Date,
) {
  const since = new Date(
    now.getTime() - rules.highIntentWindowMinutes * 60_000,
  );
  const count = profile.intentEventTimes.filter(
    (time) => time >= since,
  ).length;

  return count >= rules.highIntentMinEvents;
}

function matchesInactiveCart(
  profile: VisitorBehaviorProfile,
  rules: BehaviorTargetingRules,
  now: Date,
) {
  if (!profile.latestAddToCartAt) return false;
  if (
    profile.latestCheckoutStartedAt &&
    profile.latestCheckoutStartedAt >= profile.latestAddToCartAt
  ) {
    return false;
  }
  if (
    profile.latestOrderAt &&
    profile.latestOrderAt >= profile.latestAddToCartAt
  ) {
    return false;
  }

  return (
    minutesBetween(profile.latestAddToCartAt, now) >= rules.inactiveCartMinutes
  );
}

function matchesCampaignSet(
  actualCampaignIds: string[],
  targetCampaignIds: string[],
) {
  if (targetCampaignIds.length === 0) return actualCampaignIds.length > 0;

  const actual = new Set(actualCampaignIds);

  return targetCampaignIds.some((campaignId) => actual.has(campaignId));
}

function minutesBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / 60_000;
}

function daysBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / 86_400_000;
}

export function emptyVisitorBehaviorProfile(
  reason: string,
  generatedAt: Date = new Date(),
): VisitorBehaviorProfile {
  return {
    canUseBehaviorTargeting: false,
    reason,
    visitorId: null,
    sessionId: null,
    generatedAt,
    firstSeenAt: null,
    lastSeenAt: null,
    totalTouches: 0,
    sessionCount: 0,
    priorSessionCount: 0,
    productViewCount: 0,
    latestProductViewedAt: null,
    latestAddToCartAt: null,
    latestCheckoutStartedAt: null,
    latestOrderAt: null,
    intentEventTimes: [],
    sawCampaignIds: [],
    clickedCampaignIds: [],
    usedUniqueCodeCampaignIds: [],
    assignedUniqueCodeCampaignIds: [],
  };
}

export const defaultBehaviorProfileOptions = {
  lookbackDays: defaultBehaviorTargetingRules.lookbackDays,
};
