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

  it("preserves modern design, timer, and placement settings for storefront rendering", () => {
    const viewModel = buildCampaignViewModel({
      name: "Top bar countdown",
      type: "COUNTDOWN_BAR",
      endsAt: "2026-06-22T18:00:00.000Z",
      timezone: "America/New_York",
      placements: [
        { placementType: "TOP_BAR", enabled: true },
        { placementType: "BOTTOM_BAR", enabled: true },
        { placementType: "CART_DRAWER", enabled: false },
      ],
      translations: [
        {
          locale: "en",
          headline: "Sale ends soon",
          subheadline: "Last chance today.",
          ctaText: "Shop now",
          ctaUrl: "/collections/sale",
          expiredText: "Offer expired",
          badgeText: null,
        },
      ],
      design: {
        layout: "CTA_RIGHT",
        backgroundType: "GRADIENT",
        gradientStartColor: "#45E4D9",
        gradientEndColor: "#B975F4",
        timerStyle: "BOXES",
        timerFormat: "COLON",
        timerShowLabels: false,
        timerShowSeconds: false,
        fullWidth: true,
        positionMode: "OVERLAY",
        showCloseButton: true,
        closeButtonColor: "#FFFFFF",
        showIcon: true,
        icon: "CUSTOM",
        iconSize: 42,
        customIconUrl: "https://cdn.shopify.com/s/files/icon.png",
      },
      timerSettings: {
        mode: "FIXED_DATE",
        expiredBehavior: "HIDE_TIMER",
        resetBehavior: "NEVER",
      },
    });

    expect(viewModel.placements).toEqual(["TOP_BAR", "BOTTOM_BAR"]);
    expect(viewModel.design).toMatchObject({
      layout: "CTA_RIGHT",
      backgroundType: "GRADIENT",
      gradientStartColor: "#45E4D9",
      gradientEndColor: "#B975F4",
      timerStyle: "BOXES",
      timerFormat: "COLON",
      timerShowLabels: false,
      timerShowSeconds: false,
      fullWidth: true,
      positionMode: "OVERLAY",
      closeButtonColor: "#FFFFFF",
      icon: "CUSTOM",
      iconSize: 42,
      customIconUrl: "https://cdn.shopify.com/s/files/icon.png",
    });
    expect(viewModel.timer).toMatchObject({
      mode: "FIXED_DATE",
      endsAt: "2026-06-22T18:00:00.000Z",
      expiredBehavior: "HIDE_TIMER",
      resetBehavior: "NEVER",
    });
  });

  it("builds free shipping, stock, badge, delivery, and hidden discount-code data", () => {
    const viewModel = buildCampaignViewModel({
      name: "Free shipping threshold",
      type: "FREE_SHIPPING_GOAL",
      timezone: "America/New_York",
      placements: [{ placementType: "CART_DRAWER", enabled: true }],
      translations: [
        {
          locale: "en",
          headline: "Free shipping soon",
          subheadline: "",
          ctaText: "",
          ctaUrl: "",
          expiredText: "",
          freeShippingEmptyText: "Your cart is empty.",
          freeShippingProgressText: "You're {{amount}} away.",
          freeShippingSuccessText: "You've unlocked free shipping.",
          deliveryBeforeCutoffText: "Ships today.",
          deliveryAfterCutoffText: "Ships tomorrow.",
          lowStockText: "Only a few left.",
          badgeText: "Hot",
        },
      ],
      design: null,
      freeShippingSettings: {
        thresholdAmount: "125.50",
        currencyCode: "USD",
        includeDiscountedSubtotal: false,
        emptyCartMessage: "Add products to unlock free shipping.",
        successMessage: "Free shipping unlocked.",
        progressStyle: "CIRCULAR",
      },
      deliveryCutoffSettings: {
        cutoffHour: 15,
        cutoffMinute: 30,
        processingDays: 1,
        minDeliveryDays: 2,
        maxDeliveryDays: 5,
        workingDays: [1, 2, 3, 4, 5],
        holidays: ["2026-12-25"],
        countryRules: { US: { cutoffHour: 14 } },
        afterCutoffBehavior: "SHOW_NEXT_WINDOW",
      },
      lowStockSettings: {
        threshold: 4,
        showExactQuantity: true,
        fallbackMessage: "Selling fast.",
      },
      badgeSettings: {
        badgeText: "",
        badgeShape: "ROUNDED",
        badgePosition: "TOP_LEFT",
      },
      discountSync: {
        discountCode: "SHIP125",
        showCodeOnStorefront: false,
      },
    });

    expect(viewModel.discountCode).toBe("");
    expect(viewModel.freeShipping).toEqual({
      thresholdAmount: 125.5,
      currencyCode: "USD",
      includeDiscountedSubtotal: false,
      emptyCartMessage: "Add products to unlock free shipping.",
      successMessage: "Free shipping unlocked.",
      progressStyle: "CIRCULAR",
    });
    expect(viewModel.deliveryCutoff).toMatchObject({
      cutoffHour: 15,
      cutoffMinute: 30,
      processingDays: 1,
      minDeliveryDays: 2,
      maxDeliveryDays: 5,
      timezone: "America/New_York",
    });
    expect(viewModel.lowStock).toEqual({
      threshold: 4,
      showExactQuantity: true,
      fallbackMessage: "Selling fast.",
    });
    expect(viewModel.badge).toMatchObject({
      badgeText: "Hot",
      badgeShape: "ROUNDED",
      badgePosition: "TOP_LEFT",
    });
    expect(viewModel.freeShippingProgressText).toBe("You're {{amount}} away.");
  });
});
