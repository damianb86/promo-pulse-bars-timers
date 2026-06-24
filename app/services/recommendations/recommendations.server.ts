import {
  AnalyticsEventType,
  CampaignGoal,
  CampaignRecommendationStatus,
  CampaignRecommendationType,
  CampaignStatus,
  CampaignType,
  CartRescueReason,
  ExperimentPrimaryMetric,
  ExperimentStatus,
  ExperimentVariantStatus,
  PlacementType,
  Prisma,
  TimerExpiredBehavior,
  TimerMode,
  TimerResetBehavior,
  UniqueDiscountCodeStatus,
  type AnalyticsEvent,
  type Campaign,
  type CampaignPlacement,
  type CampaignRecommendation,
  type FreeShippingSettings,
} from "@prisma/client";

import prisma from "../../db.server";
import { defaultBadgeSettingsValues } from "../../types/badge";
import { defaultDeliveryCutoffSettingsValues } from "../../types/delivery-cutoff";
import { defaultFreeShippingSettingsValues } from "../../types/free-shipping";
import { buildDefaultCampaignTranslations } from "../../utils/campaign-localization";

export type RecommendationEngineOptions = {
  now?: Date;
  lookbackDays?: number;
  minImpressions?: number;
  highTrafficProductViews?: number;
  lowCtrThreshold?: number;
  strongCtrThreshold?: number;
  lowConversionThreshold?: number;
  uniqueCodeMinAssigned?: number;
  uniqueCodeLowUseRate?: number;
  countryMinVisitors?: number;
  countryConversionRate?: number;
  minCartIntentEvents?: number;
  lowCartConversionThreshold?: number;
};

export type RecommendationActionPayload =
  | {
      action: "CREATE_DRAFT_CAMPAIGN";
      campaign: DraftCampaignPayload;
    }
  | {
      action: "CREATE_DRAFT_EXPERIMENT";
      experiment: DraftExperimentPayload;
    };

export type RecommendationPayload = RecommendationActionPayload & {
  ruleKey: RecommendationRuleKey;
  fingerprint: string;
  metrics: Record<string, number | string | null>;
  evidence?: RecommendationEvidence[];
  insight?: string;
  recommendedAction?: string;
};

type RecommendationRuleKey =
  | "LOW_CTR_COPY"
  | "FREE_SHIPPING_THRESHOLD"
  | "DELIVERY_CUTOFF_PRODUCT_PAGE"
  | "LOW_PERFORMANCE_AB_TEST"
  | "PRODUCT_TRAFFIC_NO_CAMPAIGN"
  | "MARKET_LOCALIZATION"
  | "UNIQUE_CODES_LOW_USE"
  | "CART_INTENT_NO_CART_CAMPAIGN"
  | "SCALE_WINNING_PLACEMENT";

type RecommendationEvidence = {
  label: string;
  value: string;
  detail?: string;
};

type DraftCampaignPayload = {
  name: string;
  type: CampaignType;
  goal: CampaignGoal;
  placementType: PlacementType;
  headline: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
  country?: string | null;
  locale?: string | null;
  productPath?: string | null;
  freeShippingThreshold?: string | null;
  currencyCode?: string | null;
  timerDurationMinutes?: number | null;
};

type DraftExperimentPayload = {
  campaignId: string;
  name: string;
  primaryMetric: ExperimentPrimaryMetric;
  variants: Array<{
    name: string;
    weight: number;
    textOverride: {
      headline?: string;
      subheadline?: string;
      ctaText?: string;
    };
  }>;
};

type RecommendationCandidate = {
  campaignId?: string | null;
  type: CampaignRecommendationType;
  title: string;
  description: string;
  impact: string;
  confidence: number;
  payload: RecommendationPayload;
};

type CampaignForRecommendation = Campaign & {
  placements: CampaignPlacement[];
  freeShippingSettings: FreeShippingSettings | null;
};

type EventForRecommendation = Pick<
  AnalyticsEvent,
  | "campaignId"
  | "eventType"
  | "sessionId"
  | "orderId"
  | "revenueAmount"
  | "currencyCode"
  | "country"
  | "locale"
  | "path"
  | "placementType"
  | "occurredAt"
> & {
  campaign: Pick<Campaign, "id" | "name" | "type"> | null;
};

type CampaignMetrics = {
  campaign: CampaignForRecommendation;
  impressions: number;
  clicks: number;
  orders: number;
  revenue: number;
  ctr: number;
  conversionRate: number;
  averageOrderValue: number;
  currencyCode: string;
  placementBreakdown: Array<{
    placementType: PlacementType | "UNKNOWN";
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  visitors: number;
};

const defaultOptions = {
  lookbackDays: 30,
  minImpressions: 100,
  highTrafficProductViews: 75,
  lowCtrThreshold: 0.02,
  strongCtrThreshold: 0.08,
  lowConversionThreshold: 0.01,
  uniqueCodeMinAssigned: 20,
  uniqueCodeLowUseRate: 0.08,
  countryMinVisitors: 50,
  countryConversionRate: 0.04,
  minCartIntentEvents: 30,
  lowCartConversionThreshold: 0.06,
} satisfies Required<Omit<RecommendationEngineOptions, "now">>;

const impressionEvents = new Set<AnalyticsEventType>([
  AnalyticsEventType.IMPRESSION,
  AnalyticsEventType.BADGE_IMPRESSION,
]);

const clickEvents = new Set<AnalyticsEventType>([
  AnalyticsEventType.CLICK,
  AnalyticsEventType.BADGE_CLICK,
]);

export async function generateRecommendationsForShop(
  shopId: string,
  options: RecommendationEngineOptions = {},
) {
  const resolvedOptions = { ...defaultOptions, ...options };
  const now = options.now ?? new Date();
  const since = new Date(
    now.getTime() - resolvedOptions.lookbackDays * 24 * 60 * 60 * 1000,
  );
  const [campaigns, events, uniqueCodes, marketRules, existing] =
    await Promise.all([
      loadCampaigns(shopId),
      loadEvents(shopId, since, now),
      loadUniqueCodes(shopId, since, now),
      prisma.marketCampaignRule.findMany({
        where: { shopId },
        select: { countryCode: true, locale: true },
      }),
      prisma.campaignRecommendation.findMany({
        where: { shopId },
        select: { payload: true },
      }),
    ]);
  const existingFingerprints = new Set(
    existing
      .map((recommendation) =>
        readRecommendationPayload(recommendation.payload),
      )
      .map((payload) => payload?.fingerprint)
      .filter(Boolean) as string[],
  );
  const candidates = buildRecommendationCandidates({
    campaigns,
    events,
    marketRules,
    options: resolvedOptions,
    uniqueCodes,
  });
  const created: CampaignRecommendation[] = [];

  for (const candidate of candidates) {
    if (existingFingerprints.has(candidate.payload.fingerprint)) continue;

    const recommendation = await prisma.campaignRecommendation.create({
      data: {
        shopId,
        campaignId: candidate.campaignId ?? null,
        type: candidate.type,
        title: candidate.title,
        description: candidate.description,
        impact: candidate.impact,
        confidence: candidate.confidence,
        status: CampaignRecommendationStatus.NEW,
        payload: candidate.payload as Prisma.InputJsonValue,
      },
    });

    existingFingerprints.add(candidate.payload.fingerprint);
    created.push(recommendation);
  }

  return {
    created,
    candidates,
  };
}

export function listRecommendationsForShop(shopId: string) {
  return prisma.campaignRecommendation.findMany({
    where: {
      shopId,
      status: {
        in: [
          CampaignRecommendationStatus.NEW,
          CampaignRecommendationStatus.VIEWED,
        ],
      },
    },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          placements: {
            where: { enabled: true },
            select: { placementType: true },
          },
          type: true,
        },
      },
    },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
  });
}

