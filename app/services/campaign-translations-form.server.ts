import {
  campaignTranslationFields,
  createEmptyCampaignTranslationsByLocale,
  getStorefrontLocaleOptions,
  translationInputName,
  type CampaignTextField,
  type CampaignTranslationFormErrors,
  type CampaignTranslationValues,
  type CampaignTranslationsByLocale,
  type StorefrontLocale,
} from "../types/localization";

export type ParsedCampaignTranslationsForm = {
  values: CampaignTranslationsByLocale;
  errors: CampaignTranslationFormErrors;
  translations: Array<CampaignTranslationValues & { locale: StorefrontLocale }>;
};

const maxTextLength = 500;

export function parseCampaignTranslationsFormData(
  formData: FormData,
  locales?: readonly string[],
): ParsedCampaignTranslationsForm {
  const localeOptions = readTranslationLocaleOptions(formData, locales);
  const values = createEmptyCampaignTranslationsByLocale(localeOptions);
  const errors: CampaignTranslationFormErrors = {};

  for (const localeOption of localeOptions) {
    for (const field of campaignTranslationFields) {
      const value = readString(
        formData,
        translationInputName(localeOption.locale, field.key),
      );
      values[localeOption.locale][field.key] = value;

      if (value.length > maxTextLength) {
        addFieldError(
          errors,
          localeOption.locale,
          field.key,
          `Keep ${field.label.toLowerCase()} under ${maxTextLength} characters.`,
        );
      }
    }
  }

  return {
    values,
    errors,
    translations: localeOptions.map(({ locale }) => ({
      locale,
      ...values[locale],
    })),
  };
}

export type BaseCampaignTranslationValues = Pick<
  CampaignTranslationValues,
  "headline" | "subheadline" | "ctaText" | "ctaUrl" | "expiredText"
>;

export function syncBaseCampaignTranslationValues(
  parsed: ParsedCampaignTranslationsForm,
  baseValues: BaseCampaignTranslationValues,
  baseLocale: StorefrontLocale = "en",
): ParsedCampaignTranslationsForm {
  const locale = parsed.values[baseLocale]
    ? baseLocale
    : parsed.translations[0]?.locale;

  if (!locale) return parsed;

  const values = {
    ...parsed.values,
    [locale]: {
      ...parsed.values[locale],
      ...baseValues,
    },
  };

  return {
    ...parsed,
    values,
    translations: parsed.translations.map((translation) =>
      translation.locale === locale
        ? {
            ...translation,
            ...baseValues,
          }
        : translation,
    ),
  };
}

export function hasCampaignTranslationErrors(
  errors: CampaignTranslationFormErrors,
) {
  return Boolean(
    errors.form ||
    Object.values(errors.locales ?? {}).some(
      (localeErrors) => Object.keys(localeErrors ?? {}).length > 0,
    ),
  );
}

function readString(formData: FormData, key: string) {
  const values = formData.getAll(key);
  const value = values.length > 0 ? values[values.length - 1] : "";
  return typeof value === "string" ? value.trim() : "";
}

function readTranslationLocaleOptions(
  formData: FormData,
  locales?: readonly string[],
) {
  if (locales) return getStorefrontLocaleOptions(locales);

  const formLocales = formData.getAll("translationLocale").map(String);

  return getStorefrontLocaleOptions(formLocales);
}

function addFieldError(
  errors: CampaignTranslationFormErrors,
  locale: StorefrontLocale,
  field: CampaignTextField,
  message: string,
) {
  errors.locales ??= {};
  errors.locales[locale] ??= {};
  errors.locales[locale][field] = message;
}
