import { describe, expect, it } from "vitest";

import {
  buildCampaignAiFollowUpQuestions,
  buildDefaultCampaignAiInput,
  createMockCampaignAiProvider,
  generateCampaignSuggestion,
  generateTranslations,
  parseAppliedCampaignSuggestion,
  parseCampaignAiFormData,
  shouldAskCampaignAiFollowUpQuestions,
  type CampaignAiProvider,
} from "./campaignGenerator.server";
import { AI_CAMPAIGN_SYSTEM_PROMPT } from "./campaignPrompts.server";

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
    expect(suggestion.variants).toHaveLength(0);
  });

  it("does not ask the campaign assistant provider for variants", () => {
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).not.toContain('"variants"');
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).not.toContain("variants");
  });

  it("does not apply a suggestion when the save form has no reviewed payload", () => {
    expect(parseAppliedCampaignSuggestion(null)).toBeNull();
    expect(parseAppliedCampaignSuggestion("")).toBeNull();
  });

  it("falls back to English for unsupported requested locales", async () => {
    const formData = new FormData();
    formData.set("objective", "FLASH_SALE");
    formData.set("campaignNameHint", "Coffee launch");
    formData.set("campaignShape", "product");
    formData.set("productContext", "espresso accessories");
    formData.set("countryCode", "IT");
    formData.set("locale", "it-IT");
    formData.set("brandTone", "minimal");
    formData.set("merchantNotes", "Keep copy compact.");
    formData.set("ctaUrl", "/collections/coffee");

    const parsed = parseCampaignAiFormData(formData);
    const translations = await generateTranslations(parsed.values, undefined, {
      provider: createMockCampaignAiProvider(),
    });

    expect(parsed.values.locale).toBe("en");
    expect(parsed.values.campaignNameHint).toBe("Coffee launch");
    expect(parsed.values.campaignShape).toBe("product");
    expect(parsed.values.merchantNotes).toBe("Keep copy compact.");
    expect(translations.en.headline).toContain("espresso accessories");
    expect(translations.es.ctaText).toBeTruthy();
  });

  it("maps cart and offer input into actionable campaign settings", async () => {
    const suggestion = await generateCampaignSuggestion(
      buildDefaultCampaignAiInput({
        campaignShape: "cart",
        knownOffer: "Free shipping over $75",
        objective: "FREE_SHIPPING",
        productContext: "all products",
      }),
      { provider: createMockCampaignAiProvider() },
    );

    expect(suggestion.campaign.type).toBe("FREE_SHIPPING_GOAL");
    expect(suggestion.campaign.placementTypes).toEqual([
      "CART_DRAWER",
      "CART_PAGE",
    ]);
    expect(suggestion.timer.mode).toBe("FIXED_DATE");
    expect(suggestion.discount.valueType).toBe("FREE_SHIPPING");
    expect(suggestion.discount.minimumSubtotal).toBe("75");
    expect(suggestion.freeShipping.thresholdAmount).toBe("75");
    expect(suggestion.targeting.productSelection).toBe("ALL_PRODUCTS");
  });

  it("parses goal answers, quick starts, and follow-up answers from the AI drawer", () => {
    const formData = new FormData();
    formData.set("objective", "FREE_SHIPPING");
    formData.set("campaignNameHint", "Shipping push");
    formData.set("campaignShape", "cart");
    formData.set(
      "goalAnswersJson",
      JSON.stringify({
        free_shipping_threshold: [
          "free_shipping_threshold_100",
          "free_shipping_threshold_100",
        ],
      }),
    );
    formData.set("productContext", "all products");
    formData.set("countryCode", "US");
    formData.set("locale", "en");
    formData.set("brandTone", "premium");
    formData.set(
      "quickStartsJson",
      JSON.stringify(["Free shipping threshold", "Free shipping threshold"]),
    );
    formData.set(
      "followUpAnswersJson",
      JSON.stringify({
        free_shipping_threshold: ["free_shipping_threshold_75"],
      }),
    );
    formData.set("ctaUrl", "/collections/all");

    const parsed = parseCampaignAiFormData(formData);

    expect(parsed.errors).toEqual({});
    expect(parsed.values.goalAnswers).toEqual({
      free_shipping_threshold: ["free_shipping_threshold_100"],
    });
    expect(parsed.values.quickStarts).toEqual(["Free shipping threshold"]);
    expect(parsed.values.followUpAnswers).toEqual({
      free_shipping_threshold: ["free_shipping_threshold_75"],
    });
  });

  it("asks one optional follow-up batch when required context is missing", () => {
    const input = buildDefaultCampaignAiInput({
      goalAnswers: {},
      knownOffer: "",
      objective: "FLASH_SALE",
      productContext: "jackets",
    });

    const questions = buildCampaignAiFollowUpQuestions(input);

    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe("flash_sale_offer");
    expect(questions[0].options.map((option) => option.id)).toContain(
      "flash_sale_20_percent",
    );
    expect(shouldAskCampaignAiFollowUpQuestions(input, null)).toBe(true);
    expect(shouldAskCampaignAiFollowUpQuestions(input, "answered")).toBe(false);
  });

  it("uses follow-up answers to generate concrete offer settings", async () => {
    const suggestion = await generateCampaignSuggestion(
      buildDefaultCampaignAiInput({
        followUpAnswers: {
          flash_sale_offer: ["flash_sale_20_percent"],
        },
        knownOffer: "",
        objective: "FLASH_SALE",
        productContext: "jackets",
      }),
      { provider: createMockCampaignAiProvider() },
    );

    expect(suggestion.campaign.headline).toContain("20% off");
    expect(suggestion.campaign.ctaText).toBe("Shop offer");
    expect(suggestion.discount.valueType).toBe("PERCENTAGE");
    expect(suggestion.discount.value).toBe("20");
    expect(buildCampaignAiFollowUpQuestions(suggestion.input)).toHaveLength(0);
  });

  it("maps goal flow answers into campaign defaults", async () => {
    const suggestion = await generateCampaignSuggestion(
      buildDefaultCampaignAiInput({
        goalAnswers: {
          free_shipping_threshold: ["free_shipping_threshold_100"],
          free_shipping_scope: ["free_shipping_top_bar"],
        },
        knownOffer: "",
        objective: "FREE_SHIPPING",
        productContext: "all products",
      }),
      { provider: createMockCampaignAiProvider() },
    );

    expect(suggestion.campaign.headline).toContain("Free shipping over $100");
    expect(suggestion.campaign.placementTypes).toEqual([
      "CART_DRAWER",
      "CART_PAGE",
      "TOP_BAR",
    ]);
    expect(suggestion.discount.valueType).toBe("FREE_SHIPPING");
    expect(suggestion.discount.minimumSubtotal).toBe("100");
    expect(suggestion.freeShipping.thresholdAmount).toBe("100");
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
    ]
      .join(" ")
      .toLowerCase();

    expect(suggestion.variants).toHaveLength(0);
    expect(visibleCopy).not.toContain("only 3 left");
    expect(visibleCopy).not.toContain("50% off");
    expect(visibleCopy).not.toContain("low stock");
    expect(suggestion.safety.blockedClaims.length).toBeGreaterThan(0);
    expect(suggestion.safety.requiresReview).toBe(true);
  });
});
