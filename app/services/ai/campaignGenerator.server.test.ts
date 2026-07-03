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
  AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT,
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
        '<strong data-cp-slot="headline"></strong>' +
        '<div data-cp-slot="timer"></div></section>',
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

  it("fills a mock end date for a timer campaign when none is provided", async () => {
    const provider: CampaignAiProvider = {
      source: "provider",
      async generateCampaignSuggestion() {
        return {
          campaign: { type: "COUNTDOWN_BAR" },
          timer: { mode: "FIXED_DATE", endsAt: "" },
        };
      },
    };
    const suggestion = await generateCampaignSuggestion(
      buildDefaultCampaignAiInput({ productContext: "shoes" }),
      { provider },
    );

    expect(suggestion.campaign.type).toBe("COUNTDOWN_BAR");
    expect(suggestion.timer.mode).toBe("FIXED_DATE");
    expect(suggestion.timer.endsAt).not.toBe("");
    expect(new Date(suggestion.timer.endsAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
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

  it("allows blank product context and country in the AI drawer", () => {
    const formData = new FormData();
    formData.set("objective", "FLASH_SALE");
    formData.set("campaignShape", "sitewide");
    formData.set("locale", "en");
    formData.set("brandTone", "premium");
    formData.set("ctaUrl", "/collections/all");

    const parsed = parseCampaignAiFormData(formData);

    expect(parsed.errors).toEqual({});
    expect(parsed.values.productContext).toBe("");
    expect(parsed.values.countryCode).toBe("");
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

  it("keeps product context optional for the AI drawer", () => {
    const formData = new FormData();
    formData.set("objective", "FLASH_SALE");
    formData.set("ctaUrl", "/collections/all");

    const parsed = parseCampaignAiFormData(formData);

    expect(parsed.errors.productContext).toBeUndefined();
    expect(parsed.values.productContext).toBe("");
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

  it("keeps the base prompt preset-first when no visual assets are requested", () => {
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).toContain(
      "Preset-first design workflow",
    );
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).toContain("Built-in preset catalog");
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).toContain("flash-sale (Flash Sale)");
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).toContain("Design quality");
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).toContain("Contrast");
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).toContain(
      "Prefer first-class design settings",
    );
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).toContain("keep assets as []");
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).not.toContain("{{asset:");
    expect(AI_CAMPAIGN_SYSTEM_PROMPT).not.toContain("imageSize");
  });

  it("moves visual-asset guidance to the visual prompt", () => {
    expect(AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT).toContain("VISUAL ASSET MODE");
    expect(AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT).toContain("Visual assets");
    expect(AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT).toContain("background");
    expect(AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT).toContain("{{asset:");
    expect(AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT).toContain(
      "design.backgroundImageUrl",
    );
    expect(AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT).toContain("imageSize");
    expect(AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT).toContain("1536x1024");
    expect(AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT).toContain(
      "responsive min-height",
    );
    expect(AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT).toContain("may become a taller");
    expect(AI_CAMPAIGN_VISUAL_SYSTEM_PROMPT).toContain(
      "Built-in preset catalog",
    );
  });

  it("treats image mode as style reference + keeps the region tool", () => {
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain("REGION");
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain(
      "STYLE REFERENCE IMAGE MODE",
    );
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toMatch(
      /not as a\s+campaign screenshot that must be copied exactly/,
    );
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain(
      "using the established presets and",
    );
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain(
      "more important than copying the image",
    );
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).not.toContain(
      "Visual similarity is",
    );
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).not.toContain(
      "reproduce that image as closely as possible",
    );
  });

  it("builds an image system prompt that allows visual overrides and lists settings", () => {
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain(
      "STYLE REFERENCE IMAGE MODE",
    );
    // Reuses the base prompt + the design settings catalog.
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain(
      "Promo Pulse AI Campaign Builder",
    );
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain(
      "Design settings catalog",
    );
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain("VISUAL ASSET MODE");
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain("backgroundColor");
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).toContain(
      "Start from the closest templateKey/preset",
    );
    expect(AI_CAMPAIGN_IMAGE_SYSTEM_PROMPT).not.toContain("OVERRIDE");
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
    expect(prompt).toContain("style reference");
    expect(prompt).toContain("using presets/settings");
    expect(prompt).toContain("do not copy");
    expect(prompt).toContain("linen shirts");
    expect(prompt).toContain('"targetLocales": [');
    expect(prompt).toContain('"it"');
  });

  it("omits empty merchant fields from prompt payloads", () => {
    const prompt = buildCampaignAiUserPrompt(
      buildDefaultCampaignAiInput({ productContext: "linen shirts" }),
    );

    expect(prompt).toContain("No reference image is attached");
    expect(prompt).toContain("linen shirts");
    expect(prompt).not.toContain('"campaignNameHint": ""');
    expect(prompt).not.toContain('"quickStarts": []');
    expect(prompt).not.toContain('"generateVisualAssets": false');
  });

  it("marks text-only prompts as visual when assets are requested", () => {
    const prompt = buildCampaignAiUserPrompt(
      buildDefaultCampaignAiInput({
        generateVisualAssets: true,
        productContext: "linen shirts",
      }),
    );

    expect(prompt).toContain("Visual asset generation is requested");
    expect(prompt).toContain('"generateVisualAssets": true');
  });

  it("includes image dimensions and the no-inflate rule when provided", () => {
    const prompt = buildCampaignAiImageUserPrompt(
      buildDefaultCampaignAiInput({ productContext: "linen shirts" }),
      undefined,
      { width: 1200, height: 200 },
    );

    expect(prompt).toContain("1200px");
    expect(prompt).toContain("200px");
    expect(prompt).toContain("aspect ratio");
    expect(prompt).toContain("horizontal bar");
    expect(prompt).toContain("WITHOUT inflating");
  });

  it("round-trips an asset region through the applied suggestion", () => {
    const reviewed = JSON.stringify({
      promptVersion: "x",
      source: "provider",
      input: buildDefaultCampaignAiInput({
        productContext: "sneakers",
        generateVisualAssets: true,
      }),
      structureHtml:
        '<section class="cp-promo"><img src="{{asset:hero}}" alt="x"></section>',
      assets: [
        {
          key: "hero",
          type: "background",
          source: "generated",
          prompt: "isolate the hero graphic",
          imageSize: "1536x1024",
          region: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
        },
        {
          key: "bad",
          type: "icon",
          source: "generated",
          prompt: "no region",
          region: { x: 0.1, y: 0.2, width: 0, height: 0.6 },
        },
      ],
    });

    const applied = parseAppliedCampaignSuggestion(reviewed);
    const hero = applied?.assets.find((asset) => asset.key === "hero");
    const bad = applied?.assets.find((asset) => asset.key === "bad");

    expect(hero?.region).toEqual({ x: 0.1, y: 0.2, width: 0.5, height: 0.6 });
    expect(hero?.imageSize).toBe("1536x1024");
    // A degenerate region (zero width) is dropped.
    expect(bad?.region).toBeUndefined();
  });

  it("round-trips generated background placeholders through design settings", () => {
    const reviewed = JSON.stringify({
      promptVersion: "x",
      source: "provider",
      input: buildDefaultCampaignAiInput({
        productContext: "sneakers",
        generateVisualAssets: true,
      }),
      design: {
        backgroundType: "IMAGE",
        backgroundImageUrl: "{{asset:hero}}",
      },
      assets: [
        {
          key: "hero",
          type: "background",
          source: "generated",
          prompt: "wide campaign background, 1536x1024 landscape canvas",
          imageSize: "1536x1024",
        },
      ],
    });

    const applied = parseAppliedCampaignSuggestion(reviewed);

    expect(applied?.design.backgroundType).toBe("IMAGE");
    expect(applied?.design.backgroundImageUrl).toBe("{{asset:hero}}");
    expect(applied?.assets[0].imageSize).toBe("1536x1024");
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