export async function dismissRecommendation(shopId: string, id: string) {
  await assertRecommendationBelongsToShop(shopId, id);

  return prisma.campaignRecommendation.update({
    where: { id },
    data: { status: CampaignRecommendationStatus.DISMISSED },
  });
}

export async function applyRecommendation(shopId: string, id: string) {
  const recommendation = await assertRecommendationBelongsToShop(shopId, id);
  const payload = readRecommendationPayload(recommendation.payload);

  if (!payload) {
    throw new RecommendationError("Recommendation payload is invalid.");
  }

  const applied = await prisma.$transaction(async (tx) => {
    if (payload.action === "CREATE_DRAFT_EXPERIMENT") {
      const experiment = await tx.experiment.create({
        data: {
          shopId,
          campaignId: payload.experiment.campaignId,
          name: payload.experiment.name,
          status: ExperimentStatus.DRAFT,
          primaryMetric: payload.experiment.primaryMetric,
          variants: {
            create: payload.experiment.variants.map((variant) => ({
              campaignId: payload.experiment.campaignId,
              name: variant.name,
              weight: variant.weight,
              status: ExperimentVariantStatus.DRAFT,
              textOverride: variant.textOverride,
            })),
          },
        },
      });

      await tx.campaignRecommendation.update({
        where: { id },
        data: { status: CampaignRecommendationStatus.APPLIED },
      });

      return { kind: "experiment" as const, id: experiment.id };
    }

    const campaign = await createDraftCampaignFromPayload(
      tx,
      shopId,
      payload.campaign,
    );

    await tx.campaignRecommendation.update({
      where: { id },
      data: { status: CampaignRecommendationStatus.APPLIED },
    });

    return { kind: "campaign" as const, id: campaign.id };
  });

  return applied;
}

export class RecommendationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecommendationError";
  }
}

function buildRecommendationCandidates({
  campaigns,
  events,
  marketRules,
  options,
  uniqueCodes,
}: {
  campaigns: CampaignForRecommendation[];
  events: EventForRecommendation[];
  marketRules: Array<{ countryCode: string | null; locale: string | null }>;
  options: Required<Omit<RecommendationEngineOptions, "now">>;
  uniqueCodes: Array<{
    campaignId: string;
    status: UniqueDiscountCodeStatus;
    assignedAt: Date | null;
    usedAt: Date | null;
    campaign: { name: string };
  }>;
}) {
  const metrics = buildCampaignMetrics(campaigns, events);

  return [
    ...recommendLowCtrCopy(metrics, options),
    ...recommendFreeShippingThreshold(metrics, options),
    ...recommendDeliveryCutoffPlacement(metrics, options),
    ...recommendAbTests(metrics, options),
    ...recommendPlacementScaleWinners(metrics, options),
    ...recommendProductTraffic(campaigns, events, options),
    ...recommendMarketLocalization(events, marketRules, options),
    ...recommendUniqueCodeChanges(uniqueCodes, options),
    ...recommendCartIntentCampaign(campaigns, events, options),
  ].sort(
    (first, second) =>
      second.confidence - first.confidence ||
      first.title.localeCompare(second.title),
  );
}

function recommendLowCtrCopy(
  metrics: CampaignMetrics[],
  options: Required<Omit<RecommendationEngineOptions, "now">>,
): RecommendationCandidate[] {
  return metrics
    .filter(
      (row) =>
        row.impressions >= options.minImpressions &&
        row.ctr < options.lowCtrThreshold,
    )
    .map((row) => ({
      campaignId: row.campaign.id,
      type: CampaignRecommendationType.MESSAGE,
      title: `Refresh copy for ${row.campaign.name}`,
      description: `${row.campaign.name} has ${row.impressions} impressions and a ${formatPercent(
        row.ctr,
      )} CTR, which is below the ${formatPercent(
        options.lowCtrThreshold,
      )} recommendation threshold.`,
      impact:
        "A clearer headline or CTA can lift click-through rate without changing the offer.",
      confidence: confidenceFromRateGap(
        options.lowCtrThreshold,
        row.ctr,
        row.impressions,
      ),
      payload: {
        action: "CREATE_DRAFT_EXPERIMENT",
        ruleKey: "LOW_CTR_COPY",
        fingerprint: fingerprint("LOW_CTR_COPY", row.campaign.id),
        insight:
          "The campaign is getting enough visibility, but shoppers are not engaging with the message.",
        recommendedAction:
          "Create a draft A/B test with a clearer headline and CTA before changing the live campaign.",
        evidence: [
          evidence("Impressions", formatInteger(row.impressions)),
          evidence("CTR", formatPercent(row.ctr), "Below the copy threshold"),
          evidence("Clicks", formatInteger(row.clicks)),
        ],
        metrics: {
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: row.ctr,
        },
        experiment: {
          campaignId: row.campaign.id,
          name: "Copy and CTA test",
          primaryMetric: ExperimentPrimaryMetric.CLICK_RATE,
          variants: [
            {
              name: "Control",
              weight: 50,
              textOverride: {},
            },
            {
              name: "Clearer CTA",
              weight: 50,
              textOverride: {
                headline: "Limited-time offer ends soon",
                subheadline: "Shop the promotion before it closes.",
                ctaText: "Shop offer",
              },
            },
          ],
        },
      },
    }));
}

