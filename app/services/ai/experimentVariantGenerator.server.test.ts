import { describe, expect, it } from "vitest";

import {
  createMockExperimentVariantAiProvider,
  generateExperimentVariantSuggestion,
  parseExperimentVariantAiFormData,
  type ExperimentVariantAiProvider,
} from "./experimentVariantGenerator.server";
import { defaultCampaignDesignValues } from "../../types/campaign-design";

describe("AI experiment variant generator", () => {
  it("parses campaign and variant JSON into a variant generation request", () => {
    const formData = createVariantFormData({
      strategy: "trust",
      designIntensity: "bold",
      placementIntent: "product",
      notes: "Make this calmer and more trustworthy.",
    });

    const parsed = parseExperimentVariantAiFormData(formData);

    expect(parsed.errors).toEqual({});
    expect(parsed.input.strategy).toBe("trust");
    expect(parsed.input.designIntensity).toBe("bold");
    expect(parsed.input.placementIntent).toBe("product");
    expect(parsed.input.campaign.name).toBe("Summer Sale");
    expect(parsed.input.campaign.text.headline).toBe("Save 20% today");
    expect(parsed.input.existingVariants).toHaveLength(1);
  });

  it("uses deterministic mock output for local and E2E flows", async () => {
    const parsed = parseExperimentVariantAiFormData(createVariantFormData());
    const result = await generateExperimentVariantSuggestion(parsed.input, {
      provider: createMockExperimentVariantAiProvider(),
    });

    expect(result.source).toBe("mock");
    expect(result.variant.name).toContain("Variant B");
    expect(result.variant.text.headline).toContain("Save more today");
    expect(result.variant.design.layout).toBeTruthy();
  });

  it("sanitizes provider output and rejects unsupported design and placement values", async () => {
    const provider: ExperimentVariantAiProvider = {
      source: "provider",
      async generate() {
        return {
          name: "Variant B - Aggressive",
          rationale: "Tests urgency without changing offer mechanics.",
          hypothesis: "A stronger CTA should improve CTR.",
          text: {
            headline: "Final hours to save",
            ctaUrl: "javascript:alert(1)",
          },
          design: {
            layout: "BROKEN_LAYOUT",
            backgroundColor: "red",
            buttonColor: "#123456",
            titleFontSize: 999,
          },
          placement: {
            placementType: "BAD_PLACE",
            customSelector: "#slot",
          },
        } as unknown as Awaited<ReturnType<ExperimentVariantAiProvider["generate"]>>;
      },
    };
    const parsed = parseExperimentVariantAiFormData(createVariantFormData());
    const result = await generateExperimentVariantSuggestion(parsed.input, {
      provider,
    });

    expect(result.source).toBe("provider");
    expect(result.variant.text.headline).toBe("Final hours to save");
    expect(result.variant.text.ctaUrl).toBeUndefined();
    expect(result.variant.design.layout).toBeUndefined();
    expect(result.variant.design.backgroundColor).toBeUndefined();
    expect(result.variant.design.buttonColor).toBe("#123456");
    expect(result.variant.design.titleFontSize).toBe(42);
    expect(result.variant.placement.placementType).toBeUndefined();
  });

  it("returns a form error when the campaign has no copy to transform", () => {
    const formData = createVariantFormData({
      campaignText: {
        headline: "",
        subheadline: "",
        ctaText: "",
        ctaUrl: "",
      },
    });

    const parsed = parseExperimentVariantAiFormData(formData);

    expect(parsed.errors.form).toContain("Add campaign copy");
  });
});

function createVariantFormData(
  overrides: Partial<{
    strategy: string;
    designIntensity: string;
    placementIntent: string;
    notes: string;
    campaignText: Partial<{
      headline: string;
      subheadline: string;
      ctaText: string;
      ctaUrl: string;
    }>;
  }> = {},
) {
  const formData = new FormData();
  const campaignText = {
    headline: "Save 20% today",
    subheadline: "Offer ends tonight",
    ctaText: "Shop sale",
    ctaUrl: "/collections/sale",
    expiredText: "",
    freeShippingEmptyText: "",
    freeShippingProgressText: "",
    freeShippingSuccessText: "",
    deliveryBeforeCutoffText: "",
    deliveryAfterCutoffText: "",
    lowStockText: "",
    badgeText: "",
    ...overrides.campaignText,
  };

  formData.set("_action", "generateExperimentVariantWithAi");
  formData.set("strategy", overrides.strategy ?? "benefit");
  formData.set("designIntensity", overrides.designIntensity ?? "balanced");
  formData.set("placementIntent", overrides.placementIntent ?? "inherit");
  formData.set("notes", overrides.notes ?? "");
  formData.set(
    "campaignJson",
    JSON.stringify({
      name: "Summer Sale",
      type: "COUNTDOWN_BAR",
      goal: "FLASH_SALE",
      status: "DRAFT",
      placements: ["TOP_BAR"],
      basePlacement: "TOP_BAR",
      text: campaignText,
      design: defaultCampaignDesignValues,
    }),
  );
  formData.set(
    "variantsJson",
    JSON.stringify([
      {
        name: "Control",
        weight: 100,
        text: campaignText,
        design: {},
        placement: {},
      },
    ]),
  );

  return formData;
}
