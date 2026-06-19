import { describe, expect, it } from "vitest";

import {
  buildDefaultCampaignAiInput,
  createMockCampaignAiProvider,
  generateCampaignSuggestion,
  generateTranslations,
  parseAppliedCampaignSuggestion,
  parseCampaignAiFormData,
  type CampaignAiProvider,
} from "./campaignGenerator.server";

describe("AI campaign generator", () => {
  it("generates deterministic mock campaign suggestions", async () => {
    const input = buildDefaultCampaignAiInput({
      brandTone: "urgent",
      eventName: "Spring launch",
      knownOffer: "15% off",
      productContext: "running shoes",
    });

    const suggestion = await generateCampaignSuggestion(input, {
      provider: createMockCampaignAiProvider(),
    });

    expect(suggestion.source).toBe("mock");
    expect(suggestion.campaign.status).toBe("DRAFT");
    expect(suggestion.campaign.headline).toContain("15% off");
    expect(suggestion.design.templateKey).toBe("flash-sale");
    expect(suggestion.translations.es.headline).toContain("running shoes");
    expect(suggestion.variants).toHaveLength(3);
  });

  it("does not apply a suggestion when the save form has no reviewed payload", () => {
    expect(parseAppliedCampaignSuggestion(null)).toBeNull();
    expect(parseAppliedCampaignSuggestion("")).toBeNull();
  });

  it("falls back to English for unsupported requested locales", async () => {
    const formData = new FormData();
    formData.set("objective", "FLASH_SALE");
    formData.set("productContext", "espresso accessories");
    formData.set("countryCode", "IT");
    formData.set("locale", "it-IT");
    formData.set("brandTone", "minimal");
    formData.set("ctaUrl", "/collections/coffee");

    const parsed = parseCampaignAiFormData(formData);
    const translations = await generateTranslations(parsed.values, undefined, {
      provider: createMockCampaignAiProvider(),
    });

    expect(parsed.values.locale).toBe("en");
    expect(translations.en.headline).toContain("espresso accessories");
    expect(translations.es.ctaText).toBeTruthy();
  });

  it("replaces fake scarcity and unsupported discount claims", async () => {
    const unsafeProvider: CampaignAiProvider = {
      source: "provider",
      async generateCampaignSuggestion() {
        return {
          campaign: {
            headline: "Only 3 left - 50% off today",
            subheadline: "Low stock and free shipping for everyone",
            ctaText: "Get discount",
          },
          translations: {
            en: {
              headline: "Only 3 left",
              subheadline: "50% off and free gift",
              ctaText: "Get discount",
            },
          },
          variants: [
            {
              name: "Only 3 left",
              headline: "Only 3 left",
              subheadline: "50% off now",
              ctaText: "Get discount",
              weight: 50,
            },
            {
              name: "Low stock",
              headline: "Low stock",
              subheadline: "Free gift today",
              ctaText: "Get discount",
              weight: 50,
            },
          ],
        };
      },
    };

    const suggestion = await generateCampaignSuggestion(
      buildDefaultCampaignAiInput({
        knownOffer: "",
        productContext: "wallets",
      }),
      { provider: unsafeProvider },
    );
    const visibleCopy = [
      suggestion.campaign.headline,
      suggestion.campaign.subheadline,
      suggestion.campaign.ctaText,
      suggestion.translations.en.headline,
      suggestion.translations.en.subheadline,
      suggestion.translations.en.ctaText,
      ...suggestion.variants.flatMap((variant) => [
        variant.name,
        variant.headline,
        variant.subheadline,
        variant.ctaText,
      ]),
    ]
      .join(" ")
      .toLowerCase();

    expect(visibleCopy).not.toContain("only 3 left");
    expect(visibleCopy).not.toContain("50% off");
    expect(visibleCopy).not.toContain("low stock");
    expect(suggestion.safety.blockedClaims.length).toBeGreaterThan(0);
    expect(suggestion.safety.requiresReview).toBe(true);
  });
});
