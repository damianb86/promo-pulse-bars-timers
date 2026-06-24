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
  now?: Date;
};

export async function buildVisitorBehaviorProfile({
  shopId,
  visitorId,
  sessionId,
  settings,
  privacy = {},
  lookbackDays = defaultBehaviorProfileOptions.lookbackDays,
  now = new Date(),
}: BuildVisitorBehaviorProfileInput): Promise<VisitorBehaviorProfile> {
  const privacyGate = getBehaviorPrivacyGate(settings, privacy);

  if (!privacyGate.allowed) {
    return emptyVisitorBehaviorProfile(privacyGate.reason, now);
  }

  const identityFilters = buildIdentityFilters(visitorId, sessionId);

  if (identityFilters.length === 0) {
    return emptyVisitorBehaviorProfile("missing_identity", now);
  }

  const since = new Date(
    now.getTime() - normalizeDays(lookbackDays) * 24 * 60 * 60 * 1000,
  );
  const [touches, codes] = await Promise.all([
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
        AND: [
          { OR: identityFilters },
          {
            OR: [
              {
                status: UniqueDiscountCodeStatus.USED,
                usedAt: { gte: since, lte: now },
              },
              {
                status: UniqueDiscountCodeStatus.ASSIGNED,
                assignedAt: { gte: since, lte: now },
              },
            ],
          },
        ],
      },
      select: {
        campaignId: true,
        status: true,
      },
    }),
  ]);

  return createProfileFromEvents({
    touches,
    usedUniqueCodeCampaignIds: codes
      .filter((code) => code.status === UniqueDiscountCodeStatus.USED)
      .map((code) => code.campaignId),
    assignedUniqueCodeCampaignIds: codes
      .filter((code) => code.status === UniqueDiscountCodeStatus.ASSIGNED)
      .map((code) => code.campaignId),
    visitorId: visitorId?.trim() || null,
    sessionId: sessionId?.trim() || null,
    now,
  });
}

function createProfileFromEvents({
  touches,
  usedUniqueCodeCampaignIds,
  assignedUniqueCodeCampaignIds,
  visitorId,
  sessionId,
  now,
}: {
  touches: AttributionTouch[];
  usedUniqueCodeCampaignIds: string[];
  assignedUniqueCodeCampaignIds: string[];
  visitorId: string | null;
  sessionId: string | null;
  now: Date;
}): VisitorBehaviorProfile {
  const firstTouch = touches[0] ?? null;
  const lastTouch = touches.at(-1) ?? null;
  const sessionIds = new Set(
    touches.map((touch) => touch.sessionId).filter(Boolean) as string[],
  );
  const priorSessionIds = new Set(
    Array.from(sessionIds).filter((value) => value !== sessionId),
  );

  return {
    canUseBehaviorTargeting: true,
    reason: "",
    visitorId,
    sessionId,
    generatedAt: now,
    firstSeenAt: firstTouch?.occurredAt ?? null,
    lastSeenAt: lastTouch?.occurredAt ?? null,
    totalTouches: touches.length,
    sessionCount: sessionIds.size,
    priorSessionCount: priorSessionIds.size,
    productViewCount: touches.filter(
      (touch) => touch.eventType === AnalyticsEventType.PRODUCT_VIEWED,
    ).length,
    latestProductViewedAt: latestEventTime(
      touches,
      AnalyticsEventType.PRODUCT_VIEWED,
    ),
    latestAddToCartAt: latestEventTime(touches, AnalyticsEventType.ADD_TO_CART),
    latestCheckoutStartedAt: latestEventTime(
      touches,
      AnalyticsEventType.CHECKOUT_STARTED,
    ),
    latestOrderAt: latestEventTime(
      touches,
      AnalyticsEventType.ORDER_ATTRIBUTED,
    ),
    intentEventTimes: touches
      .filter((touch) => highIntentEventTypes.has(touch.eventType))
      .map((touch) => touch.occurredAt),
    sawCampaignIds: uniqueCampaignIds(
      touches.filter((touch) => impressionEventTypes.has(touch.eventType)),
    ),
    clickedCampaignIds: uniqueCampaignIds(
      touches.filter((touch) => clickEventTypes.has(touch.eventType)),
    ),
    usedUniqueCodeCampaignIds: Array.from(new Set(usedUniqueCodeCampaignIds)),
    assignedUniqueCodeCampaignIds: Array.from(
      new Set(assignedUniqueCodeCampaignIds),
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
  return Number.isInteger(value) ? Math.min(365, Math.max(1, value)) : 1;
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
