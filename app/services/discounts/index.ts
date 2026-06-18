import type { PremiumFeatureKey, UniqueCodeStatus } from "../../types/stage2";

export type DiscountServiceCapability =
  | "unique_codes"
  | "auto_apply"
  | "shopify_functions";

export type UniqueDiscountCodeRecord = {
  campaignId: string;
  code: string;
  status: UniqueCodeStatus;
  expiresAt: string | null;
};

export const discountPremiumFeatures = [
  "UNIQUE_CODES",
  "ADVANCED_DISCOUNTS",
] satisfies PremiumFeatureKey[];
