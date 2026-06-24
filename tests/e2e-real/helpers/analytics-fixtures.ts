import {
  AnalyticsEventType,
  AttributionModel,
  CampaignRecommendationStatus,
  CampaignRecommendationType,
  PlacementType,
  Prisma,
  UniqueDiscountCodeStatus,
} from "@prisma/client";

import prisma from "../../../app/db.server";

type AnalyticsSeedInput = {
  campaignId: string;
  country?: string;
  currencyCode?: string;
  experimentId?: string;
  impressionCount?: number;
  clickCount?: number;
  orderCount?: number;
  path?: string;
  placement?: PlacementType;
  revenueAmount?: number;
  shopId: string;
  variantId?: string;
};

export async function seedAnalyticsForCampaign(input: AnalyticsSeedInput) {
  const now = new Date();
  const country = input.country ?? "US";
  const currencyCode = input.currencyCode ?? "USD";
  const path = input.path ?? "/";
  const placementType = input.placement ?? PlacementType.TOP_BAR;
  const impressionCount = input.impressionCount ?? 24;
  const clickCount = input.clickCount ?? 6;
  const orderCount = input.orderCount ?? 1;
  const revenueAmount = input.revenueAmount ?? 42;

  await prisma.analyticsEvent.createMany({
    data: [
      ...Array.from({ length: impressionCount }, (_, index) =>
        analyticsEventRow({
          campaignId: input.campaignId,
          country,
          currencyCode,
          eventType: AnalyticsEventType.IMPRESSION,
          index,
          path,
          placementType,
          shopId: input.shopId,
        }),
      ),
      ...Array.from({ length: clickCount }, (_, index) =>
        analyticsEventRow({
          campaignId: input.campaignId,
          country,
          currencyCode,
          eventType: AnalyticsEventType.CLICK,
          index: impressionCount + index,
          path,
          placementType,
          shopId: input.shopId,
        }),
      ),
      ...Array.from({ length: orderCount }, (_, index) =>
        analyticsEventRow({
          campaignId: input.campaignId,
          country,
          currencyCode,
          eventType: AnalyticsEventType.ORDER_ATTRIBUTED,
          index: impressionCount + clickCount + index,
          orderId: `pp-e2e-order-${input.campaignId}-${index}`,
          path,
          placementType,
          revenueAmount,
          shopId: input.shopId,
        }),
      ),
    ],
  });

  if (input.experimentId && input.variantId) {
    await prisma.attributionTouch.createMany({
      data: [
        ...Array.from({ length: impressionCount }, (_, index) => ({
          shopId: input.shopId,
          campaignId: input.campaignId,
          experimentId: input.experimentId,
          variantId: input.variantId,
          visitorId: `pp-e2e-visitor-${input.variantId}-${index}`,
          sessionId: `pp-e2e-session-${input.variantId}-${index}`,
          eventType: AnalyticsEventType.IMPRESSION,
          placementType,
          path,
          country,
          locale: "en",
          occurredAt: offsetDate(now, index),
        })),
        ...Array.from({ length: clickCount }, (_, index) => ({
          shopId: input.shopId,
          campaignId: input.campaignId,
          experimentId: input.experimentId,
          variantId: input.variantId,
          visitorId: `pp-e2e-click-visitor-${input.variantId}-${index}`,
          sessionId: `pp-e2e-click-session-${input.variantId}-${index}`,
          eventType: AnalyticsEventType.CLICK,
          placementType,
          path,
          country,
          locale: "en",
          occurredAt: offsetDate(now, impressionCount + index),
        })),
      ],
    });

    await prisma.attributionConversion.createMany({
      data: Array.from({ length: orderCount }, (_, index) => ({
        shopId: input.shopId,
        campaignId: input.campaignId,
        experimentId: input.experimentId,
        variantId: input.variantId,
        visitorId: `pp-e2e-order-visitor-${input.variantId}-${index}`,
        sessionId: `pp-e2e-order-session-${input.variantId}-${index}`,
        orderId: `pp-e2e-order-${input.variantId}-${index}`,
        revenueAmount: new Prisma.Decimal(revenueAmount),
        currencyCode,
        attributionModel: AttributionModel.LAST_CLICK,
        occurredAt: offsetDate(now, impressionCount + clickCount + index),
      })),
    });
  }
}

