import { AnalyticsEventType, CampaignStatus, ShopPlan } from "@prisma/client";
import type { Shop } from "@prisma/client";

import prisma from "../db.server";
import { hasBehaviorTargetingRules } from "../types/behavior-targeting";
import type {
  CampaignTypeValue,
  PlacementTypeValue,
} from "../types/campaign-options";

export type PlanFeatureKey =
  | "advanced_analytics"
  | "advanced_targeting"
  | "basic_targeting"
  | "behavioral_targeting"
  | "cart_drawer"
  | "cart_timer"
  | "checkout_extensions"
  | "countdown_bar"
  | "custom_css"
  | "custom_selectors"
  | "delivery_cutoff"
  | "discount_sync"
  | "free_shipping_goal"
  | "geo_market_targeting"
  | "low_stock"
  | "multi_language"
  | "product_badges"
  | "product_timer"
  | "recurring_timers"
  | "scheduling"
  | "stronger_attribution"
  | "templates"
  | "unique_discount_codes";

export type PlanGateCheck = {
  allowed: boolean;
  reason: string;
  requiredPlan?: ShopPlan;
};

export type PlanLimits = {
  plan: ShopPlan;
  monthlyPriceUsd: number;
  activeCampaignLimit: number | null;
  activeAbTestLimit: number | null;
  abTestVariantLimit: number | null;
  analyticsRetentionDays: number;
  discountSyncCampaignLimit: number | null;
  draftCampaignLimit: number | null;
  emailCountdownTimerLimit: number | null;
  monthlyUniqueCodeLimit: number | null;
  monthlyImpressionLimit: number | null;
  storefrontLanguageLimit: number | null;
  aiCampaignBuilder: "none" | "limited" | "full";
  supportLevel: string;
  features: Record<PlanFeatureKey, boolean>;
};

type ShopPlanSource = Pick<Shop, "id" | "plan">;
type PlanLimitOverride = Partial<
  Pick<
    PlanLimits,
    "monthlyPriceUsd" | "activeCampaignLimit" | "monthlyImpressionLimit"
  >
> & {
  features?: Partial<Record<PlanFeatureKey, boolean>>;
};
type PlanLimitOverrides = Partial<Record<ShopPlan, PlanLimitOverride>>;

const planOrder: Record<ShopPlan, number> = {
  FREE: 0,
  STARTER: 1,
  GROWTH: 2,
  PRO: 3,
};

export const publicPlanOrder = [
  ShopPlan.FREE,
  ShopPlan.STARTER,
  ShopPlan.GROWTH,
  ShopPlan.PRO,
] as const;

const legacyPlanAliases: Record<string, ShopPlan> = {
  AGENCY: ShopPlan.PRO,
  PREMIUM: ShopPlan.PRO,
};

const allFeatures: Record<PlanFeatureKey, boolean> = {
  advanced_analytics: false,
  advanced_targeting: false,
  basic_targeting: false,
  behavioral_targeting: false,
  cart_drawer: false,
  cart_timer: false,
  checkout_extensions: false,
  countdown_bar: false,
  custom_css: false,
  custom_selectors: false,
  delivery_cutoff: false,
  discount_sync: false,
  free_shipping_goal: false,
  geo_market_targeting: false,
  low_stock: false,
  multi_language: false,
  product_badges: false,
  product_timer: false,
  recurring_timers: false,
  scheduling: false,
  stronger_attribution: false,
  templates: false,
  unique_discount_codes: false,
};

