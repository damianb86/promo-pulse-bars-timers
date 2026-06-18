import type { PremiumFeatureKey } from "../../types/stage2";

export type AiCampaignBuilderMode =
  | "draft_campaign"
  | "optimize_copy"
  | "localize_campaign"
  | "summarize_results";

export type AiCampaignBuilderRequest = {
  mode: AiCampaignBuilderMode;
  shopId: string;
  locale: string;
  prompt: string;
};

export const aiPremiumFeatures = [
  "AI_CAMPAIGN_BUILDER",
  "RECOMMENDATIONS",
] satisfies PremiumFeatureKey[];