function recommendFreeShippingThreshold(
  metrics: CampaignMetrics[],
  options: Required<Omit<RecommendationEngineOptions, "now">>,
): RecommendationCandidate[] {
  return metrics
    .filter(
      (row) =>
        row.campaign.type === CampaignType.FREE_SHIPPING_GOAL &&
        row.impressions >=
          Math.max(20, Math.floor(options.minImpressions / 2)) &&
        row.campaign.freeShippingSettings,
    )
    .flatMap((row) => {
      const settings = row.campaign.freeShippingSettings;
      if (!settings) return [];

      const threshold = Number(settings.thresholdAmount);
      if (!Number.isFinite(threshold) || threshold <= 0) return [];

      const nearThreshold =
        row.averageOrderValue > 0 &&
        row.averageOrderValue >= threshold * 0.75 &&
        row.averageOrderValue <= threshold * 1.15;

      if (!nearThreshold) return [];

      const suggestedThreshold =
        row.averageOrderValue < threshold
          ? Math.max(1, Math.round(row.averageOrderValue / 5) * 5)
          : Math.round((threshold * 1.1) / 5) * 5;
      const direction = suggestedThreshold < threshold ? "lowering" : "raising";

      return [
        {
          campaignId: row.campaign.id,
          type: CampaignRecommendationType.DISCOUNT_VALUE,
          title: `Review free-shipping threshold for ${row.campaign.name}`,
          description: `Average attributed order value is ${formatCurrency(
            row.averageOrderValue,
            row.currencyCode,
          )}, close to the current ${formatCurrency(
            threshold,
            settings.currencyCode,
          )} threshold. Consider ${direction} the threshold to ${formatCurrency(
            suggestedThreshold,
            settings.currencyCode,
          )}.`,
          impact:
            "A threshold closer to buying behavior can improve conversion while keeping margin visible.",
          confidence: clampConfidence(0.58 + row.conversionRate),
          payload: {
            action: "CREATE_DRAFT_CAMPAIGN",
            ruleKey: "FREE_SHIPPING_THRESHOLD",
            fingerprint: fingerprint(
              "FREE_SHIPPING_THRESHOLD",
              row.campaign.id,
            ),
            insight:
              "Attributed order value is close enough to the current threshold that a small adjustment is testable.",
            recommendedAction:
              "Create a draft cart-drawer free-shipping goal with the suggested threshold.",
            evidence: [
              evidence(
                "Current threshold",
                formatCurrency(threshold, settings.currencyCode),
              ),
              evidence(
                "Attributed AOV",
                formatCurrency(row.averageOrderValue, row.currencyCode),
              ),
              evidence(
                "Suggested threshold",
                formatCurrency(suggestedThreshold, settings.currencyCode),
              ),
            ],
            metrics: {
              threshold,
              suggestedThreshold,
              averageOrderValue: row.averageOrderValue,
            },
            campaign: {
              name: `${row.campaign.name} threshold test`,
              type: CampaignType.FREE_SHIPPING_GOAL,
              goal: CampaignGoal.FREE_SHIPPING,
              placementType: PlacementType.CART_DRAWER,
              headline: "You are close to free shipping",
              subheadline: "Add a little more to unlock delivery on us.",
              ctaText: "Continue shopping",
              ctaUrl: "/collections/all",
              freeShippingThreshold: String(suggestedThreshold),
              currencyCode: settings.currencyCode,
            },
          },
        },
      ];
    });
}

function recommendDeliveryCutoffPlacement(
  metrics: CampaignMetrics[],
  options: Required<Omit<RecommendationEngineOptions, "now">>,
): RecommendationCandidate[] {
  return metrics
    .filter(
      (row) =>
        row.campaign.type === CampaignType.DELIVERY_CUTOFF &&
        row.impressions >=
          Math.max(20, Math.floor(options.minImpressions / 2)) &&
        row.ctr >= options.strongCtrThreshold &&
        !row.campaign.placements.some(
          (placement) => placement.placementType === PlacementType.PRODUCT_PAGE,
        ),
    )
    .map((row) => ({
      campaignId: row.campaign.id,
      type: CampaignRecommendationType.PLACEMENT,
      title: `Show ${row.campaign.name} on product pages`,
      description: `${row.campaign.name} has a ${formatPercent(
        row.ctr,
      )} CTR, above the ${formatPercent(
        options.strongCtrThreshold,
      )} strong-engagement threshold, but it is not placed on product pages.`,
      impact:
        "Moving the delivery promise closer to the product decision can increase urgency without touching checkout.",
      confidence: clampConfidence(0.62 + row.ctr),
      payload: {
        action: "CREATE_DRAFT_CAMPAIGN",
        ruleKey: "DELIVERY_CUTOFF_PRODUCT_PAGE",
        fingerprint: fingerprint(
          "DELIVERY_CUTOFF_PRODUCT_PAGE",
          row.campaign.id,
        ),
        insight:
          "The delivery promise is earning clicks, but it is not shown at the product decision point.",
        recommendedAction:
          "Create a product-page draft so the delivery cutoff is visible before shoppers add to cart.",
        evidence: [
          evidence(
            "CTR",
            formatPercent(row.ctr),
            "Above the strong-engagement threshold",
          ),
          evidence("Impressions", formatInteger(row.impressions)),
          evidence("Current placement", placementList(row.campaign.placements)),
        ],
        metrics: {
          ctr: row.ctr,
          impressions: row.impressions,
        },
        campaign: {
          name: `${row.campaign.name} product-page draft`,
          type: CampaignType.DELIVERY_CUTOFF,
          goal: CampaignGoal.DELIVERY_CUTOFF,
          placementType: PlacementType.PRODUCT_PAGE,
          headline: "Order before the delivery cutoff",
          subheadline: "Show a shipping promise on product pages.",
          ctaText: "View details",
          ctaUrl: "/collections/all",
        },
      },
    }));
}

