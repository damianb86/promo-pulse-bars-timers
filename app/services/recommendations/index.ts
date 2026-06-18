import type {
  PremiumFeatureKey,
  RecommendationType,
} from "../../types/stage2";

export type RecommendationSource =
  | "analytics"
  | "campaign_library"
  | "market_context"
  | "merchant_history";

export type CampaignRecommendation = {
  type: RecommendationType;
  source: RecommendationSource;
  confidence: number;
  reason: string;
};

export const recommendationPremiumFeatures = [
  "RECOMMENDATIONS",
  "ADVANCED_REPORTING",
] satisfies PremiumFeatureKey[];
