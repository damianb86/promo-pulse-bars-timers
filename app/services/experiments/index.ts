import type {
  ExperimentStatus,
  ExperimentVariantStatus,
  PremiumFeatureKey,
} from "../../types/stage2";

export type ExperimentServiceCapability =
  | "message_tests"
  | "design_tests"
  | "discount_tests"
  | "placement_tests"
  | "auto_winner";

export type ExperimentLifecycle = {
  status: ExperimentStatus;
  variantStatus: ExperimentVariantStatus;
};

export const experimentPremiumFeatures = [
  "AB_TESTING",
  "AUTO_WINNER",
] satisfies PremiumFeatureKey[];
