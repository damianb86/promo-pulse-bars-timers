export type StorefrontLocale = string;

export type StorefrontLocaleOption = {
  flag: string;
  label: string;
  locale: StorefrontLocale;
  shortLabel: string;
};

export const storefrontLocales: StorefrontLocaleOption[] = [
  { locale: "en", label: "English", shortLabel: "EN", flag: "US" },
  { locale: "es", label: "Spanish", shortLabel: "ES", flag: "ES" },
  { locale: "pt-BR", label: "Portuguese BR", shortLabel: "PT", flag: "BR" },
  { locale: "fr", label: "French", shortLabel: "FR", flag: "FR" },
  { locale: "de", label: "German", shortLabel: "DE", flag: "DE" },
  { locale: "it", label: "Italian", shortLabel: "IT", flag: "IT" },
  { locale: "nl", label: "Dutch", shortLabel: "NL", flag: "NL" },
  { locale: "da", label: "Danish", shortLabel: "DA", flag: "DK" },
  { locale: "sv", label: "Swedish", shortLabel: "SV", flag: "SE" },
  { locale: "no", label: "Norwegian", shortLabel: "NO", flag: "NO" },
  { locale: "fi", label: "Finnish", shortLabel: "FI", flag: "FI" },
  { locale: "pl", label: "Polish", shortLabel: "PL", flag: "PL" },
  { locale: "cs", label: "Czech", shortLabel: "CS", flag: "CZ" },
  { locale: "sk", label: "Slovak", shortLabel: "SK", flag: "SK" },
  { locale: "hu", label: "Hungarian", shortLabel: "HU", flag: "HU" },
  { locale: "ro", label: "Romanian", shortLabel: "RO", flag: "RO" },
  { locale: "bg", label: "Bulgarian", shortLabel: "BG", flag: "BG" },
  { locale: "el", label: "Greek", shortLabel: "EL", flag: "GR" },
  { locale: "tr", label: "Turkish", shortLabel: "TR", flag: "TR" },
  { locale: "ru", label: "Russian", shortLabel: "RU", flag: "RU" },
  { locale: "uk", label: "Ukrainian", shortLabel: "UK", flag: "UA" },
  { locale: "ar", label: "Arabic", shortLabel: "AR", flag: "AR" },
  { locale: "he", label: "Hebrew", shortLabel: "HE", flag: "IL" },
  { locale: "ja", label: "Japanese", shortLabel: "JA", flag: "JP" },
  { locale: "ko", label: "Korean", shortLabel: "KO", flag: "KR" },
  {
    locale: "zh-CN",
    label: "Chinese Simplified",
    shortLabel: "ZH",
    flag: "CN",
  },
  {
    locale: "zh-TW",
    label: "Chinese Traditional",
    shortLabel: "ZT",
    flag: "TW",
  },
  { locale: "hi", label: "Hindi", shortLabel: "HI", flag: "IN" },
  { locale: "id", label: "Indonesian", shortLabel: "ID", flag: "ID" },
  { locale: "ms", label: "Malay", shortLabel: "MS", flag: "MY" },
  { locale: "th", label: "Thai", shortLabel: "TH", flag: "TH" },
  { locale: "vi", label: "Vietnamese", shortLabel: "VI", flag: "VN" },
  { locale: "fil", label: "Filipino", shortLabel: "FIL", flag: "PH" },
];

export const defaultStorefrontLocale: StorefrontLocale = "en";

export const defaultEnabledStorefrontLocales: StorefrontLocale[] = [
  "en",
  "es",
  "pt-BR",
  "fr",
  "de",
];

const storefrontLocaleByNormalizedCode = new Map(
  storefrontLocales.map((localeOption) => [
    normalizeLocaleToken(localeOption.locale),
    localeOption,
  ]),
);

const storefrontLocaleByLanguage = new Map<string, StorefrontLocaleOption>();

for (const localeOption of storefrontLocales) {
  const language = normalizeLocaleToken(localeOption.locale).split("-")[0];

  if (!storefrontLocaleByLanguage.has(language)) {
    storefrontLocaleByLanguage.set(language, localeOption);
  }
}

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

export function createEmptyCampaignTranslationsByLocale(
  localeOptions: readonly StorefrontLocaleOption[] = storefrontLocales,
): CampaignTranslationsByLocale {
  return localeOptions.reduce((translations, localeOption) => {
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

export function translationFallbackInputName(
  locale: StorefrontLocale,
  field: CampaignTextField,
) {
  return `translationFallback.${locale}.${field}`;
}

export function getStorefrontLocaleOptions(
  locales?: readonly string[] | null,
): StorefrontLocaleOption[] {
  if (!locales?.length) return storefrontLocales;

  const options = locales
    .map((locale) => getStorefrontLocaleOption(locale))
    .filter((option): option is StorefrontLocaleOption => Boolean(option));

  const uniqueOptions = Array.from(
    new Map(options.map((option) => [option.locale, option])).values(),
  );

  return uniqueOptions.length > 0
    ? uniqueOptions
    : storefrontLocales.filter(
        (localeOption) => localeOption.locale === defaultStorefrontLocale,
      );
}

export function getStorefrontLocaleOption(
  locale: string | null | undefined,
): StorefrontLocaleOption | null {
  const normalized = normalizeStorefrontLocaleCode(locale);

  return normalized
    ? (storefrontLocales.find((option) => option.locale === normalized) ?? null)
    : null;
}

export function getStorefrontLocaleLabel(locale: string) {
  return getStorefrontLocaleOption(locale)?.label ?? locale;
}

export function isSupportedStorefrontLocale(locale: string) {
  return Boolean(getStorefrontLocaleOption(locale));
}

export function normalizeStorefrontLocaleCode(
  locale: string | null | undefined,
): StorefrontLocale | null {
  const normalized = normalizeLocaleToken(locale);
  if (!normalized) return null;

  if (normalized === "pt") return "pt-BR";
  if (normalized === "zh") return "zh-CN";

  const exact = storefrontLocaleByNormalizedCode.get(normalized);
  if (exact) return exact.locale;

  return (
    storefrontLocaleByLanguage.get(normalized.split("-")[0])?.locale ?? null
  );
}

function normalizeLocaleToken(locale: string | null | undefined) {
  return locale?.trim().replace("_", "-").toLowerCase() ?? "";
}
