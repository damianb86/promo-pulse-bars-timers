import type { PremiumFeatureKey } from "../../types/stage2";

export type MarketRuleScope = "country" | "market" | "currency" | "locale";

export type MarketOverrideRule = {
  scope: MarketRuleScope;
  code: string;
  campaignId: string;
};

export const marketsPremiumFeatures = [
  "MARKETS_ADVANCED",
  "CAMPAIGN_LIBRARY",
] satisfies PremiumFeatureKey[];
