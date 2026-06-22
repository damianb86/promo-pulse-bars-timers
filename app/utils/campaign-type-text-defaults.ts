import type { CampaignFormValues } from "../types/campaign-form";
import { getDefaultCampaignTranslationValues } from "./campaign-localization";

type CampaignTypeTextSource = Pick<CampaignFormValues, "goal" | "type">;

type CampaignTypeTextDefaults = Pick<
  CampaignFormValues,
  | "badgeText"
  | "ctaText"
  | "expiredText"
  | "freeShippingEmptyCartMessage"
  | "freeShippingSuccessMessage"
  | "headline"
  | "lowStockFallbackMessage"
  | "subheadline"
>;

const campaignTypeTextDefaultFields: Array<keyof CampaignTypeTextDefaults> = [
  "badgeText",
  "ctaText",
  "expiredText",
  "freeShippingEmptyCartMessage",
  "freeShippingSuccessMessage",
  "headline",
  "lowStockFallbackMessage",
  "subheadline",
];

export function getCampaignTypeDefaultTextValues(
  values: CampaignTypeTextSource,
): CampaignTypeTextDefaults {
  const defaults = getDefaultCampaignTranslationValues(
    values.goal,
    values.type,
    "en",
  );

  return {
    badgeText: defaults.badgeText,
    ctaText: defaults.ctaText,
    expiredText: defaults.expiredText,
    freeShippingEmptyCartMessage: defaults.freeShippingEmptyText,
    freeShippingSuccessMessage: defaults.freeShippingSuccessText,
    headline: defaults.headline,
    lowStockFallbackMessage: formatLowStockFallback(defaults.lowStockText),
    subheadline: defaults.subheadline,
  };
}

export function applyCampaignTypeDefaultTextValues(
  values: CampaignFormValues,
  { overwrite = false }: { overwrite?: boolean } = {},
): CampaignFormValues {
  const defaults = getCampaignTypeDefaultTextValues(values);
  const nextValues = { ...values };

  for (const field of campaignTypeTextDefaultFields) {
    const value = defaults[field];
    if (!value.trim()) continue;

    if (overwrite || !String(nextValues[field]).trim()) {
      nextValues[field] = value;
    }
  }

  return nextValues;
}

function formatLowStockFallback(value: string) {
  return value.replace(/\{\{\s*quantity\s*\}\}/gi, "a few");
}
