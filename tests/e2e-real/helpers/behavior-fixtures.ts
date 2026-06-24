import {
  AnalyticsEventType,
  PlacementType,
  UniqueDiscountCodeStatus,
} from "@prisma/client";

import prisma from "../../../app/db.server";
import {
  defaultBehaviorTargetingRules,
  type BehaviorTargetingRules,
} from "../../../app/types/behavior-targeting";

/**
 * Behavior targeting rules ready to drop into a campaign's
 * `targeting.behaviorRules`. Starts from the production defaults so seeded
 * campaigns exercise the same normalization the storefront uses, then applies
 * the per-test overrides.
 */
export function behaviorRules(
  overrides: Partial<BehaviorTargetingRules> = {},
): BehaviorTargetingRules {
  return {
    ...defaultBehaviorTargetingRules,
    enabled: true,
    ...overrides,
  };
}

let visitorCounter = 0;

/**
 * Stable, unique visitor/session identifiers for a single assertion so seeded
 * profiles never collide across tests running on the shared real-store DB.
 */
export function behaviorVisitor(label: string) {
  visitorCounter += 1;
  const suffix = `${Date.now().toString(36)}-${visitorCounter}`;

  return {
    visitorId: `pp-e2e-behavior-${label}-v-${suffix}`,
    sessionId: `pp-e2e-behavior-${label}-s-${suffix}`,
  };
}

export function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000);
}

export function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

export type SeedTouch = {
  type: AnalyticsEventType;
  at: Date;
  /** Defaults to the anchor campaign. Override for SAW/CLICKED campaign tests. */
  campaignId?: string;
  /** Defaults to the visitor's current session. Override to simulate prior sessions. */
  sessionId?: string;
};

/**
 * Seed raw attribution touches for a visitor. `AttributionTouch.campaignId` is
 * required, so non campaign-specific events (product views, add-to-cart, …) are
 * anchored to `anchorCampaignId` while SAW/CLICKED events can point at the
 * referenced campaign via `campaignId`.
 */
export async function seedBehaviorTouches(input: {
  shopId: string;
  anchorCampaignId: string;
  visitorId: string;
  sessionId: string;
  events: SeedTouch[];
}) {
  if (input.events.length === 0) return;

  await prisma.attributionTouch.createMany({
    data: input.events.map((event) => ({
      shopId: input.shopId,
      campaignId: event.campaignId ?? input.anchorCampaignId,
      visitorId: input.visitorId,
      sessionId: event.sessionId ?? input.sessionId,
      eventType: event.type,
      placementType: PlacementType.TOP_BAR,
      path: "/",
      country: "US",
      locale: "en",
      occurredAt: event.at,
    })),
  });
}

/**
 * Seed a unique discount code for a visitor in a given lifecycle state so the
 * USED_UNIQUE_CODE segment (and its include-assigned sub-option) can be
 * exercised end to end.
 */
export async function seedBehaviorUniqueCode(input: {
  shopId: string;
  campaignId: string;
  visitorId: string;
  sessionId: string;
  status: UniqueDiscountCodeStatus;
  assignedAt?: Date;
  usedAt?: Date;
}) {
  const code = `PPE2EBHV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  await prisma.uniqueDiscountCode.create({
    data: {
      shopId: input.shopId,
      campaignId: input.campaignId,
      code,
      status: input.status,
      visitorId: input.visitorId,
      sessionId: input.sessionId,
      assignedAt: input.assignedAt ?? minutesAgo(30),
      usedAt:
        input.status === UniqueDiscountCodeStatus.USED
          ? (input.usedAt ?? minutesAgo(15))
          : null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return code;
}

/**
 * Remove seeded touches and codes for the given visitors. Touches/codes are not
 * cleaned up by pausing campaigns, so call this in afterEach to keep the shared
 * store tidy when cleanup is enabled.
 */
export async function clearBehaviorVisitorData(visitorIds: string[]) {
  if (visitorIds.length === 0) return;

  await prisma.attributionTouch.deleteMany({
    where: { visitorId: { in: visitorIds } },
  });
  await prisma.uniqueDiscountCode.deleteMany({
    where: { visitorId: { in: visitorIds } },
  });
}
