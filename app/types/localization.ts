export const storefrontLocales = [
  { locale: "en", label: "English", shortLabel: "EN", flag: "🇺🇸" },
  { locale: "es", label: "Spanish", shortLabel: "ES", flag: "🇪🇸" },
  { locale: "pt-BR", label: "Portuguese BR", shortLabel: "PT", flag: "🇧🇷" },
  { locale: "fr", label: "French", shortLabel: "FR", flag: "🇫🇷" },
  { locale: "de", label: "German", shortLabel: "DE", flag: "🇩🇪" },
] as const;

export type StorefrontLocale = (typeof storefrontLocales)[number]["locale"];

export const defaultStorefrontLocale: StorefrontLocale = "en";

export const campaignTranslationFields = [
  { key: "headline", label: "Headline", multiline: false },
  { key: "subheadline", label: "Subheadline", multiline: true },
  { key: "ctaText", label: "CTA text", multiline: false },
  { key: "ctaUrl", label: "CTA URL", multiline: false },
  { key: "expiredText", label: "Expired text", multiline: true },
  {
    key: "freeShippingEmptyText",
    label: "Free shipping empty cart text",
    multiline: true,
  },
  {
    key: "freeShippingProgressText",
    label: "Free shipping progress text",
    multiline: true,
  },
  {
    key: "freeShippingSuccessText",
    label: "Free shipping success text",
    multiline: true,
  },
  {
    key: "deliveryBeforeCutoffText",
    label: "Delivery before cutoff text",
    multiline: true,
  },
  {
    key: "deliveryAfterCutoffText",
    label: "Delivery after cutoff text",
    multiline: true,
  },
  { key: "lowStockText", label: "Low stock text", multiline: true },
  { key: "badgeText", label: "Badge text", multiline: false },
] as const;

export type CampaignTextField =
  (typeof campaignTranslationFields)[number]["key"];

export type CampaignTranslationValues = Record<CampaignTextField, string>;

export type CampaignTranslationsByLocale = Record<
  StorefrontLocale,
  CampaignTranslationValues
>;

export type CampaignTranslationFormErrors = {
  form?: string;
  locales?: Partial<
    Record<StorefrontLocale, Partial<Record<CampaignTextField, string>>>
  >;
};

export const emptyCampaignTranslationValues: CampaignTranslationValues = {
  headline: "",
  subheadline: "",
  ctaText: "",
  ctaUrl: "",
  expiredText: "",
  freeShippingEmptyText: "",
  freeShippingProgressText: "",
  freeShippingSuccessText: "",
  deliveryBeforeCutoffText: "",
  deliveryAfterCutoffText: "",
  lowStockText: "",
  badgeText: "",
};

export function createEmptyCampaignTranslationsByLocale(): CampaignTranslationsByLocale {
  return storefrontLocales.reduce((translations, localeOption) => {
    translations[localeOption.locale] = { ...emptyCampaignTranslationValues };
    return translations;
  }, {} as CampaignTranslationsByLocale);
}

export function translationInputName(
  locale: StorefrontLocale,
  field: CampaignTextField,
) {
  return `translation.${locale}.${field}`;
}
