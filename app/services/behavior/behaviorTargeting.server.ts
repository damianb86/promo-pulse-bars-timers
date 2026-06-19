import {
  AnalyticsEventType,
  UniqueDiscountCodeStatus,
  type AttributionTouch,
  type ConsentMode,
  type ShopSettings,
} from "@prisma/client";

import prisma from "../../db.server";
import {
  campaignMatchesBehaviorTargeting,
  defaultBehaviorProfileOptions,
  emptyVisitorBehaviorProfile,
  type VisitorBehaviorProfile,
} from "./behaviorTargeting";

export { campaignMatchesBehaviorTargeting };
export type { VisitorBehaviorProfile };

export type BuildVisitorBehaviorProfileInput = {
  shopId: string;
  visitorId?: string | null;
  sessionId?: string | null;
  settings:
    | Pick<
        ShopSettings,
        "analyticsEnabled" | "consentMode" | "respectDoNotTrack"
      >
    | null
    | undefined;
  privacy?: {
    doNotTrack?: boolean;
    consentGranted?: boolean | null;
  };
  lookbackDays?: number;
  inactiveCartMinutes?: number;
  highIntentMinEvents?: number;
  highIntentWindowMinutes?: number;
  now?: Date;
};

export async function buildVisitorBehaviorProfile({
  shopId,
  visitorId,
  sessionId,
  settings,
  privacy = {},
  lookbackDays = defaultBehaviorProfileOptions.lookbackDays,
  inactiveCartMinutes = defaultBehaviorProfileOptions.inactiveCartMinutes,
  highIntentMinEvents = defaultBehaviorProfileOptions.highIntentMinEvents,
  highIntentWindowMinutes = defaultBehaviorProfileOptions.highIntentWindowMinutes,
  now = new Date(),
}: BuildVisitorBehaviorProfileInput): Promise<VisitorBehaviorProfile> {
  const privacyGate = getBehaviorPrivacyGate(settings, privacy);

  if (!privacyGate.allowed) {
    return emptyVisitorBehaviorProfile(privacyGate.reason);
  }

  const identityFilters = buildIdentityFilters(visitorId, sessionId);

  if (identityFilters.length === 0) {
    return emptyVisitorBehaviorProfile("missing_identity");
  }

  const since = new Date(
    now.getTime() - normalizeDays(lookbackDays) * 24 * 60 * 60 * 1000,
  );
  const [touches, usedCodes] = await Promise.all([
    prisma.attributionTouch.findMany({
      where: {
        shopId,
        OR: identityFilters,
        occurredAt: { gte: since, lte: now },
      },
      orderBy: [{ occurredAt: "asc" }],
    }),
    prisma.uniqueDiscountCode.findMany({
      where: {
        shopId,
        OR: identityFilters,
        status: UniqueDiscountCodeStatus.USED,
        usedAt: { gte: since, lte: now },
      },
      select: {
        campaignId: true,
      },
    }),
  ]);

  return createProfileFromEvents({
    touches,
    usedUniqueCodeCampaignIds: usedCodes.map((code) => code.campaignId),
    visitorId: visitorId?.trim() || null,
    sessionId: sessionId?.trim() || null,
    inactiveCartMinutes,
    highIntentMinEvents,
    highIntentWindowMinutes,
    now,
  });
}

