import { ShopPlan, type Shop } from "@prisma/client";

import {
  internalStage2FeatureFlags,
  premiumFeatureKeys,
  type InternalStage2FeatureFlag,
  type PremiumFeatureKey,
} from "../types/stage2";
import { formatPlanName } from "./planLimits.server";

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
  AUTO_WINNER: false,
  ADVANCED_DISCOUNTS: true,
  CHECKOUT_EXTENSIONS: true,
  EMAIL_TIMERS: false,
  ADVANCED_BADGES: false,
  MARKETS_ADVANCED: false,
  AI_CAMPAIGN_BUILDER: false,
  AGENCY_DASHBOARD: false,
};

export const minimumPlanByPremiumFeature = {
  UNIQUE_CODES: ShopPlan.PRO,
  AB_TESTING: ShopPlan.PRO,
  AUTO_WINNER: ShopPlan.PRO,
  ADVANCED_DISCOUNTS: ShopPlan.PRO,
  CHECKOUT_EXTENSIONS: ShopPlan.GROWTH,
  EMAIL_TIMERS: ShopPlan.PRO,
  ADVANCED_BADGES: ShopPlan.PRO,
  MARKETS_ADVANCED: ShopPlan.PRO,
  AI_CAMPAIGN_BUILDER: ShopPlan.PRO,
  AGENCY_DASHBOARD: ShopPlan.PRO,
  ADVANCED_REPORTING: ShopPlan.PRO,
  BEHAVIORAL_TARGETING: ShopPlan.PRO,
  RECOMMENDATIONS: ShopPlan.PRO,
  CAMPAIGN_LIBRARY: ShopPlan.GROWTH,
} satisfies Record<PremiumFeatureKey, ShopPlan>;

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

  if (planRank[shop.plan] < planRank[requiredPlan]) {
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
