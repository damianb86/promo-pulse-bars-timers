import type { CampaignDesignValues } from "./campaign-design";
import type {
  CampaignTimerExpiredBehaviorValue,
  CampaignTimerModeValue,
  CampaignTimerResetBehaviorValue,
  CountrySelectionValue,
  ProductSelectionValue,
} from "./campaign-form";
import type {
  CampaignGoalValue,
  CampaignTypeValue,
  EditableCampaignStatusValue,
  PlacementTypeValue,
} from "./campaign-options";
import type { BadgePositionValue, BadgeShapeValue } from "./badge";
import type { AfterCutoffBehaviorValue } from "./delivery-cutoff";
import type { DiscountModeValue, DiscountValueTypeValue } from "./discount";
import type { FreeShippingProgressStyleValue } from "./free-shipping";
import type {
  CampaignTranslationValues,
  StorefrontLocale,
} from "./localization";

export const campaignAiTones = [
  "premium",
  "playful",
  "urgent",
  "minimal",
  "luxury",
] as const;

export type CampaignAiTone = (typeof campaignAiTones)[number];

export const campaignAiShapes = [
  "sitewide",
  "product",
  "cart",
  "merchandising",
] as const;

export type CampaignAiShape = (typeof campaignAiShapes)[number];
export type CampaignAiAnswerMap = Record<string, string[]>;

export const campaignAiToneOptions: Array<{
  value: CampaignAiTone;
  label: string;
}> = [
  { value: "premium", label: "Premium" },
  { value: "playful", label: "Playful" },
  { value: "urgent", label: "Urgent" },
  { value: "minimal", label: "Minimal" },
  { value: "luxury", label: "Luxury" },
];

export type CampaignAiInput = {
  objective: CampaignGoalValue;
  campaignNameHint: string;
  campaignShape: CampaignAiShape;
  goalAnswers: CampaignAiAnswerMap;
  productContext: string;
  eventName: string;
  countryCode: string;
  locale: StorefrontLocale;
  brandTone: CampaignAiTone;
  knownOffer: string;
  quickStarts: string[];
  merchantNotes: string;
  followUpAnswers: CampaignAiAnswerMap;
  ctaUrl: string;
};

export type CampaignAiFormErrors = Partial<
  Record<keyof CampaignAiInput, string>
> & {
  form?: string;
};

export type CampaignSuggestionSource = "mock" | "provider";

export type CampaignSuggestionCampaign = {
  goal: CampaignGoalValue;
  type: CampaignTypeValue;
  placementType: PlacementTypeValue;
  placementTypes: PlacementTypeValue[];
  name: string;
  status: EditableCampaignStatusValue;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  expiredText: string;
};

export type CampaignAiTimerSettings = {
  mode: CampaignTimerModeValue;
  durationMinutes: string;
  resetBehavior: CampaignTimerResetBehaviorValue;
  expiredBehavior: CampaignTimerExpiredBehaviorValue;
  recurringHour: string;
  recurringMinute: string;
  startsAt: string;
  endsAt: string;
};

export type CampaignAiTargetingSettings = {
  productSelection: ProductSelectionValue;
  productIds: string[];
  excludeProductIds: string[];
  collectionIds: string[];
  productTags: string[];
  customSelector: string;
  countrySelection: CountrySelectionValue;
  countries: string[];
};

export type CampaignAiDiscountSettings = {
  mode: DiscountModeValue;
  discountCode: string;
  title: string;
  valueType: DiscountValueTypeValue;
  value: string;
  minimumSubtotal: string;
  appliesOncePerCustomer: boolean;
  uniqueCodePrefix: string;
  uniqueCodeExpiresMinutes: string;
  uniqueCodeAutoApply: boolean;
};

export type CampaignAiFreeShippingSettings = {
  thresholdAmount: string;
  currencyCode: string;
  includeDiscountedSubtotal: boolean;
  emptyCartMessage: string;
  successMessage: string;
  progressStyle: FreeShippingProgressStyleValue;
};

export type CampaignAiLowStockSettings = {
  threshold: string;
  showExactQuantity: boolean;
  fallbackMessage: string;
};

export type CampaignAiBadgeSettings = {
  badgeText: string;
  badgeShape: BadgeShapeValue;
  badgePosition: BadgePositionValue;
};

export type CampaignAiDeliveryCutoffSettings = {
  cutoffHour: string;
  cutoffMinute: string;
  processingDays: string;
  minDeliveryDays: string;
  maxDeliveryDays: string;
  workingDays: number[];
  holidays: string[];
  countryRules: Record<string, unknown>;
  afterCutoffBehavior: AfterCutoffBehaviorValue;
};

export type CampaignAiTranslation = CampaignTranslationValues & {
  ctaUrl?: string;
};

export type CampaignAiVariant = {
  name: string;
  weight: number;
  headline: string;
  subheadline: string;
  ctaText: string;
  designOverride?: Partial<CampaignDesignValues>;
  discountOverride?: Record<string, unknown>;
  placementOverride?: Record<string, unknown>;
};

export type CampaignAiSafety = {
  warnings: string[];
  blockedClaims: string[];
  requiresReview: boolean;
};

export type CampaignAiFollowUpQuestionOption = {
  id: string;
  label: string;
  description: string;
};

export type CampaignAiFollowUpQuestion = {
  id: string;
  question: string;
  reason: string;
  options: CampaignAiFollowUpQuestionOption[];
};

export type CampaignSuggestion = {
  promptVersion: string;
  source: CampaignSuggestionSource;
  input: CampaignAiInput;
  campaign: CampaignSuggestionCampaign;
  timer: CampaignAiTimerSettings;
  targeting: CampaignAiTargetingSettings;
  discount: CampaignAiDiscountSettings;
  freeShipping: CampaignAiFreeShippingSettings;
  lowStock: CampaignAiLowStockSettings;
  badge: CampaignAiBadgeSettings;
  deliveryCutoff: CampaignAiDeliveryCutoffSettings;
  translations: Record<StorefrontLocale, CampaignAiTranslation>;
  design: CampaignDesignValues;
  variants: CampaignAiVariant[];
  safety: CampaignAiSafety;
};
