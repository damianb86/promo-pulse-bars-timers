import {
  defaultEnabledStorefrontLocales,
  storefrontLocales,
} from "./localization";

export const supportedStorefrontLocales = storefrontLocales.map(
  (localeOption) => localeOption.locale,
);

export const storefrontLocaleLabels: Record<string, string> =
  Object.fromEntries(
    storefrontLocales.map((localeOption) => [
      localeOption.locale,
      localeOption.label,
    ]),
  );

export const defaultShopEnabledLocales = defaultEnabledStorefrontLocales;
