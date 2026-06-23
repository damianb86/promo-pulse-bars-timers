import {
  AnalyticsEventType,
  CampaignType,
  PlacementType,
  Prisma,
  type AnalyticsEvent,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildAnalyticsByCampaign,
  buildAnalyticsByDay,
  getImpressionDedupeSince,
  shouldDedupeIncomingEvent,
  summarizeAnalyticsEvents,
  validateAnalyticsEventPayload,
} from "./analytics.server";

describe("analytics endpoint validation", () => {
  it("requires shop, campaignId, and eventType", () => {
    expect(validateAnalyticsEventPayload({})).toEqual({
      ok: false,
      errors: [
        "shop is required.",
        "campaignId is required.",
        "eventType must be a supported analytics event.",
      ],
    });
  });

  it("rejects unsupported event and placement values", () => {
    expect(
      validateAnalyticsEventPayload({
        shop: "example.myshopify.com",
        campaignId: "campaign-1",
        eventType: "OPEN",
        placementType: "HERO",
      }),
    ).toEqual({
      ok: false,
      errors: [
        "eventType must be a supported analytics event.",
        "placementType must be a supported placement.",
      ],
    });
  });

  it("normalizes a valid storefront payload", () => {
    const result = validateAnalyticsEventPayload({
      shop: "https://Example.MyShopify.com/admin",
      campaignId: "campaign-1",
      experimentId: "experiment-1",
      variantId: "variant-1",
      visitorId: "visitor-1",
      eventType: AnalyticsEventType.CLICK,
      placementType: PlacementType.TOP_BAR,
      revenueAmount: 12,
      currencyCode: "usd",
      country: "us",
      locale: "en-US",
      path: "/products/hat",
    });

    expect(result).toEqual({
      ok: true,
      payload: expect.objectContaining({
        shop: "example.myshopify.com",
        campaignId: "campaign-1",
        experimentId: "experiment-1",
        variantId: "variant-1",
        visitorId: "visitor-1",
        eventType: AnalyticsEventType.CLICK,
        placementType: PlacementType.TOP_BAR,
        revenueAmount: "12.00",
        currencyCode: "USD",
        country: "US",
        locale: "en-US",
        path: "/products/hat",
      }),
    });
  });
});

describe("analytics aggregation helpers", () => {
  it("summarizes event counts, CTR, and revenue", () => {
    const summary = summarizeAnalyticsEvents([
      event({ eventType: AnalyticsEventType.IMPRESSION }),
      event({ eventType: AnalyticsEventType.IMPRESSION }),
      event({ eventType: AnalyticsEventType.CLICK }),
      event({ eventType: AnalyticsEventType.COPY_CODE }),
      event({ eventType: AnalyticsEventType.ADD_TO_CART }),
      event({ eventType: AnalyticsEventType.CHECKOUT_STARTED }),
      event({
        eventType: AnalyticsEventType.ORDER_ATTRIBUTED,
        revenueAmount: new Prisma.Decimal("42.50"),
        currencyCode: "USD",
      }),
    ]);

    expect(summary).toMatchObject({
      impressions: 2,
      clicks: 1,
      copyCode: 1,
      addToCart: 1,
      checkoutStarted: 1,
      ordersAttributed: 1,
      revenueAttributed: 42.5,
      currencyCode: "USD",
      ctr: 0.5,
    });
  });

  it("builds day buckets for the selected range", () => {
    const rows = buildAnalyticsByDay(
      [
        event({
          eventType: AnalyticsEventType.IMPRESSION,
          occurredAt: new Date("2026-06-15T12:00:00.000Z"),
        }),
        event({
          eventType: AnalyticsEventType.CLICK,
          occurredAt: new Date("2026-06-16T12:00:00.000Z"),
        }),
      ],
      7,
      new Date("2026-06-16T16:00:00.000Z"),
    );

    expect(rows).toHaveLength(7);
    expect(rows.at(-2)).toMatchObject({
      date: "2026-06-15",
      impressions: 1,
    });
    expect(rows.at(-1)).toMatchObject({
      date: "2026-06-16",
      clicks: 1,
    });
  });

  it("supports 90 day analytics ranges", () => {
    const rows = buildAnalyticsByDay(
      [],
      90,
      new Date("2026-06-16T16:00:00.000Z"),
    );

    expect(rows).toHaveLength(90);
    expect(rows[0]?.date).toBe("2026-03-19");
    expect(rows.at(-1)?.date).toBe("2026-06-16");
  });

  it("groups analytics by campaign", () => {
    const rows = buildAnalyticsByCampaign([
      event({
        campaignId: "campaign-1",
        eventType: AnalyticsEventType.IMPRESSION,
        campaign: {
          id: "campaign-1",
          name: "Flash Sale",
          type: CampaignType.COUNTDOWN_BAR,
        },
      }),
      event({
        campaignId: "campaign-1",
        eventType: AnalyticsEventType.CLICK,
        campaign: {
          id: "campaign-1",
          name: "Flash Sale",
          type: CampaignType.COUNTDOWN_BAR,
        },
      }),
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        campaignId: "campaign-1",
        campaignName: "Flash Sale",
        campaignType: "COUNTDOWN_BAR",
        impressions: 1,
        clicks: 1,
        ctr: 1,
      }),
    ]);
  });
});

describe("analytics impression dedupe", () => {
  it("dedupes impressions with the same campaign session and placement in the window", () => {
    const now = new Date("2026-06-16T12:00:00.000Z");

    expect(
      shouldDedupeIncomingEvent(
        {
          eventType: AnalyticsEventType.IMPRESSION,
          placementType: PlacementType.TOP_BAR,
          sessionId: "session-1",
        },
        { occurredAt: new Date("2026-06-16T11:55:00.000Z") } as AnalyticsEvent,
        now,
      ),
    ).toBe(true);
  });

  it("does not dedupe clicks or impressions outside the window", () => {
    const now = new Date("2026-06-16T12:00:00.000Z");

    expect(
      shouldDedupeIncomingEvent(
        {
          eventType: AnalyticsEventType.CLICK,
          placementType: PlacementType.TOP_BAR,
          sessionId: "session-1",
        },
        { occurredAt: new Date("2026-06-16T11:55:00.000Z") } as AnalyticsEvent,
        now,
      ),
    ).toBe(false);

    expect(
      shouldDedupeIncomingEvent(
        {
          eventType: AnalyticsEventType.IMPRESSION,
          placementType: PlacementType.TOP_BAR,
          sessionId: "session-1",
        },
        { occurredAt: new Date("2026-06-16T11:45:00.000Z") } as AnalyticsEvent,
        now,
      ),
    ).toBe(false);
  });

  it("calculates the dedupe cutoff timestamp", () => {
    expect(
      getImpressionDedupeSince(new Date("2026-06-16T12:00:00.000Z"))
        .toISOString()
        .slice(11, 19),
    ).toBe("11:50:00");
  });
});

function event(
  overrides: Partial<
    Pick<
      AnalyticsEvent,
      | "eventType"
      | "occurredAt"
      | "revenueAmount"
      | "currencyCode"
      | "campaignId"
    >
  > & {
    campaign?: {
      id: string;
      name: string;
      type: CampaignType;
    };
  },
) {
  return {
    eventType: AnalyticsEventType.IMPRESSION,
    occurredAt: new Date("2026-06-16T12:00:00.000Z"),
    revenueAmount: null,
    currencyCode: null,
    campaignId: "campaign-1",
    ...overrides,
  };
}
