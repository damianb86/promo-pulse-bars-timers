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

// Reference image upload (multimodal AI campaign generation). These constants are
// shared between the browser dropzone and the server-side validation so both
// enforce the exact same limits.
export const campaignAiReferenceImageMaxBytes = 5 * 1024 * 1024;

export const campaignAiReferenceImageMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type CampaignAiReferenceImageMimeType =
  (typeof campaignAiReferenceImageMimeTypes)[number];

export const campaignAiReferenceImageAccept =
  campaignAiReferenceImageMimeTypes.join(",");

// A reference image the merchant uploaded so the AI can visually match an
// existing bar/timer/banner. `dataUrl` is a base64 data URI usable directly as
// an OpenAI Responses `input_image.image_url`.
export type CampaignAiReferenceImage = {
  dataUrl: string;
  mimeType: CampaignAiReferenceImageMimeType;
};

export function isCampaignAiReferenceImageMimeType(
  value: unknown,
): value is CampaignAiReferenceImageMimeType {
  return campaignAiReferenceImageMimeTypes.includes(
    value as CampaignAiReferenceImageMimeType,
  );
}

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
  locales: StorefrontLocale[];
  // Whether the merchant asked the AI to generate visual assets from the
  // reference image (PRO + write_files only; validated server-side).
  generateVisualAssets: boolean;
};

export type CampaignAiAssetSource = "generated" | "extracted" | "svg";

export type CampaignAiAssetType =
  | "background"
  | "icon"
  | "badge"
  | "pattern"
  | "texture"
  | "decoration"
  | "image";

// A visual asset the AI wants for the campaign. Referenced from the structural
// HTML/CSS via the placeholder `{{asset:key}}`, which the pipeline replaces with
// the uploaded Shopify file URL.
export type CampaignAiAssetSpec = {
  key: string;
  type: CampaignAiAssetType;
  source: CampaignAiAssetSource;
  prompt: string;
  // Inline SVG markup (only when source === "svg").
  svg?: string;
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
  customStyle: string;
  urlContains: string[];
  excludedUrlContains: string[];
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
  uniqueCodeReassignExpired: boolean;
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
  // True when the suggestion was generated from an uploaded reference image.
  // When set, the design keeps its image-derived visual overrides (colors,
  // gradients, spacing) instead of being reset to the chosen preset palette.
  referenceImageUsed?: boolean;
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
  // Optional structural HTML / CSS overrides. When the AI needs to reshape the
  // layout beyond what the design settings allow, it returns clean structural
  // HTML (cp-* classes + data-cp-slot placeholders) and/or scoped CSS here. Empty
  // string means "no override — use the structure generated from the settings".
  structureHtml: string;
  structureCss: string;
  // Visual assets the AI proposes (only when generateVisualAssets was on). The
  // HTML/CSS reference them via `{{asset:key}}` placeholders.
  assets: CampaignAiAssetSpec[];
  variants: CampaignAiVariant[];
  safety: CampaignAiSafety;
};