const baseLimitsByPlan: Record<ShopPlan, PlanLimits> = {
  FREE: {
    plan: "FREE",
    monthlyPriceUsd: 0,
    activeCampaignLimit: 2,
    activeAbTestLimit: 1,
    abTestVariantLimit: 2,
    analyticsRetentionDays: 7,
    discountSyncCampaignLimit: 1,
    draftCampaignLimit: null,
    emailCountdownTimerLimit: 0,
    monthlyImpressionLimit: 10_000,
    monthlyUniqueCodeLimit: 25,
    storefrontLanguageLimit: 2,
    aiCampaignBuilder: "none",
    supportLevel: "Docs and basic support",
    features: {
      ...allFeatures,
      basic_targeting: true,
      cart_drawer: true,
      countdown_bar: true,
      delivery_cutoff: true,
      discount_sync: true,
      free_shipping_goal: true,
      multi_language: true,
      product_badges: true,
      product_timer: true,
      unique_discount_codes: true,
    },
  },
  STARTER: {
    plan: "STARTER",
    monthlyPriceUsd: 9,
    activeCampaignLimit: 5,
    activeAbTestLimit: 2,
    abTestVariantLimit: 2,
    analyticsRetentionDays: 30,
    discountSyncCampaignLimit: 3,
    draftCampaignLimit: null,
    emailCountdownTimerLimit: 0,
    monthlyImpressionLimit: 50_000,
    monthlyUniqueCodeLimit: 500,
    storefrontLanguageLimit: 3,
    aiCampaignBuilder: "none",
    supportLevel: "Standard email support",
    features: {
      ...allFeatures,
      basic_targeting: true,
      cart_drawer: true,
      cart_timer: true,
      countdown_bar: true,
      delivery_cutoff: true,
      discount_sync: true,
      free_shipping_goal: true,
      low_stock: true,
      multi_language: true,
      product_badges: true,
      product_timer: true,
      recurring_timers: true,
      scheduling: true,
      templates: true,
      unique_discount_codes: true,
    },
  },
  GROWTH: {
    plan: "GROWTH",
    monthlyPriceUsd: 19,
    activeCampaignLimit: 25,
    activeAbTestLimit: 10,
    abTestVariantLimit: 3,
    analyticsRetentionDays: 90,
    discountSyncCampaignLimit: null,
    draftCampaignLimit: null,
    emailCountdownTimerLimit: 5,
    monthlyImpressionLimit: 250_000,
    monthlyUniqueCodeLimit: 5_000,
    storefrontLanguageLimit: null,
    aiCampaignBuilder: "limited",
    supportLevel: "Basic priority email support",
    features: {
      ...allFeatures,
      advanced_analytics: true,
      advanced_targeting: true,
      basic_targeting: true,
      cart_drawer: true,
      cart_timer: true,
      countdown_bar: true,
      custom_css: true,
      delivery_cutoff: true,
      discount_sync: true,
      free_shipping_goal: true,
      geo_market_targeting: true,
      low_stock: true,
      multi_language: true,
      product_badges: true,
      product_timer: true,
      recurring_timers: true,
      scheduling: true,
      stronger_attribution: true,
      templates: true,
      unique_discount_codes: true,
    },
  },
  PRO: {
    plan: "PRO",
    monthlyPriceUsd: 39,
    activeCampaignLimit: null,
    activeAbTestLimit: null,
    abTestVariantLimit: null,
    analyticsRetentionDays: 365,
    discountSyncCampaignLimit: null,
    draftCampaignLimit: null,
    emailCountdownTimerLimit: null,
    monthlyImpressionLimit: 1_500_000,
    monthlyUniqueCodeLimit: 50_000,
    storefrontLanguageLimit: null,
    aiCampaignBuilder: "full",
    supportLevel: "Priority support, setup help, and early access",
    features: {
      ...allFeatures,
      advanced_analytics: true,
      advanced_targeting: true,
      basic_targeting: true,
      behavioral_targeting: true,
      cart_drawer: true,
      cart_timer: true,
      checkout_extensions: true,
      countdown_bar: true,
      custom_css: true,
      custom_selectors: true,
      delivery_cutoff: true,
      discount_sync: true,
      free_shipping_goal: true,
      geo_market_targeting: true,
      low_stock: true,
      multi_language: true,
      product_badges: true,
      product_timer: true,
      recurring_timers: true,
      scheduling: true,
      stronger_attribution: true,
      templates: true,
      unique_discount_codes: true,
    },
  },
};

const limitsByPlan = applyPlanLimitOverrides(baseLimitsByPlan);

