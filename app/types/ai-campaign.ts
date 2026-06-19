import type { CampaignDesignValues } from "./campaign-design";
import type {
  CampaignGoalValue,
  CampaignTypeValue,
  EditableCampaignStatusValue,
  PlacementTypeValue,
} from "./campaign-options";
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
  productContext: string;
  eventName: string;
  countryCode: string;
  locale: StorefrontLocale;
  brandTone: CampaignAiTone;
  knownOffer: string;
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
  name: string;
  status: EditableCampaignStatusValue;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  expiredText: string;
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

export type CampaignSuggestion = {
  promptVersion: string;
  source: CampaignSuggestionSource;
  input: CampaignAiInput;
  campaign: CampaignSuggestionCampaign;
  translations: Record<StorefrontLocale, CampaignAiTranslation>;
  design: CampaignDesignValues;
  variants: CampaignAiVariant[];
  safety: CampaignAiSafety;
};
