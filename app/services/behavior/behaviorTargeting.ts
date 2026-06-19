import {
  defaultBehaviorTargetingRules,
  normalizeBehaviorTargetingRules,
  type BehaviorSegmentKey,
} from "../../types/behavior-targeting";

export type VisitorBehaviorProfile = {
  canUseBehaviorTargeting: boolean;
  reason: string;
  visitorId: string | null;
  sessionId: string | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  totalTouches: number;
  sessionCount: number;
  newVisitor: boolean;
  returningVisitor: boolean;
  viewedProductNoAddToCart: boolean;
  addedToCartNoCheckout: boolean;
  checkoutStarted: boolean;
  sawCampaignIds: string[];
  clickedCampaignIds: string[];
  usedUniqueCodeCampaignIds: string[];
  highIntentVisitor: boolean;
  inactiveCart: boolean;
};

export function campaignMatchesBehaviorTargeting(
  behaviorRules: unknown,
  profile: VisitorBehaviorProfile | null | undefined,
) {
  const rules = normalizeBehaviorTargetingRules(behaviorRules);

  if (!rules.enabled || rules.segments.length === 0) return true;
  if (!profile?.canUseBehaviorTargeting) return false;

  return rules.segments.some((segment) =>
    segmentMatchesProfile(segment, profile, rules.campaignIds),
  );
}

function segmentMatchesProfile(
  segment: BehaviorSegmentKey,
  profile: VisitorBehaviorProfile,
  campaignIds: string[],
) {
  if (segment === "NEW_VISITOR") return profile.newVisitor;
  if (segment === "RETURNING_VISITOR") return profile.returningVisitor;
  if (segment === "VIEWED_PRODUCT_NO_ADD_TO_CART") {
    return profile.viewedProductNoAddToCart;
  }
  if (segment === "ADDED_TO_CART_NO_CHECKOUT") {
    return profile.addedToCartNoCheckout;
  }
  if (segment === "CHECKOUT_STARTED") return profile.checkoutStarted;
  if (segment === "SAW_CAMPAIGN") {
    return matchesCampaignSet(profile.sawCampaignIds, campaignIds);
  }
  if (segment === "CLICKED_CAMPAIGN") {
    return matchesCampaignSet(profile.clickedCampaignIds, campaignIds);
  }
  if (segment === "USED_UNIQUE_CODE") {
    return profile.usedUniqueCodeCampaignIds.length > 0;
  }
  if (segment === "HIGH_INTENT") return profile.highIntentVisitor;
  if (segment === "INACTIVE_CART") return profile.inactiveCart;

  return false;
}

function matchesCampaignSet(actualCampaignIds: string[], targetCampaignIds: string[]) {
  if (targetCampaignIds.length === 0) return actualCampaignIds.length > 0;

  const actual = new Set(actualCampaignIds);

  return targetCampaignIds.some((campaignId) => actual.has(campaignId));
}

export function emptyVisitorBehaviorProfile(
  reason: string,
): VisitorBehaviorProfile {
  return {
    canUseBehaviorTargeting: false,
    reason,
    visitorId: null,
    sessionId: null,
    firstSeenAt: null,
    lastSeenAt: null,
    totalTouches: 0,
    sessionCount: 0,
    newVisitor: false,
    returningVisitor: false,
    viewedProductNoAddToCart: false,
    addedToCartNoCheckout: false,
    checkoutStarted: false,
    sawCampaignIds: [],
    clickedCampaignIds: [],
    usedUniqueCodeCampaignIds: [],
    highIntentVisitor: false,
    inactiveCart: false,
  };
}

export const defaultBehaviorProfileOptions = {
  lookbackDays: defaultBehaviorTargetingRules.lookbackDays,
  inactiveCartMinutes: defaultBehaviorTargetingRules.inactiveCartMinutes,
  highIntentMinEvents: defaultBehaviorTargetingRules.highIntentMinEvents,
  highIntentWindowMinutes:
    defaultBehaviorTargetingRules.highIntentWindowMinutes,
};
