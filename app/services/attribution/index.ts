import type { AttributionModel, PremiumFeatureKey } from "../../types/stage2";

export type AttributionServiceCapability =
  | "campaign_touchpoints"
  | "checkout_started"
  | "order_status"
  | "thank_you_page";

export type AttributionSettings = {
  model: AttributionModel;
  lookbackWindowDays: number;
};

export const attributionPremiumFeatures = [
  "ADVANCED_REPORTING",
  "CHECKOUT_EXTENSIONS",
] satisfies PremiumFeatureKey[];
