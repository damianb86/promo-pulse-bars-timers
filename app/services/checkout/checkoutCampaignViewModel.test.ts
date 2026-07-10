import { describe, expect, it } from "vitest";

import type { StorefrontCampaignResponseItem } from "../../utils/storefront-campaigns";
import {
  buildCheckoutCampaignViewModel,
  normalizeCheckoutCampaignMode,
  selectCheckoutCampaignViewModel,
} from "./checkoutCampaignViewModel";

const now = new Date("2026-06-18T12:00:00.000Z");

describe("checkout campaign view model", () => {
  it("builds a free shipping reminder from real threshold and subtotal data", () => {
    const viewModel = buildCheckoutCampaignViewModel({
      campaign: campaign({
        type: "FREE_SHIPPING_GOAL",
        goal: "FREE_SHIPPING",
        freeShipping: {
          thresholdAmount: "100.00",
          currencyCode: "USD",
          emptyCartMessage: "",
          successMessage: "Free shipping unlocked",
          progressStyle: "BAR",
        },
        texts: {
          freeShippingProgressText: "You're {{amount}} away from free shipping",
        },
      }),
      cartSubtotal: 60,
      currencyCode: "USD",
      locale: "en-US",
      now,
    });

    expect(viewModel).toMatchObject({
      kind: "FREE_SHIPPING_REMINDER",
      title: "You're $40.00 away from free shipping",
      tone: "info",
      progress: {
        currentAmount: 60,
        thresholdAmount: 100,
        remainingAmount: 40,
        percentComplete: 60,
      },
    });
  });

  it("marks free shipping as unlocked without inventing a discount", () => {
    const viewModel = buildCheckoutCampaignViewModel({
      campaign: campaign({
        type: "FREE_SHIPPING_GOAL",
        goal: "FREE_SHIPPING",
        freeShipping: {
          thresholdAmount: "100.00",
          currencyCode: "USD",
          emptyCartMessage: "",
          successMessage: "Free shipping unlocked",
          progressStyle: "BAR",
        },
        texts: {
          freeShippingSuccessText: "Free shipping unlocked",
        },
      }),
      cartSubtotal: 120,
      currencyCode: "USD",
      locale: "en-US",
      now,
    });

    expect(viewModel).toMatchObject({
      title: "Free shipping unlocked",
      tone: "success",
      discountCode: null,
      progress: {
        remainingAmount: 0,
        percentComplete: 100,
      },
    });
  });

  it("shows discount code expiration only when the campaign has a future end", () => {
    const viewModel = buildCheckoutCampaignViewModel({
      campaign: campaign({
        endsAt: "2026-06-18T13:00:00.000Z",
        discount: {
          method: "CODE",
          discountCode: "SAVE20",
          uniqueCode: null,
        },
      }),
      cartSubtotal: 0,
      currencyCode: "USD",
      locale: "en-US",
      now,
    });

    expect(viewModel).toMatchObject({
      kind: "DISCOUNT_CODE_EXPIRATION",
      discountCode: "SAVE20",
      timer: {
        endsAt: "2026-06-18T13:00:00.000Z",
        remainingSeconds: 3600,
      },
    });

    expect(
      buildCheckoutCampaignViewModel({
        campaign: campaign({
          endsAt: "2026-06-18T11:59:59.000Z",
          discount: {
            method: "CODE",
            discountCode: "SAVE20",
            uniqueCode: null,
          },
        }),
        cartSubtotal: 0,
        currencyCode: "USD",
        locale: "en-US",
        now,
      }),
    ).toBeNull();
  });

  it("falls back for delivery cutoff text with unresolved dynamic placeholders", () => {
    const viewModel = buildCheckoutCampaignViewModel({
      campaign: campaign({
        type: "DELIVERY_CUTOFF",
        goal: "DELIVERY_CUTOFF",
        endsAt: null,
        deliveryCutoff: {
          afterCutoffBehavior: "SHOW_NEXT_WINDOW",
          cutoffHour: 14,
          cutoffMinute: 30,
          processingDays: 1,
          minDeliveryDays: 2,
          maxDeliveryDays: 5,
          workingDays: [1, 2, 3, 4, 5],
          holidays: [],
        },
        texts: {
          headline: "Fast delivery",
          deliveryBeforeCutoffText:
            "Order within {{timeRemaining}} to get it by {{minDeliveryDate}}",
          subheadline: "Order before today's delivery cutoff.",
        },
      }),
      cartSubtotal: 0,
      currencyCode: "USD",
      locale: "en-US",
      now,
    });

    expect(viewModel).toMatchObject({
      kind: "DELIVERY_CUTOFF",
      title: "Fast delivery",
      body: "Order before today's delivery cutoff.",
      timer: null,
    });
  });

  it("selects the highest-priority checkout-safe message", () => {
    const selected = selectCheckoutCampaignViewModel({
      campaigns: [
        campaign({ id: "limited", endsAt: "2026-06-18T13:00:00.000Z" }),
        campaign({
          id: "shipping",
          type: "FREE_SHIPPING_GOAL",
          goal: "FREE_SHIPPING",
          freeShipping: {
            thresholdAmount: "100.00",
            currencyCode: "USD",
            emptyCartMessage: "",
            successMessage: "Free shipping unlocked",
            progressStyle: "BAR",
          },
        }),
      ],
      cartSubtotal: 25,
      currencyCode: "USD",
      locale: "en-US",
      now,
    });

    expect(selected?.campaignId).toBe("shipping");
  });

  it("normalizes invalid block mode to auto eligible", () => {
    expect(normalizeCheckoutCampaignMode("SPECIFIC_CAMPAIGN")).toBe(
      "SPECIFIC_CAMPAIGN",
    );
    expect(normalizeCheckoutCampaignMode("manual")).toBe("AUTO_ELIGIBLE");
    expect(normalizeCheckoutCampaignMode(null)).toBe("AUTO_ELIGIBLE");
  });
});

function campaign(
  overrides: Partial<Omit<StorefrontCampaignResponseItem, "texts">> & {
    texts?: Partial<StorefrontCampaignResponseItem["texts"]>;
  } = {},
): StorefrontCampaignResponseItem {
  const { texts: textOverrides, ...itemOverrides } = overrides;

  return {
    id: "campaign-1",
    type: "COUNTDOWN_BAR",
    goal: "FLASH_SALE",
    placement: "TOP_BAR",
    placementSelector: "",
    placementStyle: "",
    design: {} as StorefrontCampaignResponseItem["design"],
    timer: null,
    freeShipping: null,
    deliveryCutoff: null,
    lowStock: null,
    badge: null,
    texts: {
      headline: "Sale ends soon",
      subheadline: "Save before midnight.",
      ctaText: "Shop sale",
      ctaUrl: "/collections/sale",
      expiredText: "This offer has ended.",
      freeShippingEmptyText: "",
      freeShippingProgressText: "",
      freeShippingSuccessText: "",
      deliveryBeforeCutoffText: "",
      deliveryAfterCutoffText: "",
      lowStockText: "",
      badgeText: "",
      ...textOverrides,
    },
    discount: null,
    startsAt: "2026-06-18T11:00:00.000Z",
    endsAt: "2026-06-18T13:00:00.000Z",
    timezone: "UTC",
    ...itemOverrides,
  };
}