function recommendAbTests(
  metrics: CampaignMetrics[],
  options: Required<Omit<RecommendationEngineOptions, "now">>,
): RecommendationCandidate[] {
  return metrics
    .filter(
      (row) =>
        row.impressions >= options.minImpressions &&
        row.ctr < options.lowCtrThreshold &&
        row.conversionRate <= options.lowConversionThreshold,
    )
    .map((row) => ({
      campaignId: row.campaign.id,
      type: CampaignRecommendationType.MESSAGE,
      title: `Run an A/B test for ${row.campaign.name}`,
      description: `${row.campaign.name} has low CTR (${formatPercent(
        row.ctr,
      )}) and low conversion (${formatPercent(
        row.conversionRate,
      )}) over the analysis window.`,
      impact:
        "A conservative A/B test lets you compare copy and CTA changes before changing the base campaign.",
      confidence: clampConfidence(0.65 + (1 - row.ctr) * 0.1),
      payload: {
        action: "CREATE_DRAFT_EXPERIMENT",
        ruleKey: "LOW_PERFORMANCE_AB_TEST",
        fingerprint: fingerprint("LOW_PERFORMANCE_AB_TEST", row.campaign.id),
        insight:
          "Both click-through and conversion are weak, so a controlled copy test is safer than directly editing the campaign.",
        recommendedAction:
          "Create a draft experiment and compare the current copy against an urgency-focused treatment.",
        evidence: [
          evidence(
            "CTR",
            formatPercent(row.ctr),
            "Below the engagement threshold",
          ),
          evidence(
            "Conversion",
            formatPercent(row.conversionRate),
            "Below the conversion threshold",
          ),
          evidence("Impressions", formatInteger(row.impressions)),
        ],
        metrics: {
          ctr: row.ctr,
          conversionRate: row.conversionRate,
          impressions: row.impressions,
        },
        experiment: {
          campaignId: row.campaign.id,
          name: "Recommendation A/B test",
          primaryMetric: ExperimentPrimaryMetric.CLICK_RATE,
          variants: [
            {
              name: "Current copy",
              weight: 50,
              textOverride: {},
            },
            {
              name: "Urgency copy",
              weight: 50,
              textOverride: {
                headline: "Offer ends soon",
                subheadline: "Shop now while the promotion is active.",
                ctaText: "Shop now",
              },
            },
          ],
        },
      },
    }));
}

function recommendPlacementScaleWinners(
  metrics: CampaignMetrics[],
  options: Required<Omit<RecommendationEngineOptions, "now">>,
): RecommendationCandidate[] {
  return metrics
    .filter(
      (row) =>
        row.impressions >= options.minImpressions &&
        row.ctr >= options.strongCtrThreshold &&
        row.conversionRate >= options.countryConversionRate &&
        row.orders >= 2 &&
        isCampaignTypePortableToCart(row.campaign.type) &&
        !row.campaign.placements.some(
          (placement) => placement.placementType === PlacementType.CART_DRAWER,
        ),
    )
    .map((row) => {
      const bestPlacement =
        [...row.placementBreakdown]
          .filter((placement) => placement.impressions >= 20)
          .sort(
            (first, second) =>
              second.ctr - first.ctr || second.impressions - first.impressions,
          )[0] ?? null;

      return {
        campaignId: row.campaign.id,
        type: CampaignRecommendationType.PLACEMENT,
        title: `Extend ${row.campaign.name} into the cart drawer`,
        description: `${row.campaign.name} has a ${formatPercent(
          row.ctr,
        )} CTR and a ${formatPercent(
          row.conversionRate,
        )} conversion rate, but it does not currently appear in the cart drawer.`,
        impact:
          "Scaling a proven message into cart intent can keep the offer visible when shoppers are closer to checkout.",
        confidence: clampConfidence(0.64 + row.ctr + row.conversionRate),
        payload: {
          action: "CREATE_DRAFT_CAMPAIGN" as const,
          ruleKey: "SCALE_WINNING_PLACEMENT" as const,
          fingerprint: fingerprint("SCALE_WINNING_PLACEMENT", row.campaign.id),
          insight:
            "This is a scaling recommendation: the campaign is already performing, and the missing surface is closer to checkout intent.",
          recommendedAction:
            "Create a cart-drawer draft that reuses the campaign goal with checkout-focused copy.",
          evidence: [
            evidence(
              "CTR",
              formatPercent(row.ctr),
              "Above the strong-engagement threshold",
            ),
            evidence("Conversion", formatPercent(row.conversionRate)),
            evidence(
              "Best placement",
              bestPlacement
                ? formatPlacement(bestPlacement.placementType)
                : "Mixed",
              bestPlacement
                ? `${formatPercent(bestPlacement.ctr)} CTR on ${formatInteger(
                    bestPlacement.impressions,
                  )} impressions`
                : undefined,
            ),
          ],
          metrics: {
            ctr: row.ctr,
            conversionRate: row.conversionRate,
            impressions: row.impressions,
            orders: row.orders,
          },
          campaign: {
            name: `${row.campaign.name} cart-drawer draft`,
            type: row.campaign.type,
            goal: row.campaign.goal,
            placementType: PlacementType.CART_DRAWER,
            headline: "Your offer is still available",
            subheadline:
              "Keep the promotion visible while shoppers review the cart.",
            ctaText: "Review offer",
            ctaUrl: "/cart",
            timerDurationMinutes: 120,
          },
        },
      };
    });
}

