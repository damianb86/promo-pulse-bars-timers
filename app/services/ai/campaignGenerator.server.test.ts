import { describe, expect, it } from "vitest";

import {
  buildCampaignAiFollowUpQuestions,
  buildDefaultCampaignAiInput,
  createMockCampaignAiProvider,
  generateCampaignSuggestion,
  generateTranslations,
  parseAppliedCampaignSuggestion,
  parseCampaignAiFormData,
  parseCampaignAiReferenceImage,
  shouldAskCampaignAiFollowUpQuestions,
  type CampaignAiProvider,
} from "./campaignGenerator.server";
import {
  AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT,
  AI_CAMPAIGN_SYSTEM_PROMPT,
  buildCampaignAiImageUserPrompt,
  buildCampaignAiUserPrompt,
} from "./campaignPrompts.server";

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

  it("asks the provider only for active storefront locales", () => {
    const input = buildDefaultCampaignAiInput({
      locale: "it",
      locales: ["en", "it"],
      productContext: "linen shirts",
    });
    const prompt = buildCampaignAiUserPrompt(input);

    expect(prompt).toContain('"targetLocales": [');
    expect(prompt).toContain('"it"');
    expect(prompt).not.toContain('"de"');
  });

  it("does not apply a suggestion when the save form has no reviewed payload", () => {
    expect(parseAppliedCampaignSuggestion(null)).toBeNull();
    expect(parseAppliedCampaignSuggestion("")).toBeNull();
  });

  it("keeps AI structural HTML/CSS overrides but sanitizes unsafe content", () => {
    const payload = JSON.stringify({
      source: "provider",
      structureHtml:
        '<section class="cp-promo"><script>alert(1)</script>' +
        '<strong data-cp-slot="headline"></strong></section>',
      structureCss:
        "__CP_SCOPE__ .cp-promo{color:red}</style><script>bad()</script>",
    });

    const applied = parseAppliedCampaignSuggestion(payload);

    expect(applied).not.toBeNull();
    expect(applied!.structureHtml).toContain('data-cp-slot="headline"');
    expect(applied!.structureHtml).not.toContain("script");
    expect(applied!.structureCss).toContain("color:red");
    expect(applied!.structureCss).not.toContain("</style>");
  });

  it("exposes structureHtml/structureCss in the provider JSON schema", () => {
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).toContain("structureHtml");
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).toContain("data-cp-slot");
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).toContain("__CP_SCOPE__");
  });

  it("falls back to English for unsupported requested locales", async () => {
    const formData = new FormData();
    formData.set("objective", "FLASH_SALE");
    formData.set("campaignNameHint", "Coffee launch");
    formData.set("campaignShape", "product");
    formData.set("productContext", "espresso accessories");
    formData.set("countryCode", "IT");
    formData.set("locale", "xx-ZZ");
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

  it("builds AI suggestions only for enabled storefront locales", async () => {
    const suggestion = await generateCampaignSuggestion(
      buildDefaultCampaignAiInput({
        locale: "it",
        locales: ["en", "it"],
        productContext: "linen shirts",
      }),
      { provider: createMockCampaignAiProvider() },
    );

    expect(Object.keys(suggestion.translations)).toEqual(["en", "it"]);
    expect(suggestion.translations.it.headline).toContain("linen shirts");
    expect(suggestion.translations.es).toBeUndefined();
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

describe("AI campaign reference image", () => {
  // 1x1 transparent PNG.
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMEAQEY1Jl5AAAAAElFTkSuQmCC";

  function formDataWithImage(dataUrl: string) {
    const formData = new FormData();
    formData.set("referenceImageDataUrl", dataUrl);
    return formData;
  }

  it("accepts a valid base64 PNG data URL", () => {
    const result = parseCampaignAiReferenceImage(
      formDataWithImage(`data:image/png;base64,${pngBase64}`),
    );

    expect(result.error).toBeUndefined();
    expect(result.image?.mimeType).toBe("image/png");
    expect(result.image?.dataUrl).toContain("data:image/png;base64,");
  });

  it("returns no image and no error when nothing was uploaded", () => {
    const result = parseCampaignAiReferenceImage(new FormData());

    expect(result.image).toBeNull();
    expect(result.error).toBeUndefined();
  });

  it("rejects unsupported mime types", () => {
    const result = parseCampaignAiReferenceImage(
      formDataWithImage(`data:image/gif;base64,${pngBase64}`),
    );

    expect(result.image).toBeNull();
    expect(result.error).toContain("Unsupported image type");
  });

  it("rejects malformed data URLs", () => {
    const result = parseCampaignAiReferenceImage(
      formDataWithImage("not-a-data-url"),
    );

    expect(result.image).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("rejects images over the size limit", () => {
    const hugeBase64 = "A".repeat(8 * 1024 * 1024);
    const result = parseCampaignAiReferenceImage(
      formDataWithImage(`data:image/png;base64,${hugeBase64}`),
    );

    expect(result.image).toBeNull();
    expect(result.error).toContain("too large");
  });

  it("makes product context optional when requireProductContext is false", () => {
    const formData = new FormData();
    formData.set("objective", "FLASH_SALE");
    formData.set("ctaUrl", "/collections/all");

    const required = parseCampaignAiFormData(formData);
    const optional = parseCampaignAiFormData(formData, {
      requireProductContext: false,
    });

    expect(required.errors.productContext).toBeTruthy();
    expect(optional.errors.productContext).toBeUndefined();
  });

  it("passes the reference image to the provider and keeps its visual overrides", async () => {
    let receivedContext: { referenceImage?: { mimeType: string } } | undefined;
    const imageProvider: CampaignAiProvider = {
      source: "provider",
      async generateCampaignSuggestion(_input, context) {
        receivedContext = context;
        return {
          design: {
            backgroundType: "SOLID",
            backgroundColor: "#FF00AA",
            titleColor: "#102030",
          },
        };
      },
    };

    const suggestion = await generateCampaignSuggestion(
      buildDefaultCampaignAiInput({ productContext: "sneakers" }),
      {
        provider: imageProvider,
        referenceImage: {
          dataUrl: "data:image/png;base64,abc",
          mimeType: "image/png",
        },
      },
    );

    expect(receivedContext?.referenceImage?.mimeType).toBe("image/png");
    expect(suggestion.referenceImageUsed).toBe(true);
    expect(suggestion.design.backgroundColor).toBe("#FF00AA");
    expect(suggestion.design.titleColor).toBe("#102030");
  });

  it("strips visual overrides for the text-only flow", async () => {
    const colorfulProvider: CampaignAiProvider = {
      source: "provider",
      async generateCampaignSuggestion() {
        return {
          design: {
            backgroundType: "SOLID",
            backgroundColor: "#FF00AA",
          },
        };
      },
    };

    const suggestion = await generateCampaignSuggestion(
      buildDefaultCampaignAiInput({ productContext: "sneakers" }),
      { provider: colorfulProvider },
    );

    expect(suggestion.referenceImageUsed).toBe(false);
    expect(suggestion.design.backgroundColor).not.toBe("#FF00AA");
  });

  it("builds an image system prompt that allows visual overrides and lists settings", () => {
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain("REFERENCE IMAGE MODE");
    // Reuses the base prompt + the design settings catalog.
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain(
      "Promo Pulse AI Campaign Builder",
    );
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain(
      "Design settings catalog",
    );
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain("backgroundColor");
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain("OVERRIDE");
    // Still never asks for experiment variants.
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).not.toContain('"variants"');
  });

  it("builds an image user prompt that includes the merchant payload", () => {
    const prompt = buildCampaignAiImageUserPrompt(
      buildDefaultCampaignAiInput({
        productContext: "linen shirts",
        locale: "it",
        locales: ["en", "it"],
      }),
    );

    expect(prompt).toContain("reference image is attached");
    expect(prompt).toContain("linen shirts");
    expect(prompt).toContain('"targetLocales": [');
    expect(prompt).toContain('"it"');
  });

  it("round-trips image-derived colors through the applied suggestion", () => {
    const reviewed = JSON.stringify({
      promptVersion: "x",
      source: "provider",
      referenceImageUsed: true,
      input: buildDefaultCampaignAiInput({ productContext: "sneakers" }),
      design: {
        backgroundType: "SOLID",
        backgroundColor: "#FF00AA",
      },
    });

    const applied = parseAppliedCampaignSuggestion(reviewed);

    expect(applied?.referenceImageUsed).toBe(true);
    expect(applied?.design.backgroundColor).toBe("#FF00AA");
  });
});
