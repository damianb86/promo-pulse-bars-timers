import {
  AnalyticsEventType,
  CampaignType,
  PlacementType,
  UniqueDiscountCodeStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  analyticsEvent: {
    findMany: vi.fn(),
  },
  attributionConversion: {
    findMany: vi.fn(),
  },
  attributionTouch: {
    findMany: vi.fn(),
  },
  marketCampaignRule: {
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
  buildAdvancedReportsCsv,
  getAdvancedReports,
  getMarketReport,
  getPlacementReport,
  getRevenueReport,
} from "./advancedReports.server";

const range = {
  start: new Date("2026-06-01T00:00:00.000Z"),
  end: new Date("2026-06-07T23:59:59.999Z"),
};

describe("advanced reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.analyticsEvent.findMany.mockResolvedValue([]);
    prismaMock.attributionConversion.findMany.mockResolvedValue([]);
    prismaMock.attributionTouch.findMany.mockResolvedValue([]);
    prismaMock.marketCampaignRule.findMany.mockResolvedValue([]);
    prismaMock.uniqueDiscountCode.findMany.mockResolvedValue([]);
  });

  it("aggregates revenue metrics by date range without double-counting attributed orders", async () => {
    prismaMock.analyticsEvent.findMany.mockResolvedValue([
      analyticsEvent({
        eventType: AnalyticsEventType.IMPRESSION,
        sessionId: "s1",
      }),
      analyticsEvent({
        eventType: AnalyticsEventType.IMPRESSION,
        sessionId: "s2",
      }),
      analyticsEvent({ eventType: AnalyticsEventType.CLICK, sessionId: "s1" }),
      analyticsEvent({
        eventType: AnalyticsEventType.ADD_TO_CART,
        sessionId: "s1",
      }),
      analyticsEvent({
        eventType: AnalyticsEventType.CHECKOUT_STARTED,
        sessionId: "s1",
      }),
      analyticsEvent({
        eventType: AnalyticsEventType.ORDER_ATTRIBUTED,
        orderId: "order-1",
        revenueAmount: "100",
        sessionId: "s1",
      }),
    ]);
    prismaMock.attributionConversion.findMany.mockResolvedValue([
      conversion({ orderId: "order-1", revenueAmount: "125" }),
    ]);

    const report = await getRevenueReport("shop-1", range);

    expect(prismaMock.analyticsEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          occurredAt: { gte: range.start, lte: range.end },
        }),
      }),
    );
    expect(report.summary).toMatchObject({
      impressions: 2,
      clicks: 1,
      orders: 1,
      revenue: 125,
      visitors: 2,
    });
    expect(report.summary.ctr).toBe(0.5);
    expect(report.summary.addToCartRate).toBe(0.5);
    expect(report.summary.checkoutStartedRate).toBe(0.5);
    expect(report.summary.revenuePerVisitor).toBe(62.5);
    expect(report.summary.averageOrderValue).toBe(125);
  });

  it("passes campaign and country filters to report queries", async () => {
    await getPlacementReport("shop-1", {
      ...range,
      campaignId: "campaign-b",
      country: "CA",
      placement: PlacementType.CART_DRAWER,
    });

    expect(prismaMock.analyticsEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaignId: "campaign-b",
          country: "CA",
          placementType: PlacementType.CART_DRAWER,
        }),
      }),
    );
  });

  it("aggregates by country and market with market-rule fallback", async () => {
    prismaMock.analyticsEvent.findMany.mockResolvedValue([
      analyticsEvent({
        campaignId: "campaign-1",
        country: "CA",
        eventType: AnalyticsEventType.IMPRESSION,
        locale: "en",
      }),
      analyticsEvent({
        campaignId: "campaign-1",
        country: "US",
        eventType: AnalyticsEventType.IMPRESSION,
        locale: "en",
      }),
    ]);
    prismaMock.marketCampaignRule.findMany.mockResolvedValue([
      {
        campaignId: "campaign-1",
        countryCode: "CA",
        locale: "en",
        marketId: "gid://shopify/Market/canada",
      },
    ]);

    const report = await getMarketReport("shop-1", range);

    expect(report.byCountry.map((row) => row.label)).toEqual(["CA", "US"]);
    expect(report.byMarket.map((row) => row.label)).toContain(
      "gid://shopify/Market/canada",
    );
  });

  it("attributes conversion revenue to market dimensions through matching touches", async () => {
    prismaMock.analyticsEvent.findMany.mockResolvedValue([
      analyticsEvent({
        campaignId: "campaign-1",
        country: "CA",
        eventType: AnalyticsEventType.IMPRESSION,
        locale: "en-CA",
      }),
    ]);
    prismaMock.attributionTouch.findMany.mockResolvedValue([
      touch({ country: "CA", locale: "en-CA" }),
    ]);
    prismaMock.attributionConversion.findMany.mockResolvedValue([
      conversion({ orderId: "order-ca", revenueAmount: "300" }),
    ]);
    prismaMock.marketCampaignRule.findMany.mockResolvedValue([
      {
        campaignId: "campaign-1",
        countryCode: "CA",
        locale: "en-CA",
        marketId: "gid://shopify/Market/canada",
      },
    ]);

    const report = await getMarketReport("shop-1", range);

    expect(report.byCountry.find((row) => row.label === "CA")).toMatchObject({
      orders: 1,
      revenue: 300,
    });
    expect(
      report.byMarket.find(
        (row) => row.label === "gid://shopify/Market/canada",
      ),
    ).toMatchObject({
      orders: 1,
      revenue: 300,
    });
  });

  it("exports CSV rows for summary, dimensions, experiments, and codes", async () => {
    prismaMock.analyticsEvent.findMany.mockResolvedValue([
      analyticsEvent({ eventType: AnalyticsEventType.IMPRESSION }),
      analyticsEvent({ eventType: AnalyticsEventType.CLICK }),
    ]);
    prismaMock.attributionTouch.findMany.mockResolvedValue([
      touch({ eventType: AnalyticsEventType.IMPRESSION }),
      touch({ eventType: AnalyticsEventType.CLICK }),
    ]);
    prismaMock.attributionConversion.findMany.mockResolvedValue([
      conversion({ orderId: "order-2", revenueAmount: "240" }),
    ]);
    prismaMock.uniqueDiscountCode.findMany.mockResolvedValue([
      uniqueCode({
        assignedAt: new Date("2026-06-03T12:00:00.000Z"),
        status: UniqueDiscountCodeStatus.ASSIGNED,
      }),
      uniqueCode({
        assignedAt: new Date("2026-06-03T12:00:00.000Z"),
        status: UniqueDiscountCodeStatus.USED,
        usedAt: new Date("2026-06-04T12:00:00.000Z"),
      }),
    ]);

    const report = await getAdvancedReports("shop-1", range);
    const csv = buildAdvancedReportsCsv(report);

    expect(csv).toContain("Summary,All campaigns");
    expect(csv).toContain("Campaign type,Countdown Bar");
    expect(csv).toContain("Experiment variant,Headline Test - Variant A");
    expect(csv).toContain("Unique codes,Flash Sale");
    expect(csv).toContain("240");
  });
});