const featureMinimumPlans: Record<PlanFeatureKey, ShopPlan> = Object.keys(
  allFeatures,
).reduce(
  (minimumPlans, key) => {
    const feature = key as PlanFeatureKey;
    minimumPlans[feature] =
      (Object.keys(planOrder) as ShopPlan[]).find(
        (plan) => limitsByPlan[plan].features[feature],
      ) ?? "PRO";
    return minimumPlans;
  },
  {} as Record<PlanFeatureKey, ShopPlan>,
);

function applyPlanLimitOverrides(
  limits: Record<ShopPlan, PlanLimits>,
): Record<ShopPlan, PlanLimits> {
  const overrides = parsePlanLimitOverrides();

  if (!overrides) return limits;

  return (Object.keys(limits) as ShopPlan[]).reduce(
    (nextLimits, plan) => {
      const override = overrides[plan];
      const current = limits[plan];

      if (!override) {
        nextLimits[plan] = current;
        return nextLimits;
      }

      nextLimits[plan] = {
        ...current,
        monthlyPriceUsd: readNonNegativeNumber(
          override.monthlyPriceUsd,
          current.monthlyPriceUsd,
        ),
        activeCampaignLimit: readNullableNonNegativeInteger(
          override.activeCampaignLimit,
          current.activeCampaignLimit,
        ),
        monthlyImpressionLimit: readNullableNonNegativeInteger(
          override.monthlyImpressionLimit,
          current.monthlyImpressionLimit,
        ),
        features: {
          ...current.features,
          ...readFeatureOverrides(override.features),
        },
      };

      return nextLimits;
    },
    {} as Record<ShopPlan, PlanLimits>,
  );
}

function parsePlanLimitOverrides(): PlanLimitOverrides | null {
  const rawValue = process.env.PROMO_PULSE_PLAN_LIMITS_JSON?.trim();

  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected an object.");
    }

    return parsed as PlanLimitOverrides;
  } catch (error) {
    console.warn(
      "PROMO_PULSE_PLAN_LIMITS_JSON is invalid and was ignored.",
      error,
    );
    return null;
  }
}

function readNonNegativeNumber(value: unknown, fallback: number) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) && parsedValue >= 0
    ? parsedValue
    : fallback;
}

function readNullableNonNegativeInteger(
  value: unknown,
  fallback: number | null,
) {
  if (value === null) return null;

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) && parsedValue >= 0
    ? Math.floor(parsedValue)
    : fallback;
}

function readFeatureOverrides(
  features?: Partial<Record<PlanFeatureKey, boolean>>,
) {
  if (!features || typeof features !== "object") return {};

  return (Object.keys(allFeatures) as PlanFeatureKey[]).reduce(
    (featureOverrides, feature) => {
      if (typeof features[feature] === "boolean") {
        featureOverrides[feature] = features[feature];
      }

      return featureOverrides;
    },
    {} as Partial<Record<PlanFeatureKey, boolean>>,
  );
}

export class PlanGateError extends Error {
  requiredPlan?: ShopPlan;

  constructor(message: string, requiredPlan?: ShopPlan) {
    super(message);
    this.name = "PlanGateError";
    this.requiredPlan = requiredPlan;
  }
}

export function normalizeShopPlan(plan: ShopPlan | string): ShopPlan {
  const value = String(plan).trim().toUpperCase();

  if (legacyPlanAliases[value]) return legacyPlanAliases[value];

  return Object.values(ShopPlan).includes(value as ShopPlan)
    ? (value as ShopPlan)
    : ShopPlan.FREE;
}

export function getPlanLimits(plan: ShopPlan | string): PlanLimits {
  return limitsByPlan[normalizeShopPlan(plan)];
}

export function getEffectiveShopPlan(shop: Pick<Shop, "plan">): ShopPlan {
  const override = readDevPlanOverride();
  const plan = normalizeShopPlan(shop.plan);

  if (!override) return plan;

  return planOrder[override] > planOrder[plan] ? override : plan;
}

export async function canCreateCampaign(
  shop: ShopPlanSource,
): Promise<PlanGateCheck> {
  if (await hasReachedMonthlyImpressions(shop)) {
    return {
      allowed: false,
      reason: "Monthly impression limit reached for the current plan.",
    };
  }

  return { allowed: true, reason: "" };
}

