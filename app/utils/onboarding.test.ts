import { describe, expect, it } from "vitest";

import { buildThemeEditorUrl, getStarterCampaignDefaults } from "./onboarding";

describe("onboarding utilities", () => {
  it("maps flash sale to a countdown bar starter campaign", () => {
    expect(getStarterCampaignDefaults("FLASH_SALE", "TOP_BAR")).toMatchObject({
      goal: "FLASH_SALE",
      type: "COUNTDOWN_BAR",
      placementType: "TOP_BAR",
      templateKey: "flash-sale",
    });
  });

  it("maps free shipping cart setup to cart page placement", () => {
    expect(getStarterCampaignDefaults("FREE_SHIPPING", "CART")).toMatchObject({
      goal: "FREE_SHIPPING",
      type: "FREE_SHIPPING_GOAL",
      placementType: "CART_PAGE",
      templateKey: "free-shipping",
    });
  });

  it("keeps cart rescue in a cart placement even if top bar is requested", () => {
    expect(getStarterCampaignDefaults("CART_RESCUE", "TOP_BAR")).toMatchObject({
      goal: "CART_RESCUE",
      type: "CART_TIMER",
      placementType: "CART_PAGE",
    });
  });

  it("builds theme editor URLs with template context when possible", () => {
    expect(
      buildThemeEditorUrl(
        "https://counterpulse-test.myshopify.com/admin",
        "PRODUCT_PAGE",
      ),
    ).toBe(
      "https://counterpulse-test.myshopify.com/admin/themes/current/editor?context=apps&template=product",
    );
  });

  it("returns an empty theme editor URL without a shop domain", () => {
    expect(buildThemeEditorUrl("", "TOP_BAR")).toBe("");
  });
});
