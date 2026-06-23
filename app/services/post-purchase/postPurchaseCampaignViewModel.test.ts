import { describe, expect, it } from "vitest";

import type { StorefrontCampaignResponseItem } from "../../utils/storefront-campaigns";
import {
  buildPostPurchaseCampaignViewModel,
  normalizePostPurchaseCampaignMode,
  normalizePostPurchaseSurface,
  selectPostPurchaseCampaignViewModel,
} from "./postPurchaseCampaignViewModel";

const now = new Date("2026-06-18T12:00:00.000Z");

describe("post-purchase campaign view model", () => {
  it("shows offer used only when the applied code matches the campaign", () => {
    const viewModel = buildPostPurchaseCampaignViewModel({
      campaign: campaign({
        placement: "THANK_YOU_PAGE",
        discount: {
          method: "CODE",
          discountCode: "SAVE20",
          uniqueCode: null,
        },
      }),
      surface: "THANK_YOU_PAGE",
      appliedDiscountCodes: ["SAVE20"],
      locale: "en-US",
      now,
    });

    expect(viewModel).toMatchObject({
      kind: "OFFER_USED_SUCCESSFULLY",
      title: "Offer used successfully",
      discountCode: "SAVE20",
      tone: "success",
    });

    expect(
      buildPostPurchaseCampaignViewModel({
        campaign: campaign({
          placement: "THANK_YOU_PAGE",
          discount: {
            method: "CODE",
            discountCode: "SAVE20",
            uniqueCode: null,
          },
        }),
        surface: "THANK_YOU_PAGE",
        appliedDiscountCodes: ["OTHER"],
        locale: "en-US",
        now,
      })?.kind,
    ).toBe("LIMITED_TIME_REORDER_DISCOUNT");
  });

  it("builds limited-time reorder discount only from a real discount code", () => {
    const viewModel = buildPostPurchaseCampaignViewModel({
      campaign: campaign({
        placement: "ORDER_STATUS_PAGE",
        discount: {
          method: "CODE",
          discountCode: "REORDER10",
          uniqueCode: null,
        },
      }),
      surface: "ORDER_STATUS_PAGE",
      locale: "en-US",
      now,
    });

    expect(viewModel).toMatchObject({
      kind: "LIMITED_TIME_REORDER_DISCOUNT",
      discountCode: "REORDER10",
      timer: {
        endsAt: "2026-06-18T13:00:00.000Z",
        remainingSeconds: 3600,
      },
      action: {
        label: "Shop sale",
        url: "/collections/sale",
      },
    });
  });

  it("uses delivery promise copy without unresolved placeholders", () => {
    const viewModel = buildPostPurchaseCampaignViewModel({
      campaign: campaign({
        type: "DELIVERY_CUTOFF",
        goal: "DELIVERY_CUTOFF",
        placement: "ORDER_STATUS_PAGE",
        discount: null,
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
          headline: "Delivery promise",
          deliveryBeforeCutoffText:
            "Order within {{timeRemaining}} to get it by {{minDeliveryDate}}",
          deliveryAfterCutoffText: "Orders placed today ship tomorrow.",
        },
      }),
      surface: "ORDER_STATUS_PAGE",
      locale: "en-US",
      now,
    });

    expect(viewModel).toMatchObject({
      kind: "DELIVERY_PROMISE",
      title: "Delivery promise",
      body: "Orders placed today ship tomorrow.",
    });
  });

  it("returns null when there is no safe post-purchase message", () => {
    expect(
      buildPostPurchaseCampaignViewModel({
        campaign: campaign({
          discount: null,
          texts: {
            ctaUrl: "#",
          },
        }),
        surface: "THANK_YOU_PAGE",
        locale: "en-US",
        now,
      }),
    ).toBeNull();
  });

  it("selects by conservative message priority and normalizes options", () => {
    const selected = selectPostPurchaseCampaignViewModel({
      campaigns: [
        campaign({ id: "share", discount: null }),
        campaign({
          id: "discount",
          discount: {
            method: "CODE",
            discountCode: "SAVE20",
            uniqueCode: null,
          },
        }),
      ],
      surface: "THANK_YOU_PAGE",
      appliedDiscountCodes: ["SAVE20"],
      locale: "en-US",
      now,
    });

    expect(selected?.campaignId).toBe("discount");
    expect(normalizePostPurchaseSurface("ORDER_STATUS_PAGE")).toBe(
      "ORDER_STATUS_PAGE",
    );
    expect(normalizePostPurchaseSurface("unknown")).toBe("THANK_YOU_PAGE");
    expect(normalizePostPurchaseCampaignMode("SPECIFIC_CAMPAIGN")).toBe(
      "SPECIFIC_CAMPAIGN",
    );
    expect(normalizePostPurchaseCampaignMode("manual")).toBe("AUTO_ELIGIBLE");
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
    placement: "THANK_YOU_PAGE",
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
    experiment: null,
    startsAt: "2026-06-18T11:00:00.000Z",
    endsAt: "2026-06-18T13:00:00.000Z",
    timezone: "UTC",
    ...itemOverrides,
  };
}