export async function canActivateCampaign(
  shop: ShopPlanSource,
  options: { campaignId?: string } = {},
): Promise<PlanGateCheck> {
  const [activeCampaignCount, monthlyImpressionsReached] = await Promise.all([
    prisma.campaign.count({
      where: {
        shopId: shop.id,
        status: CampaignStatus.ACTIVE,
        ...(options.campaignId
          ? {
              id: {
                not: options.campaignId,
              },
            }
          : {}),
      },
    }),
    hasReachedMonthlyImpressions(shop),
  ]);

  return evaluateCanActivateCampaign(
    getEffectiveShopPlan(shop),
    activeCampaignCount,
    monthlyImpressionsReached,
  );
}

export function canUseFeature(
  shop: Pick<Shop, "plan">,
  featureKey: PlanFeatureKey,
): PlanGateCheck {
  const plan = getEffectiveShopPlan(shop);
  const allowed = getPlanLimits(plan).features[featureKey];

  return {
    allowed,
    reason: allowed
      ? ""
      : `${formatFeatureName(featureKey)} requires the ${formatPlanName(
          featureMinimumPlans[featureKey],
        )} plan.`,
    requiredPlan: allowed ? undefined : featureMinimumPlans[featureKey],
  };
}

export async function hasReachedMonthlyImpressions(
  shop: ShopPlanSource,
  now = new Date(),
) {
  const limits = getPlanLimits(getEffectiveShopPlan(shop));

  if (limits.monthlyImpressionLimit === null) {
    return false;
  }

  const impressions = await prisma.analyticsEvent.count({
    where: {
      shopId: shop.id,
      eventType: AnalyticsEventType.IMPRESSION,
      occurredAt: {
        gte: getMonthStart(now),
      },
    },
  });

  return impressions >= limits.monthlyImpressionLimit;
}

export function evaluateCanActivateCampaign(
  plan: ShopPlan | string,
  activeCampaignCount: number,
  monthlyImpressionsReached: boolean,
): PlanGateCheck {
  const effectivePlan = normalizeShopPlan(plan);
  const limits = getPlanLimits(effectivePlan);

  if (monthlyImpressionsReached) {
    return {
      allowed: false,
      reason: "Monthly impression limit reached for the current plan.",
    };
  }

  if (
    limits.activeCampaignLimit !== null &&
    activeCampaignCount >= limits.activeCampaignLimit
  ) {
    return {
      allowed: false,
      reason: `${formatPlanName(effectivePlan)} allows ${limits.activeCampaignLimit} active campaign${
        limits.activeCampaignLimit === 1 ? "" : "s"
      }. Upgrade to activate more.`,
      requiredPlan: getNextPlan(effectivePlan),
    };
  }

  return { allowed: true, reason: "" };
}

export async function validateCampaignPlanAccess(
  shop: ShopPlanSource,
  campaign: {
    status?: string;
    type: CampaignTypeValue;
    placementType: PlacementTypeValue;
    placementTypes?: PlacementTypeValue[];
    startsAt?: string;
    targeting?: Parameters<typeof getCampaignPlanViolations>[1]["targeting"];
    timerSettings?: Parameters<
      typeof getCampaignPlanViolations
    >[1]["timerSettings"];
  },
  options: { campaignId?: string } = {},
) {
  const errors: string[] = [];

  const placementsToCheck =
    campaign.placementTypes && campaign.placementTypes.length > 0
      ? campaign.placementTypes
      : [campaign.placementType];
  const requiredFeatures = new Set<PlanFeatureKey>();

  placementsToCheck.forEach((placementType) => {
    getRequiredCampaignFeatures({
      ...campaign,
      placementType,
    }).forEach((feature) => requiredFeatures.add(feature));
  });

  for (const feature of requiredFeatures) {
    const featureGate = canUseFeature(shop, feature);

    if (!featureGate.allowed) {
      errors.push(featureGate.reason);
    }
  }

  if (usesBasicTargeting(campaign.targeting)) {
    const featureGate = canUseFeature(shop, "basic_targeting");

    if (!featureGate.allowed) {
      errors.push(featureGate.reason);
    }
  }

  if (usesGeoMarketTargeting(campaign.targeting)) {
    const featureGate = canUseFeature(shop, "geo_market_targeting");

    if (!featureGate.allowed) {
      errors.push(featureGate.reason);
    }
  }

  if (usesAdvancedTargeting(campaign.targeting)) {
    const featureGate = canUseFeature(shop, "advanced_targeting");

    if (!featureGate.allowed) {
      errors.push(featureGate.reason);
    }
  }

  if (hasBehaviorTargetingRules(campaign.targeting?.behaviorRules)) {
    const featureGate = canUseFeature(shop, "behavioral_targeting");

    if (!featureGate.allowed) {
      errors.push(featureGate.reason);
    }
  }

  if (usesRecurringTimer(campaign.timerSettings)) {
    const featureGate = canUseFeature(shop, "recurring_timers");

    if (!featureGate.allowed) {
      errors.push(featureGate.reason);
    }
  }

  if (campaign.status === CampaignStatus.ACTIVE) {
    const activationGate = await canActivateCampaign(shop, options);

    if (!activationGate.allowed) {
      errors.push(activationGate.reason);
    }
  }

  return errors;
}

