import { ConsentMode, type ShopSettings } from "@prisma/client";

import prisma from "../db.server";
import { supportedStorefrontLocales } from "../types/shop-settings";

export type ShopSettingsValues = {
  defaultLocale: string;
  enabledLocales: string[];
  defaultTimezone: string;
  defaultCurrency: string;
  enableDebugMode: boolean;
  brandName: string;
  supportEmail: string;
  defaultCountry: string;
  customCartDrawerSelector: string;
  customCartPageSelector: string;
  customProductFormSelector: string;
  analyticsEnabled: boolean;
  respectDoNotTrack: boolean;
  consentMode: ConsentMode;
};

export type ShopSettingsErrors = Partial<
  Record<keyof ShopSettingsValues, string>
> & {
  form?: string;
};

export type ParsedShopSettingsForm = {
  values: ShopSettingsValues;
  errors: ShopSettingsErrors;
};

export type PublicShopSettings = Pick<
  ShopSettingsValues,
  | "defaultLocale"
  | "enabledLocales"
  | "defaultTimezone"
  | "defaultCurrency"
  | "enableDebugMode"
  | "brandName"
  | "defaultCountry"
  | "customCartDrawerSelector"
  | "customCartPageSelector"
  | "customProductFormSelector"
  | "analyticsEnabled"
  | "respectDoNotTrack"
  | "consentMode"
>;

export const defaultShopSettingsValues: ShopSettingsValues = {
  defaultLocale: "en",
  enabledLocales: supportedStorefrontLocales,
  defaultTimezone: "UTC",
  defaultCurrency: "USD",
  enableDebugMode: false,
  brandName: "Promo Pulse",
  supportEmail: "",
  defaultCountry: "",
  customCartDrawerSelector: "",
  customCartPageSelector: "",
  customProductFormSelector: "",
  analyticsEnabled: true,
  respectDoNotTrack: true,
  consentMode: "BASIC",
};

const maxLengths: Partial<Record<keyof ShopSettingsValues, number>> = {
  defaultTimezone: 80,
  defaultCurrency: 3,
  brandName: 80,
  defaultCountry: 2,
  customCartDrawerSelector: 255,
  customCartPageSelector: 255,
  customProductFormSelector: 255,
};

export function getOrCreateShopSettings(shopId: string) {
  return prisma.shopSettings.upsert({
    where: { shopId },
    update: {},
    create: {
      shopId,
      ...toPrismaSettingsInput(defaultShopSettingsValues),
    },
  });
}

export async function getShopSettingsOrDefaults(shopId: string) {
  const settings = await prisma.shopSettings.findUnique({
    where: { shopId },
  });

  return settings ? toShopSettingsValues(settings) : defaultShopSettingsValues;
}

export async function updateShopSettings(
  shopId: string,
  values: ShopSettingsValues,
) {
  const settings = await prisma.shopSettings.upsert({
    where: { shopId },
    update: toPrismaSettingsInput(values),
    create: {
      shopId,
      ...toPrismaSettingsInput(values),
    },
  });

  return toShopSettingsValues(settings);
}

export function parseShopSettingsFormData(
  formData: FormData,
): ParsedShopSettingsForm {
  const enabledLocales = normalizeEnabledLocales(
    formData.getAll("enabledLocales").map(String),
  );
  const defaultLocale = normalizeLocale(
    readString(formData, "defaultLocale"),
    defaultShopSettingsValues.defaultLocale,
  );
  const values: ShopSettingsValues = {
    defaultLocale,
    enabledLocales:
      enabledLocales.length > 0 ? enabledLocales : [defaultLocale],
    defaultTimezone:
      readString(formData, "defaultTimezone") ||
      defaultShopSettingsValues.defaultTimezone,
    defaultCurrency:
      readString(formData, "defaultCurrency").toUpperCase() ||
      defaultShopSettingsValues.defaultCurrency,
    enableDebugMode: readBoolean(formData, "enableDebugMode"),
    brandName: readString(formData, "brandName"),
    supportEmail: readString(formData, "supportEmail"),
    defaultCountry: readString(formData, "defaultCountry").toUpperCase(),
    customCartDrawerSelector: readString(formData, "customCartDrawerSelector"),
    customCartPageSelector: readString(formData, "customCartPageSelector"),
    customProductFormSelector: readString(
      formData,
      "customProductFormSelector",
    ),
    analyticsEnabled: readBoolean(formData, "analyticsEnabled"),
    respectDoNotTrack: readBoolean(formData, "respectDoNotTrack"),
    consentMode:
      readString(formData, "consentMode") === ConsentMode.STRICT
        ? ConsentMode.STRICT
        : ConsentMode.BASIC,
  };

  if (!values.enabledLocales.includes(values.defaultLocale)) {
    values.enabledLocales.unshift(values.defaultLocale);
  }

  return {
    values,
    errors: validateShopSettingsValues(values),
  };
}

