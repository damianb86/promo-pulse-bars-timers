import { AnalyticsEventType, PlacementType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  attributionTouch: {
    findMany: vi.fn(),
  },
  uniqueDiscountCode: {
    findMany: vi.fn(),
  },
}));

vi.mock("../../db.server", () => ({
  default: prismaMock,
}));

import {
  buildVisitorBehaviorProfile,
  campaignMatchesBehaviorTargeting,
} from "./behaviorTargeting.server";

const now = new Date("2026-06-18T12:00:00.000Z");
const settings = {
  analyticsEnabled: true,
  consentMode: "BASIC" as const,
  respectDoNotTrack: true,
};

describe("behavior targeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.attributionTouch.findMany.mockResolvedValue([]);
    prismaMock.uniqueDiscountCode.findMany.mockResolvedValue([]);
  });

  it("matches a new visitor when there is no anonymous behavior history", async () => {
    const profile = await buildVisitorBehaviorProfile({
      shopId: "shop-1",
      visitorId: "visitor-1",
      sessionId: "session-1",
      settings,
      now,
    });

    expect(profile).toMatchObject({
      canUseBehaviorTargeting: true,
      totalTouches: 0,
      priorSessionCount: 0,
    });
    expect(
      campaignMatchesBehaviorTargeting(
        { enabled: true, segments: ["NEW_VISITOR"] },
        profile,
      ),
    ).toBe(true);
  });

  it("detects a returning visitor from a prior session", async () => {
    prismaMock.attributionTouch.findMany.mockResolvedValue([
      touch({ sessionId: "previous-session" }),
      touch({ sessionId: "current-session" }),
    ]);

    const profile = await buildVisitorBehaviorProfile({
      shopId: "shop-1",
      visitorId: "visitor-1",
      sessionId: "current-session",
      settings,
      now,
    });

    expect(profile.priorSessionCount).toBe(1);
    expect(
      campaignMatchesBehaviorTargeting(
        { enabled: true, segments: ["RETURNING_VISITOR"] },
        profile,
      ),
    ).toBe(true);
    // Requiring more prior sessions than observed excludes the visitor.
    expect(
      campaignMatchesBehaviorTargeting(
        {
          enabled: true,
          segments: ["RETURNING_VISITOR"],
          returningMinPriorSessions: 2,
        },
        profile,
      ),
    ).toBe(false);
  });

  it("detects added-to-cart without checkout and honors the delay", async () => {
    prismaMock.attributionTouch.findMany.mockResolvedValue([
      touch({
        eventType: AnalyticsEventType.ADD_TO_CART,
        occurredAt: new Date("2026-06-18T11:00:00.000Z"),
      }),
    ]);

    const profile = await buildVisitorBehaviorProfile({
      shopId: "shop-1",
      visitorId: "visitor-1",
      sessionId: "session-1",
      settings,
      now,
    });

    expect(profile.latestAddToCartAt).toEqual(
      new Date("2026-06-18T11:00:00.000Z"),
    );
    // 60 minutes elapsed: a 30-minute delay is satisfied, a 120-minute one is not.
    expect(
      campaignMatchesBehaviorTargeting(
        {
          enabled: true,
          segments: ["ADDED_TO_CART_NO_CHECKOUT"],
          addedToCartDelayMinutes: 30,
        },
        profile,
      ),
    ).toBe(true);
    expect(
      campaignMatchesBehaviorTargeting(
        {
          enabled: true,
          segments: ["ADDED_TO_CART_NO_CHECKOUT"],
          addedToCartDelayMinutes: 120,
        },
        profile,
      ),
    ).toBe(false);
  });

  it("counts high intent events within the configured window", async () => {
    prismaMock.attributionTouch.findMany.mockResolvedValue([
      touch({
        eventType: AnalyticsEventType.PRODUCT_VIEWED,
        occurredAt: new Date("2026-06-18T11:50:00.000Z"),
      }),
      touch({
        eventType: AnalyticsEventType.ADD_TO_CART,
        occurredAt: new Date("2026-06-18T11:55:00.000Z"),
      }),
      touch({
        eventType: AnalyticsEventType.PRODUCT_VIEWED,
        occurredAt: new Date("2026-06-18T09:00:00.000Z"),
      }),
    ]);

    const profile = await buildVisitorBehaviorProfile({
      shopId: "shop-1",
      visitorId: "visitor-1",
      sessionId: "session-1",
      settings,
      now,
    });

    // 2 events in the last 15 minutes, 3 within 4 hours.
    expect(
      campaignMatchesBehaviorTargeting(
        {
          enabled: true,
          segments: ["HIGH_INTENT"],
          highIntentMinEvents: 2,
          highIntentWindowMinutes: 15,
        },
        profile,
      ),
    ).toBe(true);
    expect(
      campaignMatchesBehaviorTargeting(
        {
          enabled: true,
          segments: ["HIGH_INTENT"],
          highIntentMinEvents: 3,
          highIntentWindowMinutes: 15,
        },
        profile,
      ),
    ).toBe(false);
  });

  it("matches clicked campaign targeting by campaign id", async () => {
    prismaMock.attributionTouch.findMany.mockResolvedValue([
      touch({
        campaignId: "campaign-clicked",
        eventType: AnalyticsEventType.CLICK,
      }),
    ]);

    const profile = await buildVisitorBehaviorProfile({
      shopId: "shop-1",
      visitorId: "visitor-1",
      sessionId: "session-1",
      settings,
      now,
    });

    expect(profile.clickedCampaignIds).toEqual(["campaign-clicked"]);
    expect(
      campaignMatchesBehaviorTargeting(
        {
          enabled: true,
          segments: ["CLICKED_CAMPAIGN"],
          clickedCampaignIds: ["campaign-clicked"],
        },
        profile,
      ),
    ).toBe(true);
    // Legacy shared campaignIds still seed the per-segment list.
    expect(
      campaignMatchesBehaviorTargeting(
        {
          enabled: true,
          segments: ["CLICKED_CAMPAIGN"],
          campaignIds: ["campaign-clicked"],
        },
        profile,
      ),
    ).toBe(true);
  });

  it("does not segment when analytics or consent settings block behavior use", async () => {
    const profile = await buildVisitorBehaviorProfile({
      shopId: "shop-1",
      visitorId: "visitor-1",
      sessionId: "session-1",
      settings: {
        analyticsEnabled: true,
        consentMode: "STRICT",
        respectDoNotTrack: true,
      },
      privacy: { consentGranted: false },
      now,
    });

    expect(profile).toMatchObject({
      canUseBehaviorTargeting: false,
      reason: "missing_consent",
    });
    expect(prismaMock.attributionTouch.findMany).not.toHaveBeenCalled();
    expect(
      campaignMatchesBehaviorTargeting(
        { enabled: true, segments: ["RETURNING_VISITOR"] },
        profile,
      ),
    ).toBe(false);
  });
});

function touch(
  overrides: Partial<{
    campaignId: string;
    eventType: AnalyticsEventType;
    occurredAt: Date;
    sessionId: string | null;
    visitorId: string | null;
  }> = {},
) {
  return {
    id: `touch-${Math.random()}`,
    shopId: "shop-1",
    campaignId: overrides.campaignId ?? "campaign-1",
    experimentId: null,
    variantId: null,
    visitorId: overrides.visitorId ?? "visitor-1",
    sessionId: overrides.sessionId ?? "session-1",
    eventType: overrides.eventType ?? AnalyticsEventType.IMPRESSION,
    placementType: PlacementType.TOP_BAR,
    path: "/products/hat",
    country: "US",
    locale: "en",
    occurredAt:
      overrides.occurredAt ?? new Date("2026-06-18T10:00:00.000Z"),
  };
}