export function getCampaignPlanViolations(
  shop: Pick<Shop, "plan">,
  campaign: {
    type: CampaignTypeValue;
    startsAt?: Date | string | null;
    placements?: Array<{
      enabled?: boolean | null;
      placementType: PlacementTypeValue;
    }>;
    targeting?: {
      countries?: unknown;
      markets?: unknown;
      locales?: unknown;
      productIds?: unknown;
      collectionIds?: unknown;
      productTags?: unknown;
      customerTags?: unknown;
      urlContains?: unknown;
      excludedUrlContains?: unknown;
      utmSources?: unknown;
      devices?: unknown;
      excludeProductIds?: unknown;
      excludeCollectionIds?: unknown;
      behaviorRules?: unknown;
    } | null;
    timerSettings?: {
      mode?: string | null;
    } | null;
    design?: {
      customCss?: string | null;
    } | null;
    discountSync?: { method?: string | null } | unknown | null;
  },
  placementType?: PlacementTypeValue,
) {
  const features = new Set<PlanFeatureKey>();

  getRequiredCampaignFeatures({
    type: campaign.type,
    placementType: placementType ?? campaign.placements?.[0]?.placementType,
    startsAt: campaign.startsAt ? String(campaign.startsAt) : undefined,
  }).forEach((feature) => features.add(feature));

  const activePlacements =
    campaign.placements?.filter((placement) => placement.enabled !== false) ??
    [];
  const placementsToCheck = placementType
    ? activePlacements.filter(
        (placement) => placement.placementType === placementType,
      )
    : activePlacements;

  placementsToCheck.forEach((placement) => {
    getRequiredCampaignFeatures({
      type: campaign.type,
      placementType: placement.placementType,
      startsAt: campaign.startsAt ? String(campaign.startsAt) : undefined,
    }).forEach((feature) => features.add(feature));
  });

  if (usesBasicTargeting(campaign.targeting)) features.add("basic_targeting");
  if (usesGeoMarketTargeting(campaign.targeting)) {
    features.add("geo_market_targeting");
  }
  if (jsonHasValues(campaign.targeting?.locales))
    features.add("multi_language");
  if (usesAdvancedTargeting(campaign.targeting)) {
    features.add("advanced_targeting");
  }
  if (hasBehaviorTargetingRules(campaign.targeting?.behaviorRules)) {
    features.add("behavioral_targeting");
  }
  if (usesRecurringTimer(campaign.timerSettings)) {
    features.add("recurring_timers");
  }
  if (campaign.design?.customCss?.trim()) features.add("custom_css");
  if (campaign.discountSync) {
    features.add("discount_sync");

    if (
      typeof campaign.discountSync === "object" &&
      "method" in campaign.discountSync &&
      campaign.discountSync.method === "UNIQUE_CODE"
    ) {
      features.add("unique_discount_codes");
    }
  }

  return Array.from(features)
    .map((feature) => canUseFeature(shop, feature))
    .filter((gate) => !gate.allowed)
    .map((gate) => gate.reason);
}

