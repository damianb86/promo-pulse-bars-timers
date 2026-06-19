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
      newVisitor: true,
      returningVisitor: false,
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

    expect(profile.returningVisitor).toBe(true);
    expect(
      campaignMatchesBehaviorTargeting(
        { enabled: true, segments: ["RETURNING_VISITOR"] },
        profile,
      ),
    ).toBe(true);
  });

  it("detects added-to-cart without checkout", async () => {
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

    expect(profile.addedToCartNoCheckout).toBe(true);
    expect(
      campaignMatchesBehaviorTargeting(
        { enabled: true, segments: ["ADDED_TO_CART_NO_CHECKOUT"] },
        profile,
      ),
    ).toBe(true);
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
