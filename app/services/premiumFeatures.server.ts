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

export const defaultStage2FeatureFlags: Stage2FeatureFlagState = {
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

export const minimumPlanByPremiumFeature = {
  UNIQUE_CODES: ShopPlan.PREMIUM,
  AB_TESTING: ShopPlan.PREMIUM,
  AUTO_WINNER: ShopPlan.PREMIUM,
  ADVANCED_DISCOUNTS: ShopPlan.PREMIUM,
  CHECKOUT_EXTENSIONS: ShopPlan.PRO,
  EMAIL_TIMERS: ShopPlan.PREMIUM,
  ADVANCED_BADGES: ShopPlan.PRO,
  MARKETS_ADVANCED: ShopPlan.PREMIUM,
  AI_CAMPAIGN_BUILDER: ShopPlan.PREMIUM,
  AGENCY_DASHBOARD: ShopPlan.AGENCY,
  ADVANCED_REPORTING: ShopPlan.PREMIUM,
  BEHAVIORAL_TARGETING: ShopPlan.PRO,
  RECOMMENDATIONS: ShopPlan.PRO,
  CAMPAIGN_LIBRARY: ShopPlan.STARTER,
} satisfies Record<PremiumFeatureKey, ShopPlan>;

const planRank = {
  FREE: 0,
  STARTER: 1,
  GROWTH: 2,
  PRO: 3,
  PREMIUM: 4,
  AGENCY: 5,
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
