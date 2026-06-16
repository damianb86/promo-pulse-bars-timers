import { describe, expect, it } from "vitest";

import {
  buildDefaultCampaignTranslations,
  getCampaignText,
  getCampaignTranslationsViewModel,
  normalizeStorefrontLocale,
} from "./campaign-localization";

describe("campaign localization fallback", () => {
  it("uses the requested locale when it has text", () => {
    expect(
      getCampaignText(
        {
          translations: [
            { locale: "en", headline: "English headline" },
            { locale: "es", headline: "Spanish headline" },
          ],
        },
        "es",
        "headline",
      ),
    ).toBe("Spanish headline");
  });

  it("falls back to English when the requested locale is missing", () => {
    expect(
      getCampaignText(
        {
          translations: [{ locale: "en", headline: "English headline" }],
        },
        "es",
        "headline",
      ),
    ).toBe("English headline");
  });

  it("falls back to the first available translation when English is missing", () => {
    expect(
      getCampaignText(
        {
          translations: [
            { locale: "fr", headline: "" },
            { locale: "de", headline: "German headline" },
          ],
        },
        "es",
        "headline",
      ),
    ).toBe("German headline");
  });

  it("normalizes regional locale variants", () => {
    expect(normalizeStorefrontLocale("es-AR")).toBe("es");
    expect(normalizeStorefrontLocale("pt_BR")).toBe("pt-BR");
    expect(normalizeStorefrontLocale("de-DE")).toBe("de");
    expect(normalizeStorefrontLocale("it")).toBeNull();
  });
});

describe("campaign localization view model", () => {
  it("keeps raw edit values separate from resolved fallback values", () => {
    const viewModel = getCampaignTranslationsViewModel({
      translations: [{ locale: "en", headline: "English headline" }],
    });

    expect(viewModel.values.es.headline).toBe("");
    expect(viewModel.resolvedValues.es.headline).toBe("English headline");
  });
});

describe("campaign default translations", () => {
  it("creates all mandatory storefront locales", () => {
    const translations = buildDefaultCampaignTranslations({
      goal: "FREE_SHIPPING",
      type: "FREE_SHIPPING_GOAL",
    });

    expect(translations.map((translation) => translation.locale)).toEqual([
      "en",
      "es",
      "pt-BR",
      "fr",
      "de",
    ]);
    expect(
      translations.find((translation) => translation.locale === "en"),
    ).toMatchObject({
      headline: "You are close to free shipping",
      freeShippingProgressText: "You're {{amount}} away from free shipping",
      freeShippingSuccessText: "You've unlocked free shipping!",
    });
  });

  it("uses non-empty merchant-provided English copy over defaults", () => {
    const translations = buildDefaultCampaignTranslations({
      goal: "FLASH_SALE",
      type: "COUNTDOWN_BAR",
      overrides: {
        en: {
          headline: "Merchant headline",
          subheadline: "",
          ctaText: "Shop custom",
          ctaUrl: "/collections/custom",
        },
      },
    });

    expect(translations[0]).toMatchObject({
      locale: "en",
      headline: "Merchant headline",
      subheadline: "Save before the timer runs out.",
      ctaText: "Shop custom",
      ctaUrl: "/collections/custom",
    });
  });
});
