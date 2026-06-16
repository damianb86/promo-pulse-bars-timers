import { describe, expect, it } from "vitest";

import {
  applySettingsToStorefrontContext,
  defaultShopSettingsValues,
  parseShopSettingsFormData,
  serializePublicShopSettings,
  validateShopSettingsValues,
} from "./shopSettings.server";

describe("shop settings", () => {
  it("defines safe defaults for new shops", () => {
    expect(defaultShopSettingsValues).toMatchObject({
      defaultLocale: "en",
      enabledLocales: ["en", "es", "pt-BR", "fr", "de"],
      defaultTimezone: "UTC",
      defaultCurrency: "USD",
      analyticsEnabled: true,
      respectDoNotTrack: true,
      consentMode: "BASIC",
    });
  });

  it("validates locale, timezone, currency, country, email, and selectors", () => {
    const errors = validateShopSettingsValues({
      ...defaultShopSettingsValues,
      defaultTimezone: "Mars/Base",
      defaultCurrency: "US",
      defaultCountry: "USA",
      supportEmail: "not-email",
      customCartDrawerSelector: "<script>",
    });

    expect(errors).toMatchObject({
      defaultTimezone: "Enter a valid IANA timezone.",
      defaultCurrency: "Currency must be a 3-letter ISO code.",
      defaultCountry: "Country must be a 2-letter ISO code.",
      supportEmail: "Enter a valid support email.",
      customCartDrawerSelector: "Enter a valid CSS selector.",
    });
  });

  it("parses form values and keeps the default locale enabled", () => {
    const formData = new FormData();
    formData.set("defaultLocale", "es");
    formData.append("enabledLocales", "en");
    formData.set("defaultTimezone", "America/New_York");
    formData.set("defaultCurrency", "usd");
    formData.set("defaultCountry", "us");
    formData.set("analyticsEnabled", "on");
    formData.set("respectDoNotTrack", "on");
    formData.set("consentMode", "STRICT");

    const parsed = parseShopSettingsFormData(formData);

    expect(parsed.errors).toEqual({});
    expect(parsed.values).toMatchObject({
      defaultLocale: "es",
      enabledLocales: ["es", "en"],
      defaultTimezone: "America/New_York",
      defaultCurrency: "USD",
      defaultCountry: "US",
      analyticsEnabled: true,
      respectDoNotTrack: true,
      consentMode: "STRICT",
    });
  });

  it("serializes storefront-safe settings", () => {
    expect(serializePublicShopSettings(defaultShopSettingsValues)).toEqual(
      expect.objectContaining({
        defaultLocale: "en",
        customCartDrawerSelector: "",
        analyticsEnabled: true,
      }),
    );
  });

  it("falls back to default locale when storefront locale is disabled", () => {
    expect(
      applySettingsToStorefrontContext(
        { locale: "fr", country: "", currency: "" },
        {
          ...defaultShopSettingsValues,
          defaultLocale: "es",
          enabledLocales: ["es", "en"],
          defaultCountry: "AR",
          defaultCurrency: "ARS",
        },
      ),
    ).toEqual({
      locale: "es",
      country: "AR",
      currency: "ARS",
    });
  });
});
