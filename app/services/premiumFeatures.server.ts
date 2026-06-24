import { ShopPlan, type Shop } from "@prisma/client";

import {
  internalStage2FeatureFlags,
  premiumFeatureKeys,
  type InternalStage2FeatureFlag,
  type PremiumFeatureKey,
} from "../types/stage2";
import { formatPlanName, getEffectiveShopPlan } from "./planLimits.server";

export type PremiumFeatureGateCheck = {
  allowed: boolean;
  enabled: boolean;
  reason: string;
  requiredPlan?: ShopPlan;
};

export type Stage2FeatureFlagState = Record<InternalStage2FeatureFlag, boolean>;

const baseStage2FeatureFlags: Stage2FeatureFlagState = {
  UNIQUE_CODES: true,
  AB_TESTING: true,
  AUTO_WINNER: true,
  ADVANCED_DISCOUNTS: true,
  CHECKOUT_EXTENSIONS: true,
  EMAIL_TIMERS: true,
  ADVANCED_BADGES: true,
  MARKETS_ADVANCED: true,
  AI_CAMPAIGN_BUILDER: true,
  AGENCY_DASHBOARD: true,
};

export const defaultStage2FeatureFlags = applyStage2FeatureFlagOverrides(
  baseStage2FeatureFlags,
);

const baseMinimumPlanByPremiumFeature = {
  UNIQUE_CODES: ShopPlan.FREE,
  AB_TESTING: ShopPlan.FREE,
  AUTO_WINNER: ShopPlan.PRO,
  ADVANCED_DISCOUNTS: ShopPlan.PRO,
  CHECKOUT_EXTENSIONS: ShopPlan.PRO,
  EMAIL_TIMERS: ShopPlan.GROWTH,
  ADVANCED_BADGES: ShopPlan.GROWTH,
  MARKETS_ADVANCED: ShopPlan.GROWTH,
  AI_CAMPAIGN_BUILDER: ShopPlan.GROWTH,
  AGENCY_DASHBOARD: ShopPlan.PRO,
  ADVANCED_REPORTING: ShopPlan.GROWTH,
  BEHAVIORAL_TARGETING: ShopPlan.PRO,
  RECOMMENDATIONS: ShopPlan.PRO,
  CAMPAIGN_LIBRARY: ShopPlan.STARTER,
} satisfies Record<PremiumFeatureKey, ShopPlan>;

export const minimumPlanByPremiumFeature = applyPremiumFeaturePlanOverrides(
  baseMinimumPlanByPremiumFeature,
);

const planRank = {
  FREE: 0,
  STARTER: 1,
  GROWTH: 2,
  PRO: 3,
} satisfies Record<ShopPlan, number>;

export function canUsePremiumFeature(
  shop: Pick<Shop, "plan">,
  featureKey: PremiumFeatureKey,
  featureFlags: Partial<Stage2FeatureFlagState> = {},
): PremiumFeatureGateCheck {
  assertPremiumFeatureKey(featureKey);

  const enabled = isPremiumFeatureFlagEnabled(featureKey, featureFlags);
  const requiredPlan = minimumPlanByPremiumFeature[featureKey];
  const plan = getEffectiveShopPlan(shop);

  if (!enabled) {
    return {
      allowed: false,
      enabled,
      requiredPlan,
      reason: `${formatPremiumFeatureName(
        featureKey,
      )} is disabled by an internal feature flag.`,
    };
  }

  if (planRank[plan] < planRank[requiredPlan]) {
    return {
      allowed: false,
      enabled,
      requiredPlan,
      reason: `${formatPremiumFeatureName(featureKey)} requires the ${formatPlanName(
        requiredPlan,
      )} plan.`,
    };
  }

  return { allowed: true, enabled, reason: "" };
}

export function isPremiumFeatureFlagEnabled(
  featureKey: PremiumFeatureKey,
  overrides: Partial<Stage2FeatureFlagState> = {},
) {
  if (isInternalStage2FeatureFlag(featureKey)) {
    return overrides[featureKey] ?? defaultStage2FeatureFlags[featureKey];
  }

  return true;
}

export function isInternalStage2FeatureFlag(
  featureKey: PremiumFeatureKey,
): featureKey is InternalStage2FeatureFlag {
  return internalStage2FeatureFlags.includes(
    featureKey as InternalStage2FeatureFlag,
  );
}

function assertPremiumFeatureKey(
  featureKey: PremiumFeatureKey,
): asserts featureKey is PremiumFeatureKey {
  if (!premiumFeatureKeys.includes(featureKey)) {
    throw new Error(`Unsupported premium feature: ${featureKey}`);
  }
}

function formatPremiumFeatureName(featureKey: PremiumFeatureKey) {
  return featureKey
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function applyStage2FeatureFlagOverrides(flags: Stage2FeatureFlagState) {
  const overrides = parseJsonEnv<Record<string, unknown>>(
    "PROMO_PULSE_STAGE2_FLAGS_JSON",
  );

  if (!overrides) return flags;

  return internalStage2FeatureFlags.reduce(
    (nextFlags, flag) => {
      if (typeof overrides[flag] === "boolean") {
        nextFlags[flag] = overrides[flag];
      }

      return nextFlags;
    },
    { ...flags },
  );
}

function applyPremiumFeaturePlanOverrides(
  minimumPlans: Record<PremiumFeatureKey, ShopPlan>,
) {
  const overrides = parseJsonEnv<Record<string, unknown>>(
    "PROMO_PULSE_PREMIUM_FEATURE_PLANS_JSON",
  );

  if (!overrides) return minimumPlans;

  return premiumFeatureKeys.reduce(
    (nextMinimumPlans, featureKey) => {
      const plan = overrides[featureKey];

      if (isShopPlan(plan)) {
        nextMinimumPlans[featureKey] = plan;
      }

      return nextMinimumPlans;
    },
    { ...minimumPlans },
  );
}

function parseJsonEnv<T>(name: string): T | null {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected an object.");
    }

    return parsed as T;
  } catch (error) {
    console.warn(`${name} is invalid and was ignored.`, error);
    return null;
  }
}

function isShopPlan(value: unknown): value is ShopPlan {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(planRank, value)
  );
}