function analyticsEvent(
  overrides: Partial<{
    campaignId: string;
    country: string | null;
    eventType: AnalyticsEventType;
    locale: string | null;
    orderId: string | null;
    placementType: PlacementType | null;
    revenueAmount: string | null;
    sessionId: string | null;
    userAgent: string | null;
  }> = {},
) {
  return {
    id: `event-${Math.random()}`,
    shopId: "shop-1",
    campaignId: overrides.campaignId ?? "campaign-1",
    eventType: overrides.eventType ?? AnalyticsEventType.IMPRESSION,
    placementType: overrides.placementType ?? PlacementType.TOP_BAR,
    sessionId: overrides.sessionId ?? "session-1",
    cartToken: null,
    orderId: overrides.orderId ?? null,
    revenueAmount: overrides.revenueAmount ?? null,
    currencyCode: "USD",
    country: overrides.country ?? "US",
    locale: overrides.locale ?? "en",
    path: null,
    userAgent: overrides.userAgent ?? "Mozilla/5.0",
    occurredAt: new Date("2026-06-03T12:00:00.000Z"),
    campaign: {
      id: overrides.campaignId ?? "campaign-1",
      name: "Flash Sale",
      type: CampaignType.COUNTDOWN_BAR,
    },
  };
}

function conversion(
  overrides: Partial<{
    campaignId: string;
    orderId: string;
    revenueAmount: string;
    sessionId: string | null;
    visitorId: string | null;
  }> = {},
) {
  return {
    id: `conversion-${overrides.orderId ?? "1"}`,
    shopId: "shop-1",
    campaignId: overrides.campaignId ?? "campaign-1",
    experimentId: "experiment-1",
    variantId: "variant-a",
    visitorId: overrides.visitorId ?? "visitor-1",
    sessionId: overrides.sessionId ?? "session-1",
    orderId: overrides.orderId ?? "order-1",
    revenueAmount: overrides.revenueAmount ?? "125",
    currencyCode: "USD",
    attributionModel: "LAST_TOUCH_7D",
    occurredAt: new Date("2026-06-03T12:30:00.000Z"),
    campaign: {
      id: "campaign-1",
      name: "Flash Sale",
      type: CampaignType.COUNTDOWN_BAR,
    },
    variant: {
      id: "variant-a",
      name: "Variant A",
      experiment: {
        name: "Headline Test",
      },
    },
  };
}