function createProfileFromEvents({
  touches,
  usedUniqueCodeCampaignIds,
  visitorId,
  sessionId,
  inactiveCartMinutes,
  highIntentMinEvents,
  highIntentWindowMinutes,
  now,
}: {
  touches: AttributionTouch[];
  usedUniqueCodeCampaignIds: string[];
  visitorId: string | null;
  sessionId: string | null;
  inactiveCartMinutes: number;
  highIntentMinEvents: number;
  highIntentWindowMinutes: number;
  now: Date;
}): VisitorBehaviorProfile {
  const firstTouch = touches[0] ?? null;
  const lastTouch = touches.at(-1) ?? null;
  const sessionIds = new Set(
    touches.map((touch) => touch.sessionId).filter(Boolean) as string[],
  );
  const latestProductViewedAt = latestEventTime(
    touches,
    AnalyticsEventType.PRODUCT_VIEWED,
  );
  const latestAddToCartAt = latestEventTime(
    touches,
    AnalyticsEventType.ADD_TO_CART,
  );
  const latestCheckoutStartedAt = latestEventTime(
    touches,
    AnalyticsEventType.CHECKOUT_STARTED,
  );
  const latestOrderAt = latestEventTime(
    touches,
    AnalyticsEventType.ORDER_ATTRIBUTED,
  );
  const inactiveCartAfter = new Date(
    now.getTime() - normalizeMinutes(inactiveCartMinutes, 15, 10080) * 60_000,
  );
  const highIntentSince = new Date(
    now.getTime() -
      normalizeMinutes(highIntentWindowMinutes, 5, 1440) * 60_000,
  );
  const highIntentEventCount = touches.filter(
    (touch) =>
      touch.occurredAt >= highIntentSince &&
      highIntentEventTypes.has(touch.eventType),
  ).length;

  return {
    canUseBehaviorTargeting: true,
    reason: "",
    visitorId,
    sessionId,
    firstSeenAt: firstTouch?.occurredAt ?? null,
    lastSeenAt: lastTouch?.occurredAt ?? null,
    totalTouches: touches.length,
    sessionCount: sessionIds.size,
    newVisitor: touches.length === 0 && usedUniqueCodeCampaignIds.length === 0,
    returningVisitor:
      Boolean(visitorId) &&
      Array.from(sessionIds).some((value) => value !== sessionId),
    viewedProductNoAddToCart: Boolean(
      latestProductViewedAt &&
        (!latestAddToCartAt || latestAddToCartAt < latestProductViewedAt),
    ),
    addedToCartNoCheckout: Boolean(
      latestAddToCartAt &&
        (!latestCheckoutStartedAt || latestCheckoutStartedAt < latestAddToCartAt),
    ),
    checkoutStarted: Boolean(latestCheckoutStartedAt),
    sawCampaignIds: uniqueCampaignIds(
      touches.filter((touch) => impressionEventTypes.has(touch.eventType)),
    ),
    clickedCampaignIds: uniqueCampaignIds(
      touches.filter((touch) => clickEventTypes.has(touch.eventType)),
    ),
    usedUniqueCodeCampaignIds: Array.from(new Set(usedUniqueCodeCampaignIds)),
    highIntentVisitor:
      highIntentEventCount >=
      normalizeInteger(highIntentMinEvents, 2, 20),
    inactiveCart: Boolean(
      latestAddToCartAt &&
        latestAddToCartAt <= inactiveCartAfter &&
        (!latestCheckoutStartedAt || latestCheckoutStartedAt < latestAddToCartAt) &&
        (!latestOrderAt || latestOrderAt < latestAddToCartAt),
    ),
  };
}

function getBehaviorPrivacyGate(
  settings: BuildVisitorBehaviorProfileInput["settings"],
  privacy: NonNullable<BuildVisitorBehaviorProfileInput["privacy"]>,
) {
  if (!settings) return { allowed: false, reason: "missing_settings" };
  if (settings.analyticsEnabled === false) {
    return { allowed: false, reason: "analytics_disabled" };
  }
  if (settings.respectDoNotTrack !== false && privacy.doNotTrack) {
    return { allowed: false, reason: "do_not_track" };
  }
  if (
    settings.consentMode === ("STRICT" satisfies ConsentMode) &&
    privacy.consentGranted !== true
  ) {
    return { allowed: false, reason: "missing_consent" };
  }

  return { allowed: true, reason: "" };
}

function buildIdentityFilters(visitorId?: string | null, sessionId?: string | null) {
  return [
    visitorId?.trim() ? { visitorId: visitorId.trim() } : null,
    sessionId?.trim() ? { sessionId: sessionId.trim() } : null,
  ].filter(Boolean) as Array<{ visitorId: string } | { sessionId: string }>;
}

function latestEventTime(touches: AttributionTouch[], eventType: AnalyticsEventType) {
  return (
    touches
      .filter((touch) => touch.eventType === eventType)
      .map((touch) => touch.occurredAt)
      .at(-1) ?? null
  );
}

function uniqueCampaignIds(touches: AttributionTouch[]) {
  return Array.from(new Set(touches.map((touch) => touch.campaignId)));
}

function normalizeDays(value: number) {
  return normalizeInteger(value, 1, 365);
}

function normalizeMinutes(value: number, min: number, max: number) {
  return normalizeInteger(value, min, max);
}

function normalizeInteger(value: number, min: number, max: number) {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : min;
}

const impressionEventTypes = new Set<AnalyticsEventType>([
  AnalyticsEventType.IMPRESSION,
  AnalyticsEventType.BADGE_IMPRESSION,
]);

const clickEventTypes = new Set<AnalyticsEventType>([
  AnalyticsEventType.CLICK,
  AnalyticsEventType.BADGE_CLICK,
]);

const highIntentEventTypes = new Set<AnalyticsEventType>([
  AnalyticsEventType.PRODUCT_VIEWED,
  AnalyticsEventType.CLICK,
  AnalyticsEventType.BADGE_CLICK,
  AnalyticsEventType.ADD_TO_CART,
  AnalyticsEventType.CHECKOUT_STARTED,
]);
