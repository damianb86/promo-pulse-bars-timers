import {
  AnalyticsEventType,
  CampaignGoal,
  CampaignRecommendationStatus,
  CampaignRecommendationType,
  CampaignStatus,
  CampaignType,
  PlacementType,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const txMock = vi.hoisted(() => ({
  campaign: {
    create: vi.fn(),
  },
  campaignRecommendation: {
    update: vi.fn(),
  },
  experiment: {
    create: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  analyticsEvent: {
    findMany: vi.fn(),
  },
  campaign: {
    findMany: vi.fn(),
  },
  campaignRecommendation: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
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
  applyRecommendation,
  dismissRecommendation,
  generateRecommendationsForShop,
} from "./recommendations.server";

const now = new Date("2026-06-18T12:00:00.000Z");

describe("recommendations engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((callback) => callback(txMock));
    prismaMock.analyticsEvent.findMany.mockResolvedValue([]);
    prismaMock.campaign.findMany.mockResolvedValue([campaign()]);
    prismaMock.campaignRecommendation.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: `recommendation-${data.payload.ruleKey}`,
        createdAt: now,
        updatedAt: now,
        ...data,
      }),
    );
    prismaMock.campaignRecommendation.findMany.mockResolvedValue([]);
    prismaMock.marketCampaignRule.findMany.mockResolvedValue([]);
    prismaMock.uniqueDiscountCode.findMany.mockResolvedValue([]);
    txMock.campaign.create.mockResolvedValue({ id: "draft-campaign-1" });
    txMock.campaignRecommendation.update.mockResolvedValue({ id: "rec-1" });
    txMock.experiment.create.mockResolvedValue({ id: "experiment-1" });
  });

  it("generates an explainable copy recommendation for high views and low CTR", async () => {
    prismaMock.analyticsEvent.findMany.mockResolvedValue([
      ...events(120, AnalyticsEventType.IMPRESSION),
      ...events(1, AnalyticsEventType.CLICK),
    ]);

    const result = await generateRecommendationsForShop("shop-1", {
      minImpressions: 50,
      now,
    });

    expect(result.created).toHaveLength(2);
    expect(prismaMock.campaignRecommendation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: "campaign-1",
          type: CampaignRecommendationType.MESSAGE,
          title: "Refresh copy for Flash Sale",
          description: expect.stringContaining("120 impressions"),
          impact: expect.stringContaining("headline or CTA"),
          confidence: expect.any(Number),
          payload: expect.objectContaining({
            action: "CREATE_DRAFT_EXPERIMENT",
            fingerprint: "LOW_CTR_COPY:campaign-1",
            ruleKey: "LOW_CTR_COPY",
          }),
          status: CampaignRecommendationStatus.NEW,
        }),
      }),
    );
  });

  it("does not create duplicate recommendations for an existing fingerprint", async () => {
    prismaMock.analyticsEvent.findMany.mockResolvedValue([
      ...events(100, AnalyticsEventType.IMPRESSION),
    ]);
    prismaMock.campaignRecommendation.findMany.mockResolvedValue([
      {
        payload: {
          action: "CREATE_DRAFT_EXPERIMENT",
          fingerprint: "LOW_CTR_COPY:campaign-1",
          ruleKey: "LOW_CTR_COPY",
        },
      },
      {
        payload: {
          action: "CREATE_DRAFT_EXPERIMENT",
          fingerprint: "LOW_PERFORMANCE_AB_TEST:campaign-1",
          ruleKey: "LOW_PERFORMANCE_AB_TEST",
        },
      },
    ]);

    const result = await generateRecommendationsForShop("shop-1", {
      minImpressions: 50,
      now,
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.created).toHaveLength(0);
    expect(prismaMock.campaignRecommendation.create).not.toHaveBeenCalled();
  });

  it("recommends scaling a proven campaign into the cart drawer", async () => {
    prismaMock.analyticsEvent.findMany.mockResolvedValue([
      ...events(120, AnalyticsEventType.IMPRESSION),
      ...events(14, AnalyticsEventType.CLICK),
      ...attributedOrders(6),
    ]);

    const result = await generateRecommendationsForShop("shop-1", {
      countryMinVisitors: 1000,
      minImpressions: 50,
      now,
    });

    expect(result.created).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campaignId: "campaign-1",
          type: CampaignRecommendationType.PLACEMENT,
          title: "Extend Flash Sale into the cart drawer",
          payload: expect.objectContaining({
            action: "CREATE_DRAFT_CAMPAIGN",
            fingerprint: "SCALE_WINNING_PLACEMENT:campaign-1",
            ruleKey: "SCALE_WINNING_PLACEMENT",
            evidence: expect.arrayContaining([
              expect.objectContaining({ label: "CTR" }),
              expect.objectContaining({ label: "Conversion" }),
            ]),
            campaign: expect.objectContaining({
              placementType: PlacementType.CART_DRAWER,
              timerDurationMinutes: 120,
            }),
          }),
        }),
      ]),
    );
  });

  it("recommends a cart rescue campaign when cart intent has no cart placement", async () => {
    prismaMock.analyticsEvent.findMany.mockResolvedValue([
      ...shopEvents(36, AnalyticsEventType.ADD_TO_CART),
      ...shopEvents(12, AnalyticsEventType.CHECKOUT_STARTED),
    ]);

    const result = await generateRecommendationsForShop("shop-1", {
      minCartIntentEvents: 20,
      now,
    });

    expect(result.created).toEqual([
      expect.objectContaining({
        campaignId: null,
        type: CampaignRecommendationType.TIMING,
        title: "Add a cart rescue reminder",
        payload: expect.objectContaining({
          action: "CREATE_DRAFT_CAMPAIGN",
          fingerprint: "CART_INTENT_NO_CART_CAMPAIGN:US",
          ruleKey: "CART_INTENT_NO_CART_CAMPAIGN",
          campaign: expect.objectContaining({
            placementType: PlacementType.CART_DRAWER,
            type: CampaignType.CART_TIMER,
          }),
        }),
      }),
    ]);
  });

  it("dismisses a recommendation for the current shop", async () => {
    prismaMock.campaignRecommendation.findFirst.mockResolvedValue({
      id: "rec-1",
      shopId: "shop-1",
      payload: {},
    });
    prismaMock.campaignRecommendation.update.mockResolvedValue({ id: "rec-1" });

    await dismissRecommendation("shop-1", "rec-1");

    expect(prismaMock.campaignRecommendation.update).toHaveBeenCalledWith({
      where: { id: "rec-1" },
      data: { status: CampaignRecommendationStatus.DISMISSED },
    });
  });

  it("applies a recommendation by creating a draft campaign", async () => {
    prismaMock.campaignRecommendation.findFirst.mockResolvedValue({
      id: "rec-1",
      shopId: "shop-1",
      payload: {
        action: "CREATE_DRAFT_CAMPAIGN",
        fingerprint: "PRODUCT_TRAFFIC_NO_CAMPAIGN:/products/hat",
        ruleKey: "PRODUCT_TRAFFIC_NO_CAMPAIGN",
        metrics: { productViews: 100 },
        campaign: {
          name: "Product promotion for hat",
          type: CampaignType.PRODUCT_TIMER,
          goal: CampaignGoal.FLASH_SALE,
          placementType: PlacementType.PRODUCT_PAGE,
          headline: "Limited-time product offer",
          subheadline: "Show a verified product promotion.",
          ctaText: "View offer",
          ctaUrl: "/products/hat",
          productPath: "/products/hat",
        },
      },
    });

    await expect(applyRecommendation("shop-1", "rec-1")).resolves.toEqual({
      kind: "campaign",
      id: "draft-campaign-1",
    });

    expect(txMock.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Product promotion for hat",
          shopId: "shop-1",
          status: CampaignStatus.DRAFT,
          type: CampaignType.PRODUCT_TIMER,
          placements: {
            create: [
              { placementType: PlacementType.PRODUCT_PAGE, enabled: true },
            ],
          },
          targeting: expect.objectContaining({
            create: expect.objectContaining({
              urlContains: ["/products/hat"],
            }),
          }),
        }),
      }),
    );
    expect(txMock.campaignRecommendation.update).toHaveBeenCalledWith({
      where: { id: "rec-1" },
      data: { status: CampaignRecommendationStatus.APPLIED },
    });
  });
});

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "campaign-1",
    shopId: "shop-1",
    name: "Flash Sale",
    status: CampaignStatus.ACTIVE,
    type: CampaignType.COUNTDOWN_BAR,
    goal: CampaignGoal.FLASH_SALE,
    startsAt: null,
    endsAt: null,
    timezone: "UTC",
    priority: 0,
    createdAt: now,
    updatedAt: now,
    placements: [{ placementType: PlacementType.TOP_BAR, enabled: true }],
    freeShippingSettings: null,
    ...overrides,
  };
}