function recommendProductTraffic(
  campaigns: CampaignForRecommendation[],
  events: EventForRecommendation[],
  options: Required<Omit<RecommendationEngineOptions, "now">>,
): RecommendationCandidate[] {
  const productViewsByPath = new Map<string, EventForRecommendation[]>();

  for (const event of events) {
    if (event.eventType !== AnalyticsEventType.PRODUCT_VIEWED || !event.path) {
      continue;
    }

    if (!event.path.includes("/products/")) continue;

    productViewsByPath.set(event.path, [
      ...(productViewsByPath.get(event.path) ?? []),
      event,
    ]);
  }

  return Array.from(productViewsByPath.entries())
    .filter(([, rows]) => rows.length >= options.highTrafficProductViews)
    .filter(([path]) => !hasProductCampaignForPath(campaigns, path))
    .map(([path, rows]) => {
      const relatedRows = events.filter((event) => event.path === path);
      const addToCarts = countEvents(
        relatedRows,
        AnalyticsEventType.ADD_TO_CART,
      );
      const checkouts = countEvents(
        relatedRows,
        AnalyticsEventType.CHECKOUT_STARTED,
      );
      const orders = countUniqueOrders(relatedRows);
      const topCountry = mostCommon(
        relatedRows.map((event) => event.country).filter(Boolean) as string[],
      );
      const productViews = rows.length;
      const addToCartRate = safeRate(addToCarts, productViews);

      return {
        type: CampaignRecommendationType.CAMPAIGN_TEMPLATE,
        title: `Launch a product-page offer for ${lastPathSegment(path)}`,
        description: `${path} had ${productViews} product views in the analysis window, but no active product timer or badge campaign targets that product path.`,
        impact:
          "A product-page campaign can focus high-intent traffic using real product interest instead of invented urgency.",
        confidence: clampConfidence(
          0.58 + productViews / 1200 + addToCartRate * 0.2,
        ),
        payload: {
          action: "CREATE_DRAFT_CAMPAIGN",
          ruleKey: "PRODUCT_TRAFFIC_NO_CAMPAIGN",
          fingerprint: fingerprint("PRODUCT_TRAFFIC_NO_CAMPAIGN", path),
          insight:
            "This product has enough recent attention to justify a product-specific draft.",
          recommendedAction:
            "Create a product-page timer draft targeted to this URL, then review copy and offer details before publishing.",
          evidence: [
            evidence("Product views", formatInteger(productViews)),
            evidence("Add-to-cart rate", formatPercent(addToCartRate)),
            evidence(
              "Downstream intent",
              `${formatInteger(addToCarts)} ATC / ${formatInteger(checkouts)} checkout`,
              orders > 0
                ? `${formatInteger(orders)} attributed orders`
                : undefined,
            ),
            ...(topCountry ? [evidence("Top country", topCountry)] : []),
          ],
          metrics: {
            productViews,
            addToCarts,
            addToCartRate,
            checkouts,
            orders,
            productPath: path,
            topCountry,
          },
          campaign: {
            name: `Product promotion for ${lastPathSegment(path)}`,
            type: CampaignType.PRODUCT_TIMER,
            goal: CampaignGoal.FLASH_SALE,
            placementType: PlacementType.PRODUCT_PAGE,
            headline: "Product offer available today",
            subheadline:
              "Show a verified promotion to shoppers viewing this item.",
            ctaText: "View offer",
            ctaUrl: path,
            productPath: path,
            country: topCountry,
            timerDurationMinutes: 240,
          },
        },
      };
    });
}

function recommendMarketLocalization(
  events: EventForRecommendation[],
  marketRules: Array<{ countryCode: string | null; locale: string | null }>,
  options: Required<Omit<RecommendationEngineOptions, "now">>,
): RecommendationCandidate[] {
  const rowsByCountry = new Map<string, EventForRecommendation[]>();
  const localizedCountries = new Set(
    marketRules.map((rule) => rule.countryCode).filter(Boolean) as string[],
  );

  for (const event of events) {
    if (!event.country) continue;
    rowsByCountry.set(event.country, [
      ...(rowsByCountry.get(event.country) ?? []),
      event,
    ]);
  }

  return Array.from(rowsByCountry.entries()).flatMap(([country, rows]) => {
    if (localizedCountries.has(country)) return [];

    const visitors = countVisitors(rows);
    const orders = new Set(
      rows
        .filter(
          (event) => event.eventType === AnalyticsEventType.ORDER_ATTRIBUTED,
        )
        .map((event) => event.orderId)
        .filter(Boolean),
    ).size;
    const revenue = rows
      .filter(
        (event) => event.eventType === AnalyticsEventType.ORDER_ATTRIBUTED,
      )
      .reduce((total, event) => total + Number(event.revenueAmount ?? 0), 0);
    const currencyCode =
      rows.find((event) => event.currencyCode)?.currencyCode ?? "USD";
    const locale = mostCommon(
      rows.map((event) => event.locale).filter(Boolean) as string[],
    );
    const conversionRate = safeRate(orders, visitors);

    if (
      visitors < options.countryMinVisitors ||
      conversionRate < options.countryConversionRate
    ) {
      return [];
    }

    return [
      {
        type: CampaignRecommendationType.MARKET_LOCALIZATION,
        title: `Localize a campaign for ${country}`,
        description: `${country} has ${visitors} attributed visitors and a ${formatPercent(
          conversionRate,
        )} conversion rate, above the ${formatPercent(
          options.countryConversionRate,
        )} market recommendation threshold.`,
        impact:
          "Localized copy and thresholds can match a market that is already converting well.",
        confidence: clampConfidence(0.6 + conversionRate),
        payload: {
          action: "CREATE_DRAFT_CAMPAIGN",
          ruleKey: "MARKET_LOCALIZATION",
          fingerprint: fingerprint("MARKET_LOCALIZATION", country),
          insight:
            "This market is already converting without a dedicated market rule, so localization is a low-risk optimization.",
          recommendedAction:
            "Create a localized top-bar draft and review country, locale, copy, and threshold settings.",
          evidence: [
            evidence("Visitors", formatInteger(visitors)),
            evidence("Conversion", formatPercent(conversionRate)),
            evidence(
              "Attributed revenue",
              formatCurrency(revenue, currencyCode),
            ),
            ...(locale ? [evidence("Observed locale", locale)] : []),
          ],
          metrics: {
            country,
            locale,
            visitors,
            conversionRate,
            revenue,
          },
          campaign: {
            name: `${country} localized promotion`,
            type: CampaignType.COUNTDOWN_BAR,
            goal: CampaignGoal.FLASH_SALE,
            placementType: PlacementType.TOP_BAR,
            headline: `Special offer for ${country}`,
            subheadline:
              "Localized campaign draft based on recent conversion data.",
            ctaText: "Shop offer",
            ctaUrl: "/collections/all",
            country,
            locale,
            timerDurationMinutes: 240,
          },
        },
      },
    ];
  });
}