export async function seedUniqueCodeUsageScenario(input: {
  assigned: number;
  campaignId: string;
  prefix: string;
  shopId: string;
  used: number;
}) {
  const now = new Date();

  await prisma.uniqueDiscountCode.createMany({
    data: Array.from({ length: input.assigned }, (_, index) => ({
      shopId: input.shopId,
      campaignId: input.campaignId,
      code: `${input.prefix}-${String(index + 1).padStart(4, "0")}`,
      status:
        index < input.used
          ? UniqueDiscountCodeStatus.USED
          : UniqueDiscountCodeStatus.ASSIGNED,
      visitorId: `pp-e2e-unique-visitor-${index}`,
      sessionId: `pp-e2e-unique-session-${index}`,
      assignedAt: offsetDate(now, index),
      usedAt: index < input.used ? offsetDate(now, index + 1) : null,
      orderId: index < input.used ? `pp-e2e-unique-order-${index}` : null,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    })),
  });
}

export async function seedActionableRecommendation(input: {
  campaignId: string;
  campaignName: string;
  shopId: string;
}) {
  return prisma.campaignRecommendation.create({
    data: {
      shopId: input.shopId,
      campaignId: input.campaignId,
      type: CampaignRecommendationType.MESSAGE,
      title: `Run an A/B test for ${input.campaignName}`,
      description:
        "Real E2E seeded low CTR and conversion data for a recommendation smoke check.",
      impact:
        "A draft experiment should let the merchant test clearer copy before editing the live campaign.",
      confidence: 0.84,
      status: CampaignRecommendationStatus.NEW,
      payload: {
        action: "CREATE_DRAFT_EXPERIMENT",
        ruleKey: "LOW_PERFORMANCE_AB_TEST",
        fingerprint: `real-e2e-${input.campaignId}`,
        metrics: {
          ctr: 0.01,
          conversionRate: 0,
          impressions: 120,
        },
        experiment: {
          campaignId: input.campaignId,
          name: "Real E2E recommendation experiment",
          primaryMetric: "CLICK_RATE",
          variants: [
            { name: "Current copy", weight: 50, textOverride: {} },
            {
              name: "Clear CTA",
              weight: 50,
              textOverride: {
                headline: "Real E2E recommended copy",
                ctaText: "Shop offer",
              },
            },
          ],
        },
      },
    },
  });
}

function analyticsEventRow(input: {
  campaignId: string;
  country: string;
  currencyCode: string;
  eventType: AnalyticsEventType;
  index: number;
  orderId?: string;
  path: string;
  placementType: PlacementType;
  revenueAmount?: number;
  shopId: string;
}) {
  return {
    shopId: input.shopId,
    campaignId: input.campaignId,
    eventType: input.eventType,
    placementType: input.placementType,
    sessionId: `pp-e2e-session-${input.campaignId}-${input.index}`,
    orderId: input.orderId ?? null,
    revenueAmount:
      input.revenueAmount == null
        ? null
        : new Prisma.Decimal(input.revenueAmount),
    currencyCode: input.currencyCode,
    country: input.country,
    locale: "en",
    path: input.path,
    userAgent:
      input.index % 2 === 0
        ? "Mozilla/5.0 real-e2e desktop"
        : "Mozilla/5.0 real-e2e mobile",
    occurredAt: offsetDate(new Date(), input.index),
  };
}

function offsetDate(now: Date, index: number) {
  return new Date(now.getTime() - (index + 1) * 60_000);
}
