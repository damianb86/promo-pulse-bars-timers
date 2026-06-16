import { describe, expect, it } from "vitest";

import { buildCampaignViewModel } from "./campaign-view-model";

describe("buildCampaignViewModel", () => {
  it("builds a storefront-safe view model from campaign data", () => {
    const viewModel = buildCampaignViewModel({
      name: "Flash Sale",
      type: "COUNTDOWN_BAR",
      placements: [
        { placementType: "TOP_BAR", enabled: true },
        { placementType: "CART_DRAWER", enabled: false },
      ],
      translations: [
        {
          locale: "en",
          headline: "Sale ends soon",
          subheadline: "Save before midnight.",
          ctaText: "Shop sale",
          ctaUrl: "/collections/sale",
          badgeText: null,
        },
      ],
      design: {
        templateKey: "flash-sale",
        backgroundColor: "#7F1D1D",
      },
    });

    expect(viewModel.headline).toBe("Sale ends soon");
    expect(viewModel.ctaUrl).toBe("/collections/sale");
    expect(viewModel.placements).toEqual(["TOP_BAR"]);
    expect(viewModel.design.backgroundColor).toBe("#7F1D1D");
  });

  it("falls back to campaign name when translation is missing", () => {
    const viewModel = buildCampaignViewModel({
      name: "Delivery Cutoff",
      type: "DELIVERY_CUTOFF",
      placements: [],
      translations: [],
      design: null,
    });

    expect(viewModel.headline).toBe("Delivery Cutoff");
    expect(viewModel.ctaText).toBe("Shop now");
  });
});