function events(count: number, eventType: AnalyticsEventType) {
  return Array.from({ length: count }, (_, index) => ({
    id: `event-${eventType}-${index}`,
    shopId: "shop-1",
    campaignId: "campaign-1",
    eventType,
    placementType: PlacementType.TOP_BAR,
    sessionId: `session-${index}`,
    cartToken: null,
    orderId: null,
    revenueAmount: null,
    currencyCode: "USD",
    country: "US",
    locale: "en",
    path: "/",
    userAgent: "Mozilla/5.0",
    occurredAt: now,
    campaign: {
      id: "campaign-1",
      name: "Flash Sale",
      type: CampaignType.COUNTDOWN_BAR,
    },
  }));
}

function attributedOrders(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `event-order-${index}`,
    shopId: "shop-1",
    campaignId: "campaign-1",
    eventType: AnalyticsEventType.ORDER_ATTRIBUTED,
    placementType: PlacementType.TOP_BAR,
    sessionId: `session-order-${index}`,
    cartToken: null,
    orderId: `order-${index}`,
    revenueAmount: 100,
    currencyCode: "USD",
    country: "US",
    locale: "en",
    path: "/",
    userAgent: "Mozilla/5.0",
    occurredAt: now,
    campaign: {
      id: "campaign-1",
      name: "Flash Sale",
      type: CampaignType.COUNTDOWN_BAR,
    },
  }));
}

function shopEvents(count: number, eventType: AnalyticsEventType) {
  return Array.from({ length: count }, (_, index) => ({
    id: `event-shop-${eventType}-${index}`,
    shopId: "shop-1",
    campaignId: null,
    eventType,
    placementType: null,
    sessionId: `shop-session-${eventType}-${index}`,
    cartToken: null,
    orderId: null,
    revenueAmount: null,
    currencyCode: "USD",
    country: "US",
    locale: "en",
    path: "/cart",
    userAgent: "Mozilla/5.0",
    occurredAt: now,
    campaign: null,
  }));
}