function recommendUniqueCodeChanges(
  uniqueCodes: Array<{
    campaignId: string;
    status: UniqueDiscountCodeStatus;
    assignedAt: Date | null;
    usedAt: Date | null;
    campaign: { name: string };
  }>,
  options: Required<Omit<RecommendationEngineOptions, "now">>,
): RecommendationCandidate[] {
  const rowsByCampaign = new Map<
    string,
    {
      campaignName: string;
      assigned: number;
      used: number;
    }
  >();

  for (const code of uniqueCodes) {
    const row = rowsByCampaign.get(code.campaignId) ?? {
      campaignName: code.campaign.name,
      assigned: 0,
      used: 0,
    };

    if (code.assignedAt) row.assigned += 1;
    if (code.status === UniqueDiscountCodeStatus.USED && code.usedAt) {
      row.used += 1;
    }

    rowsByCampaign.set(code.campaignId, row);
  }

  return Array.from(rowsByCampaign.entries())
    .filter(
      ([, row]) =>
        row.assigned >= options.uniqueCodeMinAssigned &&
        safeRate(row.used, row.assigned) < options.uniqueCodeLowUseRate,
    )
    .map(([campaignId, row]) => {
      const useRate = safeRate(row.used, row.assigned);

      return {
        campaignId,
        type: CampaignRecommendationType.DISCOUNT_VALUE,
        title: `Improve unique-code usage for ${row.campaignName}`,
        description: `${row.used} of ${row.assigned} assigned unique codes were used (${formatPercent(
          useRate,
        )}), below the ${formatPercent(
          options.uniqueCodeLowUseRate,
        )} usage threshold.`,
        impact:
          "A clearer discount value or shorter visitor duration can make unique codes easier to act on.",
        confidence: confidenceFromRateGap(
          options.uniqueCodeLowUseRate,
          useRate,
          row.assigned,
        ),
        payload: {
          action: "CREATE_DRAFT_CAMPAIGN",
          ruleKey: "UNIQUE_CODES_LOW_USE",
          fingerprint: fingerprint("UNIQUE_CODES_LOW_USE", campaignId),
          insight:
            "Codes are being assigned, but too few shoppers complete the action with the code.",
          recommendedAction:
            "Create a draft with clearer private-code copy and a shorter reviewable timer before changing the live offer.",
          evidence: [
            evidence("Assigned codes", formatInteger(row.assigned)),
            evidence("Used codes", formatInteger(row.used)),
            evidence(
              "Use rate",
              formatPercent(useRate),
              "Below the unique-code threshold",
            ),
          ],
          metrics: {
            assigned: row.assigned,
            used: row.used,
            useRate,
          },
          campaign: {
            name: `${row.campaignName} unique-code test`,
            type: CampaignType.COUNTDOWN_BAR,
            goal: CampaignGoal.FLASH_SALE,
            placementType: PlacementType.TOP_BAR,
            headline: "Your private code is ready",
            subheadline:
              "Test clearer copy or duration before changing the live campaign.",
            ctaText: "Shop with code",
            ctaUrl: "/collections/all",
            timerDurationMinutes: 90,
          },
        },
      };
    });
}

function recommendCartIntentCampaign(
  campaigns: CampaignForRecommendation[],
  events: EventForRecommendation[],
  options: Required<Omit<RecommendationEngineOptions, "now">>,
): RecommendationCandidate[] {
  if (hasActiveCartCampaign(campaigns)) return [];

  const intentRows = events.filter(
    (event) =>
      event.eventType === AnalyticsEventType.ADD_TO_CART ||
      event.eventType === AnalyticsEventType.CHECKOUT_STARTED,
  );
  const addToCarts = countEvents(intentRows, AnalyticsEventType.ADD_TO_CART);
  const checkoutStarts = countEvents(
    intentRows,
    AnalyticsEventType.CHECKOUT_STARTED,
  );
  const orders = countUniqueOrders(events);
  const visitors = countVisitors(intentRows);
  const intentEvents = addToCarts + checkoutStarts;
  const conversionRate = safeRate(orders, visitors);

  if (
    intentEvents < options.minCartIntentEvents ||
    visitors < Math.max(10, Math.floor(options.minCartIntentEvents / 2)) ||
    conversionRate > options.lowCartConversionThreshold
  ) {
    return [];
  }

  const topCountry = mostCommon(
    intentRows.map((event) => event.country).filter(Boolean) as string[],
  );

  return [
    {
      type: CampaignRecommendationType.TIMING,
      title: "Add a cart rescue reminder",
      description: `${formatInteger(
        intentEvents,
      )} recent cart-intent events led to a ${formatPercent(
        conversionRate,
      )} attributed conversion rate, and there is no active cart campaign.`,
      impact:
        "A cart-drawer reminder keeps the offer visible at the highest-intent surface without changing product-page messaging.",
      confidence: confidenceFromRateGap(
        options.lowCartConversionThreshold,
        conversionRate,
        intentEvents,
      ),
      payload: {
        action: "CREATE_DRAFT_CAMPAIGN",
        ruleKey: "CART_INTENT_NO_CART_CAMPAIGN",
        fingerprint: fingerprint(
          "CART_INTENT_NO_CART_CAMPAIGN",
          topCountry ?? "all",
        ),
        insight:
          "The store is seeing cart intent, but no cart-surface campaign is present to support shoppers before checkout.",
        recommendedAction:
          "Create a cart-drawer reminder draft and review the copy, timer duration, and targeting before publishing.",
        evidence: [
          evidence("Add to cart", formatInteger(addToCarts)),
          evidence("Checkout starts", formatInteger(checkoutStarts)),
          evidence("Attributed conversion", formatPercent(conversionRate)),
          ...(topCountry ? [evidence("Top country", topCountry)] : []),
        ],
        metrics: {
          addToCarts,
          checkoutStarts,
          conversionRate,
          intentEvents,
          orders,
          visitors,
          topCountry,
        },
        campaign: {
          name: "Cart rescue reminder",
          type: CampaignType.CART_TIMER,
          goal: CampaignGoal.CART_RESCUE,
          placementType: PlacementType.CART_DRAWER,
          headline: "Complete your order today",
          subheadline: "Keep the offer visible while shoppers review the cart.",
          ctaText: "Return to cart",
          ctaUrl: "/cart",
          country: topCountry,
          timerDurationMinutes: 120,
        },
      },
    },
  ];
}