export function validateShopSettingsValues(values: ShopSettingsValues) {
  const errors: ShopSettingsErrors = {};

  if (!supportedStorefrontLocales.includes(values.defaultLocale)) {
    errors.defaultLocale = "Choose a supported default locale.";
  }

  if (values.enabledLocales.length === 0) {
    errors.enabledLocales = "Enable at least one storefront locale.";
  }

  if (
    values.enabledLocales.some(
      (locale) => !supportedStorefrontLocales.includes(locale),
    )
  ) {
    errors.enabledLocales = "Enabled locales must be supported.";
  }

  if (!isValidTimezone(values.defaultTimezone)) {
    errors.defaultTimezone = "Enter a valid IANA timezone.";
  }

  if (!/^[A-Z]{3}$/.test(values.defaultCurrency)) {
    errors.defaultCurrency = "Currency must be a 3-letter ISO code.";
  }

  if (values.defaultCountry && !/^[A-Z]{2}$/.test(values.defaultCountry)) {
    errors.defaultCountry = "Country must be a 2-letter ISO code.";
  }

  for (const selectorField of [
    "customCartDrawerSelector",
    "customCartPageSelector",
    "customProductFormSelector",
  ] as const) {
    if (
      values[selectorField] &&
      !isReasonableCssSelector(values[selectorField])
    ) {
      errors[selectorField] = "Enter a valid CSS selector.";
    }
  }

  for (const [field, maxLength] of Object.entries(maxLengths)) {
    const value = values[field as keyof ShopSettingsValues];

    if (
      typeof value === "string" &&
      maxLength &&
      value.length > maxLength &&
      !errors[field as keyof ShopSettingsValues]
    ) {
      errors[field as keyof ShopSettingsValues] =
        `Must be ${maxLength} characters or fewer.`;
    }
  }

  return errors;
}

export function hasShopSettingsErrors(errors: ShopSettingsErrors) {
  return Object.keys(errors).length > 0;
}

export function toShopSettingsValues(
  settings: ShopSettings | ShopSettingsValues,
): ShopSettingsValues {
  return {
    ...defaultShopSettingsValues,
    ...settings,
    enabledLocales: normalizeEnabledLocales(
      Array.isArray(settings.enabledLocales)
        ? settings.enabledLocales.map(String)
        : defaultShopSettingsValues.enabledLocales,
    ),
    brandName: settings.brandName ?? "",
    supportEmail: settings.supportEmail ?? "",
    defaultCountry: settings.defaultCountry ?? "",
    customCartDrawerSelector: settings.customCartDrawerSelector ?? "",
    customCartPageSelector: settings.customCartPageSelector ?? "",
    customProductFormSelector: settings.customProductFormSelector ?? "",
  };
}

export function serializePublicShopSettings(
  settings: ShopSettingsValues,
): PublicShopSettings {
  return {
    defaultLocale: settings.defaultLocale,
    enabledLocales: settings.enabledLocales,
    defaultTimezone: settings.defaultTimezone,
    defaultCurrency: settings.defaultCurrency,
    enableDebugMode: settings.enableDebugMode,
    brandName: settings.brandName,
    defaultCountry: settings.defaultCountry,
    customCartDrawerSelector: settings.customCartDrawerSelector,
    customCartPageSelector: settings.customCartPageSelector,
    customProductFormSelector: settings.customProductFormSelector,
    analyticsEnabled: settings.analyticsEnabled,
    respectDoNotTrack: settings.respectDoNotTrack,
    consentMode: settings.consentMode,
  };
}

export function applySettingsToStorefrontContext<
  Context extends {
    locale: string;
    country: string;
    currency: string;
  },
>(context: Context, settings: ShopSettingsValues): Context {
  const locale = settings.enabledLocales.includes(context.locale)
    ? context.locale
    : settings.defaultLocale;

  return {
    ...context,
    locale: locale || settings.defaultLocale,
    country: context.country || settings.defaultCountry,
    currency: context.currency || settings.defaultCurrency,
  };
}

function toPrismaSettingsInput(values: ShopSettingsValues) {
  return {
    defaultLocale: values.defaultLocale,
    enabledLocales: values.enabledLocales,
    defaultTimezone: values.defaultTimezone,
    defaultCurrency: values.defaultCurrency,
    enableDebugMode: values.enableDebugMode,
    brandName: nullableString(values.brandName),
    supportEmail: nullableString(values.supportEmail),
    defaultCountry: nullableString(values.defaultCountry),
    customCartDrawerSelector: nullableString(values.customCartDrawerSelector),
    customCartPageSelector: nullableString(values.customCartPageSelector),
    customProductFormSelector: nullableString(values.customProductFormSelector),
    analyticsEnabled: values.analyticsEnabled,
    respectDoNotTrack: values.respectDoNotTrack,
    consentMode: values.consentMode,
  };
}

function normalizeEnabledLocales(locales: string[]) {
  const normalized = locales
    .map((locale) => normalizeLocale(locale, ""))
    .filter(Boolean)
    .filter((locale) => supportedStorefrontLocales.includes(locale));

  return Array.from(new Set(normalized));
}

function normalizeLocale(value: string, fallback: string) {
  const normalized = value.trim().replace("_", "-").toLowerCase();

  if (normalized === "pt-br" || normalized === "pt") return "pt-BR";

  return supportedStorefrontLocales.includes(normalized)
    ? normalized
    : fallback;
}

function readString(formData: FormData, key: keyof ShopSettingsValues) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(formData: FormData, key: keyof ShopSettingsValues) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function isValidTimezone(value: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isReasonableCssSelector(value: string) {
  if (!value || value.length > 255) return false;

  return (
    !/[<>]/.test(value) &&
    !/javascript:/i.test(value) &&
    /^[#.:[\]\-_=*~|^$'"(),\s>a-zA-Z0-9]+$/.test(value)
  );
}

function nullableString(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}