function touch(
  overrides: Partial<{
    campaignId: string;
    country: string | null;
    eventType: AnalyticsEventType;
    locale: string | null;
    occurredAt: Date;
    placementType: PlacementType | null;
    sessionId: string | null;
    visitorId: string | null;
  }> = {},
) {
  return {
    id: `touch-${overrides.eventType ?? "impression"}`,
    shopId: "shop-1",
    campaignId: overrides.campaignId ?? "campaign-1",
    experimentId: "experiment-1",
    variantId: "variant-a",
    visitorId: overrides.visitorId ?? "visitor-1",
    sessionId: overrides.sessionId ?? "session-1",
    eventType: overrides.eventType ?? AnalyticsEventType.IMPRESSION,
    placementType: overrides.placementType ?? PlacementType.TOP_BAR,
    path: "/collections/sale",
    country: overrides.country ?? "US",
    locale: overrides.locale ?? "en",
    occurredAt:
      overrides.occurredAt ?? new Date("2026-06-03T12:00:00.000Z"),
    campaign: {
      id: "campaign-1",
      name: "Flash Sale",
      type: CampaignType.COUNTDOWN_BAR,
    },
    variant: {
      id: "variant-a",
      name: "Variant A",
      experiment: {
        name: "Headline Test",
      },
    },
  };
}

function uniqueCode(
  overrides: Partial<{
    assignedAt: Date | null;
    status: UniqueDiscountCodeStatus;
    usedAt: Date | null;
  }> = {},
) {
  return {
    id: `code-${Math.random()}`,
    shopId: "shop-1",
    campaignId: "campaign-1",
    visitorId: "visitor-1",
    sessionId: "session-1",
    code: "SAVE-1",
    shopifyDiscountId: null,
    status: overrides.status ?? UniqueDiscountCodeStatus.ASSIGNED,
    assignedAt: overrides.assignedAt ?? null,
    expiresAt: null,
    usedAt: overrides.usedAt ?? null,
    orderId: null,
    createdAt: new Date("2026-06-03T12:00:00.000Z"),
    updatedAt: new Date("2026-06-04T12:00:00.000Z"),
    campaign: {
      id: "campaign-1",
      name: "Flash Sale",
    },
  };
}