function buildCampaignMetrics(
  campaigns: CampaignForRecommendation[],
  events: EventForRecommendation[],
) {
  const eventsByCampaign = new Map<string, EventForRecommendation[]>();

  for (const event of events) {
    if (!event.campaignId) continue;

    eventsByCampaign.set(event.campaignId, [
      ...(eventsByCampaign.get(event.campaignId) ?? []),
      event,
    ]);
  }

  return campaigns.map((campaign) => {
    const rows = eventsByCampaign.get(campaign.id) ?? [];
    const impressions = rows.filter((row) =>
      impressionEvents.has(row.eventType),
    ).length;
    const clicks = rows.filter((row) => clickEvents.has(row.eventType)).length;
    const orderRows = rows.filter(
      (row) => row.eventType === AnalyticsEventType.ORDER_ATTRIBUTED,
    );
    const orders = new Set(orderRows.map((row) => row.orderId).filter(Boolean))
      .size;
    const revenue = orderRows.reduce(
      (total, row) => total + Number(row.revenueAmount ?? 0),
      0,
    );
    const visitors = countVisitors(rows);
    const placementBreakdown = buildPlacementBreakdown(rows);

    return {
      campaign,
      impressions,
      clicks,
      orders,
      revenue,
      ctr: safeRate(clicks, impressions),
      conversionRate: safeRate(orders, visitors),
      averageOrderValue: safeRate(revenue, orders),
      currencyCode:
        orderRows.find((row) => row.currencyCode)?.currencyCode ?? "USD",
      placementBreakdown,
      visitors,
    };
  });
}

function buildPlacementBreakdown(events: EventForRecommendation[]) {
  const rowsByPlacement = new Map<
    PlacementType | "UNKNOWN",
    { impressions: number; clicks: number }
  >();

  for (const event of events) {
    const placementType = event.placementType ?? "UNKNOWN";
    const row = rowsByPlacement.get(placementType) ?? {
      clicks: 0,
      impressions: 0,
    };

    if (impressionEvents.has(event.eventType)) row.impressions += 1;
    if (clickEvents.has(event.eventType)) row.clicks += 1;

    rowsByPlacement.set(placementType, row);
  }

  return Array.from(rowsByPlacement.entries()).map(([placementType, row]) => ({
    placementType,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: safeRate(row.clicks, row.impressions),
  }));
}

function hasProductCampaignForPath(
  campaigns: CampaignForRecommendation[],
  path: string,
) {
  return campaigns.some((campaign) => {
    if (
      campaign.status !== CampaignStatus.ACTIVE ||
      (campaign.type !== CampaignType.PRODUCT_BADGE &&
        campaign.type !== CampaignType.PRODUCT_TIMER)
    ) {
      return false;
    }

    return (
      campaign.placements.some(
        (placement) => placement.placementType === PlacementType.PRODUCT_PAGE,
      ) ||
      campaign.name.toLowerCase().includes(lastPathSegment(path).toLowerCase())
    );
  });
}

function hasActiveCartCampaign(campaigns: CampaignForRecommendation[]) {
  return campaigns.some((campaign) => {
    if (campaign.status !== CampaignStatus.ACTIVE) return false;
    if (
      campaign.type === CampaignType.CART_TIMER ||
      campaign.type === CampaignType.FREE_SHIPPING_GOAL
    ) {
      return true;
    }

    return campaign.placements.some(
      (placement) =>
        placement.enabled &&
        (placement.placementType === PlacementType.CART_DRAWER ||
          placement.placementType === PlacementType.CART_PAGE),
    );
  });
}

function isCampaignTypePortableToCart(type: CampaignType) {
  return (
    type === CampaignType.COUNTDOWN_BAR ||
    type === CampaignType.CART_TIMER ||
    type === CampaignType.PRODUCT_TIMER
  );
}

function isTimerCampaignType(type: CampaignType) {
  return (
    type === CampaignType.COUNTDOWN_BAR ||
    type === CampaignType.PRODUCT_TIMER ||
    type === CampaignType.CART_TIMER
  );
}

async function loadCampaigns(shopId: string) {
  return prisma.campaign.findMany({
    where: { shopId },
    include: {
      placements: true,
      freeShippingSettings: true,
    },
  });
}

async function loadEvents(shopId: string, since: Date, now: Date) {
  return prisma.analyticsEvent.findMany({
    where: {
      shopId,
      occurredAt: { gte: since, lte: now },
    },
    include: {
      campaign: {
        select: { id: true, name: true, type: true },
      },
    },
    orderBy: [{ occurredAt: "asc" }],
  });
}

async function loadUniqueCodes(shopId: string, since: Date, now: Date) {
  return prisma.uniqueDiscountCode.findMany({
    where: {
      shopId,
      OR: [
        { assignedAt: { gte: since, lte: now } },
        { usedAt: { gte: since, lte: now } },
      ],
    },
    include: {
      campaign: {
        select: { name: true },
      },
    },
  });
}

async function assertRecommendationBelongsToShop(shopId: string, id: string) {
  const recommendation = await prisma.campaignRecommendation.findFirst({
    where: { id, shopId },
  });

  if (!recommendation) {
    throw new RecommendationError("Recommendation was not found.");
  }

  return recommendation;
}

