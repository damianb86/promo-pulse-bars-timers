import {
  AnalyticsEventType,
  CampaignStatus,
  PlacementType,
  ShopPlan,
} from "@prisma/client";

import prisma from "../db.server";
import { getOnboardingChecklistStatus } from "../services/onboarding.server";
import { getEffectiveShopPlan } from "../services/planLimits.server";
import type { OnboardingChecklistStatus } from "../types/onboarding";

const demoShopDomain = "counterpulse-demo.myshopify.com";

export type DashboardDataSource = "shop" | "demo" | "empty";

export type DashboardCampaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  type: string;
  placements: PlacementType[];
};

export type DashboardSummary = {
  shopifyDomain: string | null;
  dataSource: DashboardDataSource;
  installationStatus: "connected" | "demo" | "not_configured";
  plan: ShopPlan;
  campaigns: DashboardCampaign[];
  campaignCounts: {
    active: number;
    paused: number;
    drafts: number;
  };
  metrics: {
    impressionsLast7Days: number;
    clicksLast7Days: number;
    revenueAttributedLast7Days: number;
    currencyCode: string;
  };
  onboarding: OnboardingChecklistStatus;
};

export async function getDashboardSummary(
  shopifyDomain: string | null,
): Promise<DashboardSummary> {
  const liveShop = shopifyDomain
    ? await prisma.shop.findUnique({ where: { shopifyDomain } })
    : null;

  const demoShop =
    !liveShop && process.env.NODE_ENV !== "production"
      ? await prisma.shop.findUnique({
          where: { shopifyDomain: demoShopDomain },
        })
      : null;

  const shop = liveShop ?? demoShop;
  const dataSource: DashboardDataSource = liveShop
    ? "shop"
    : demoShop
      ? "demo"
      : "empty";

  if (!shop) {
    return createEmptyDashboardSummary(shopifyDomain);
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);

  const [
    campaigns,
    impressionsLast7Days,
    impressionsAllTime,
    clicksLast7Days,
    revenueAggregate,
  ] = await Promise.all([
    prisma.campaign.findMany({
      where: { shopId: shop.id },
      include: { placements: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),
    prisma.analyticsEvent.count({
      where: {
        shopId: shop.id,
        eventType: AnalyticsEventType.IMPRESSION,
        occurredAt: { gte: since },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        shopId: shop.id,
        eventType: AnalyticsEventType.IMPRESSION,
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        shopId: shop.id,
        eventType: AnalyticsEventType.CLICK,
        occurredAt: { gte: since },
      },
    }),
    prisma.analyticsEvent.aggregate({
      where: {
        shopId: shop.id,
        eventType: AnalyticsEventType.ORDER_ATTRIBUTED,
        occurredAt: { gte: since },
      },
      _sum: { revenueAmount: true },
    }),
  ]);

  const campaignCounts = campaigns.reduce(
    (counts, campaign) => {
      if (campaign.status === CampaignStatus.ACTIVE) counts.active += 1;
      if (campaign.status === CampaignStatus.PAUSED) counts.paused += 1;
      if (campaign.status === CampaignStatus.DRAFT) counts.drafts += 1;
      return counts;
    },
    { active: 0, paused: 0, drafts: 0 },
  );

  const onboarding = await getOnboardingChecklistStatus(shop.id, {
    firstCampaignCreated: campaigns.length > 0,
    firstImpressionReceived: impressionsAllTime > 0,
  });

  return {
    shopifyDomain: shop.shopifyDomain,
    dataSource,
    installationStatus: dataSource === "demo" ? "demo" : "connected",
    plan: getEffectiveShopPlan(shop),
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      type: campaign.type,
      placements: campaign.placements.map(
        (placement) => placement.placementType,
      ),
    })),
    campaignCounts,
    metrics: {
      impressionsLast7Days,
      clicksLast7Days,
      revenueAttributedLast7Days: Number(
        revenueAggregate._sum.revenueAmount ?? 0,
      ),
      currencyCode: "USD",
    },
    onboarding,
  };
}

export function createEmptyDashboardSummary(
  shopifyDomain: string | null,
): DashboardSummary {
  return {
    shopifyDomain,
    dataSource: "empty",
    installationStatus: "not_configured",
    plan: ShopPlan.FREE,
    campaigns: [],
    campaignCounts: {
      active: 0,
      paused: 0,
      drafts: 0,
    },
    metrics: {
      impressionsLast7Days: 0,
      clicksLast7Days: 0,
      revenueAttributedLast7Days: 0,
      currencyCode: "USD",
    },
    onboarding: {
      firstCampaignCreated: false,
      appEmbedEnabled: false,
      productBlockAdded: false,
      cartBlockAdded: false,
      firstImpressionReceived: false,
    },
  };
}