export function isCampaignAllowedByPlan(
  shop: Pick<Shop, "plan">,
  campaign: Parameters<typeof getCampaignPlanViolations>[1],
  placementType?: PlacementTypeValue,
) {
  return getCampaignPlanViolations(shop, campaign, placementType).length === 0;
}

export function getRequiredCampaignFeatures(campaign: {
  type: CampaignTypeValue;
  placementType?: PlacementTypeValue;
  startsAt?: string;
}): PlanFeatureKey[] {
  const features = new Set<PlanFeatureKey>();

  if (campaign.startsAt) features.add("scheduling");

  if (campaign.type === "COUNTDOWN_BAR") features.add("countdown_bar");
  if (campaign.type === "PRODUCT_TIMER") features.add("product_timer");
  if (campaign.type === "FREE_SHIPPING_GOAL")
    features.add("free_shipping_goal");
  if (campaign.type === "CART_TIMER") features.add("cart_timer");
  if (campaign.type === "DELIVERY_CUTOFF") features.add("delivery_cutoff");
  if (campaign.type === "LOW_STOCK") features.add("low_stock");
  if (campaign.type === "PRODUCT_BADGE") features.add("product_badges");

  if (campaign.placementType === "CART_DRAWER") features.add("cart_drawer");
  if (
    campaign.placementType === "THANK_YOU_PAGE" ||
    campaign.placementType === "ORDER_STATUS_PAGE"
  ) {
    features.add("checkout_extensions");
  }
  if (campaign.placementType === "CUSTOM_SELECTOR") {
    features.add("custom_selectors");
  }

  return Array.from(features);
}

export function getLockedFeatureReason(
  shop: Pick<Shop, "plan">,
  featureKey: PlanFeatureKey,
) {
  const gate = canUseFeature(shop, featureKey);

  return gate.allowed ? "" : gate.reason;
}

export function formatPlanName(plan: ShopPlan) {
  return plan.charAt(0) + plan.slice(1).toLowerCase();
}

export function formatFeatureName(featureKey: PlanFeatureKey) {
  if (featureKey === "custom_css") return "Custom CSS";

  return featureKey
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readDevPlanOverride() {
  if (process.env.NODE_ENV === "production") return null;

  const value = process.env.PROMO_PULSE_DEV_PLAN
    ?.trim()
    .toUpperCase();

  if (value) {
    const plan = normalizeShopPlan(value);

    return Object.values(ShopPlan).includes(plan) ? plan : null;
  }

  return process.env.NODE_ENV === "development" ? ShopPlan.PRO : null;
}

function getMonthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function usesBasicTargeting(
  targeting: Parameters<typeof getCampaignPlanViolations>[1]["targeting"],
) {
  return [
    targeting?.productIds,
    targeting?.collectionIds,
    targeting?.productTags,
    targeting?.urlContains,
    targeting?.devices,
  ].some(jsonHasValues);
}

function usesGeoMarketTargeting(
  targeting: Parameters<typeof getCampaignPlanViolations>[1]["targeting"],
) {
  return [targeting?.countries, targeting?.markets].some(jsonHasValues);
}

function usesAdvancedTargeting(
  targeting: Parameters<typeof getCampaignPlanViolations>[1]["targeting"],
) {
  return (
    [
      targeting?.customerTags,
      targeting?.utmSources,
      targeting?.excludedUrlContains,
      targeting?.excludeProductIds,
      targeting?.excludeCollectionIds,
    ].some(jsonHasValues)
  );
}

function usesRecurringTimer(
  timerSettings: Parameters<
    typeof getCampaignPlanViolations
  >[1]["timerSettings"],
) {
  return (
    timerSettings?.mode === "RECURRING_DAILY" ||
    timerSettings?.mode === "RECURRING_WEEKLY"
  );
}

function jsonHasValues(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;

  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return typeof value === "string" ? value.trim().length > 0 : false;
}

function getNextPlan(plan: ShopPlan): ShopPlan | undefined {
  const nextPlan = (Object.keys(planOrder) as ShopPlan[]).find(
    (candidate) => planOrder[candidate] > planOrder[plan],
  );

  return nextPlan;
}