async function createDraftCampaignFromPayload(
  tx: Prisma.TransactionClient,
  shopId: string,
  campaign: DraftCampaignPayload,
) {
  return tx.campaign.create({
    data: {
      shopId,
      name: campaign.name,
      status: CampaignStatus.DRAFT,
      type: campaign.type,
      goal: campaign.goal,
      timezone: "UTC",
      placements: {
        create: [
          {
            placementType: campaign.placementType,
            enabled: true,
          },
        ],
      },
      targeting: {
        create: {
          countries: campaign.country ? [campaign.country] : [],
          markets: [],
          locales: campaign.locale ? [campaign.locale] : [],
          productIds: [],
          collectionIds: [],
          productTags: [],
          customerTags: [],
          urlContains: campaign.productPath ? [campaign.productPath] : [],
          utmSources: [],
          devices: [],
          excludeProductIds: [],
          excludeCollectionIds: [],
          behaviorRules: Prisma.JsonNull,
        },
      },
      translations: {
        create: buildDefaultCampaignTranslations({
          goal: campaign.goal,
          type: campaign.type,
          overrides: {
            en: {
              headline: campaign.headline,
              subheadline: campaign.subheadline,
              ctaText: campaign.ctaText,
              ctaUrl: campaign.ctaUrl,
            },
          },
        }),
      },
      design: {
        create: {
          templateKey: "recommendation-draft",
        },
      },
      ...(isTimerCampaignType(campaign.type)
        ? {
            timerSettings: {
              create: {
                mode: TimerMode.EVERGREEN_SESSION,
                durationMinutes: campaign.timerDurationMinutes ?? 240,
                recurringDays: [],
                resetBehavior: TimerResetBehavior.NEVER,
                expiredBehavior: TimerExpiredBehavior.UNPUBLISH_TIMER,
              },
            },
          }
        : {}),
      ...(campaign.type === CampaignType.CART_TIMER
        ? {
            cartRescueSettings: {
              create: {
                rescueReason: CartRescueReason.CHECKOUT_REMINDER,
                showButton: true,
                showTimer: true,
              },
            },
          }
        : {}),
      ...(campaign.type === CampaignType.FREE_SHIPPING_GOAL
        ? {
            freeShippingSettings: {
              create: {
                thresholdAmount:
                  campaign.freeShippingThreshold ??
                  defaultFreeShippingSettingsValues.thresholdAmount,
                currencyCode:
                  campaign.currencyCode ??
                  defaultFreeShippingSettingsValues.currencyCode,
                includeDiscountedSubtotal:
                  defaultFreeShippingSettingsValues.includeDiscountedSubtotal,
                emptyCartMessage:
                  defaultFreeShippingSettingsValues.emptyCartMessage,
                successMessage:
                  defaultFreeShippingSettingsValues.successMessage,
                progressStyle: defaultFreeShippingSettingsValues.progressStyle,
              },
            },
          }
        : {}),
      ...(campaign.type === CampaignType.DELIVERY_CUTOFF
        ? {
            deliveryCutoffSettings: {
              create: {
                cutoffHour: Number(
                  defaultDeliveryCutoffSettingsValues.cutoffHour,
                ),
                cutoffMinute: Number(
                  defaultDeliveryCutoffSettingsValues.cutoffMinute,
                ),
                processingDays: Number(
                  defaultDeliveryCutoffSettingsValues.processingDays,
                ),
                minDeliveryDays: Number(
                  defaultDeliveryCutoffSettingsValues.minDeliveryDays,
                ),
                maxDeliveryDays: Number(
                  defaultDeliveryCutoffSettingsValues.maxDeliveryDays,
                ),
                workingDays: [1, 2, 3, 4, 5],
                holidays: [],
                countryRules: {},
                afterCutoffBehavior:
                  defaultDeliveryCutoffSettingsValues.afterCutoffBehavior,
              },
            },
          }
        : {}),
      ...(campaign.type === CampaignType.PRODUCT_BADGE
        ? {
            badgeSettings: {
              create: {
                badgeText: defaultBadgeSettingsValues.badgeText,
                badgeShape: defaultBadgeSettingsValues.badgeShape,
                badgePosition: defaultBadgeSettingsValues.badgePosition,
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });
}

function readRecommendationPayload(
  value: unknown,
): RecommendationPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as Partial<RecommendationPayload>;

  if (
    typeof input.fingerprint !== "string" ||
    typeof input.ruleKey !== "string" ||
    (input.action !== "CREATE_DRAFT_CAMPAIGN" &&
      input.action !== "CREATE_DRAFT_EXPERIMENT")
  ) {
    return null;
  }

  return input as RecommendationPayload;
}

function countVisitors(events: EventForRecommendation[]) {
  const keys = events
    .map((event) => event.sessionId ?? event.orderId ?? event.path)
    .filter(Boolean) as string[];

  return Math.max(
    new Set(keys).size,
    events.filter((event) => impressionEvents.has(event.eventType)).length,
  );
}

function countEvents(
  events: EventForRecommendation[],
  eventType: AnalyticsEventType,
) {
  return events.filter((event) => event.eventType === eventType).length;
}

function countUniqueOrders(events: EventForRecommendation[]) {
  return new Set(
    events
      .filter(
        (event) => event.eventType === AnalyticsEventType.ORDER_ATTRIBUTED,
      )
      .map((event) => event.orderId)
      .filter(Boolean),
  ).size;
}

function evidence(
  label: string,
  value: string,
  detail?: string,
): RecommendationEvidence {
  return {
    label,
    value,
    ...(detail ? { detail } : {}),
  };
}

function fingerprint(ruleKey: RecommendationRuleKey, target: string) {
  return `${ruleKey}:${target}`;
}

function confidenceFromRateGap(
  target: number,
  actual: number,
  sampleSize: number,
) {
  const gap = Math.max(0, target - actual);
  return clampConfidence(0.55 + gap * 4 + Math.min(sampleSize, 500) / 2500);
}

function safeRate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function clampConfidence(value: number) {
  return Math.max(0.5, Math.min(0.95, Number(value.toFixed(2))));
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(
  value: number,
  currencyCode: string | null | undefined,
) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode || "USD",
    style: "currency",
  }).format(value);
}

function placementList(placements: CampaignPlacement[]) {
  const enabledPlacements = placements
    .filter((placement) => placement.enabled)
    .map((placement) => formatPlacement(placement.placementType));

  return enabledPlacements.length > 0 ? enabledPlacements.join(", ") : "None";
}

function formatPlacement(placementType: PlacementType | "UNKNOWN") {
  if (placementType === "UNKNOWN") return "Unknown";

  return placementType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function lastPathSegment(path: string) {
  return path.split("/").filter(Boolean).at(-1) ?? "product";
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return (
    Array.from(counts.entries()).sort(
      (first, second) =>
        second[1] - first[1] || first[0].localeCompare(second[0]),
    )[0]?.[0] ?? null
  );
}
