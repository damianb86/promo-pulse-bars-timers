import { describe, expect, it } from "vitest";

import {
  createMockCampaignTranslationAiProvider,
  generateCampaignTranslationSuggestions,
  parseCampaignTranslationAiFormData,
  type CampaignTranslationAiProvider,
} from "./campaignTranslationGenerator.server";
import {
  translationFallbackInputName,
  translationInputName,
} from "../../types/localization";

describe("AI campaign translation generator", () => {
  it("parses source copy using resolved fallback values", () => {
    const formData = new FormData();

    formData.set("_action", "translateCampaignTranslations");
    formData.set("sourceLocale", "es");
    formData.set(translationInputName("es", "headline"), "");
    formData.set(
      translationFallbackInputName("es", "headline"),
      "Venta relampago",
    );
    formData.set(translationInputName("es", "ctaUrl"), "/collections/sale");

    const parsed = parseCampaignTranslationAiFormData(formData);

    expect(parsed.errors).toEqual({});
    expect(parsed.input.sourceLocale).toBe("es");
    expect(parsed.input.sourceValues.headline).toBe("Venta relampago");
    expect(parsed.input.sourceValues.ctaUrl).toBe("/collections/sale");
  });

  it("sanitizes provider output and preserves source CTA URL", async () => {
    const provider: CampaignTranslationAiProvider = {
      source: "provider",
      async translate() {
        return {
          en: {
            headline: "Flash sale",
            ctaUrl: "/wrong",
          },
          fr: {
            headline: "Vente flash",
          },
        };
      },
    };

    const result = await generateCampaignTranslationSuggestions(
      {
        sourceLocale: "es",
        sourceValues: {
          headline: "Venta relampago",
          subheadline: "Solo por hoy",
          ctaText: "Comprar",
          ctaUrl: "/collections/sale",
          expiredText: "La campana termino",
          freeShippingEmptyText: "",
          freeShippingProgressText: "",
          freeShippingSuccessText: "",
          deliveryBeforeCutoffText: "",
          deliveryAfterCutoffText: "",
          lowStockText: "",
          badgeText: "",
        },
        values: createMockValues("es", {
          headline: "Venta relampago",
          ctaUrl: "/collections/sale",
        }),
      },
      { provider },
    );

    expect(result.source).toBe("provider");
    expect(result.translations.en.headline).toBe("Flash sale");
    expect(result.translations.en.ctaUrl).toBe("/collections/sale");
    expect(result.translations.fr.headline).toBe("Vente flash");
    expect(result.translations.de.subheadline).toBe("Solo por hoy");
    expect(result.translations.es.headline).toBe("Venta relampago");
  });

  it("uses deterministic mock output for local and E2E flows", async () => {
    const result = await generateCampaignTranslationSuggestions(
      {
        sourceLocale: "pt-BR",
        sourceValues: {
          headline: "Oferta de hoje",
          subheadline: "Termina em breve",
          ctaText: "Comprar",
          ctaUrl: "/collections/sale",
          expiredText: "Terminou",
          freeShippingEmptyText: "",
          freeShippingProgressText: "",
          freeShippingSuccessText: "",
          deliveryBeforeCutoffText: "",
          deliveryAfterCutoffText: "",
          lowStockText: "",
          badgeText: "",
        },
        values: createMockValues("pt-BR", {
          headline: "Oferta de hoje",
          ctaUrl: "/collections/sale",
        }),
      },
      { provider: createMockCampaignTranslationAiProvider() },
    );

    expect(result.source).toBe("mock");
    expect(result.translations.en.headline).toBe("Oferta de hoje");
    expect(result.translations.es.ctaText).toBe("Comprar");
    expect(result.translations.de.ctaUrl).toBe("/collections/sale");
  });
});

function createMockValues(
  locale: "en" | "es" | "pt-BR" | "fr" | "de",
  overrides: Partial<Record<"headline" | "ctaUrl", string>>,
) {
  return {
    en: createTranslationValues(),
    es: createTranslationValues(),
    "pt-BR": createTranslationValues(),
    fr: createTranslationValues(),
    de: createTranslationValues(),
    [locale]: {
      ...createTranslationValues(),
      ...overrides,
    },
  };
}

function createTranslationValues() {
  return {
    headline: "",
    subheadline: "",
    ctaText: "",
    ctaUrl: "",
    expiredText: "",
    freeShippingEmptyText: "",
    freeShippingProgressText: "",
    freeShippingSuccessText: "",
    deliveryBeforeCutoffText: "",
    deliveryAfterCutoffText: "",
    lowStockText: "",
    badgeText: "",
  };
}
