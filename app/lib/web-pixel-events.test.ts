import { AnalyticsEventType, PlacementType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { mapWebPixelEventToAnalyticsPayload } from "./web-pixel-events";

describe("web pixel analytics mapper", () => {
  it("maps product_viewed to PRODUCT_VIEWED with campaign attribution", () => {
    expect(
      mapWebPixelEventToAnalyticsPayload({
        shop: "promo-pulse-demo.myshopify.com",
        eventName: "product_viewed",
        visitorId: "visitor-1",
        sessionId: "session-1",
        lastSeenCampaignId: "campaign-1",
        path: "/products/hat",
      }),
    ).toEqual({
      ok: true,
      payload: expect.objectContaining({
        campaignId: "campaign-1",
        eventType: AnalyticsEventType.PRODUCT_VIEWED,
        path: "/products/hat",
        visitorId: "visitor-1",
      }),
    });
  });

  it("maps product_added_to_cart to ADD_TO_CART with campaign attribution", () => {
    expect(
      mapWebPixelEventToAnalyticsPayload({
        shop: "https://PromoPulse-Demo.myshopify.com",
        eventName: "product_added_to_cart",
        visitorId: "visitor-1",
        sessionId: "session-1",
        lastSeenCampaignId: "campaign-1",
        lastSeenExperimentId: "experiment-1",
        lastSeenVariantId: "variant-1",
        lastSeenPlacementType: PlacementType.PRODUCT_PAGE,
        lastPromoTouch: "1781798400000",
        cartToken: "cart-1",
        path: "/products/hat",
      }),
    ).toEqual({
      ok: true,
      payload: expect.objectContaining({
        shop: "promo-pulse-demo.myshopify.com",
        campaignId: "campaign-1",
        experimentId: "experiment-1",
        variantId: "variant-1",
        visitorId: "visitor-1",
        eventType: AnalyticsEventType.ADD_TO_CART,
        placementType: PlacementType.PRODUCT_PAGE,
        sessionId: "session-1",
        cartToken: "cart-1",
        path: "/products/hat",
      }),
    });
  });

  it("maps checkout_started to CHECKOUT_STARTED", () => {
    expect(
      mapWebPixelEventToAnalyticsPayload({
        shop: "promo-pulse-demo.myshopify.com",
        eventName: "checkout_started",
        sessionId: "session-1",
        lastSeenCampaignId: "campaign-1",
      }),
    ).toEqual({
      ok: true,
      payload: expect.objectContaining({
        eventType: AnalyticsEventType.CHECKOUT_STARTED,
        campaignId: "campaign-1",
      }),
    });
  });

  it("maps checkout_completed to ORDER_ATTRIBUTED with safe revenue fields", () => {
    expect(
      mapWebPixelEventToAnalyticsPayload({
        shop: "promo-pulse-demo.myshopify.com",
        eventName: "checkout_completed",
        sessionId: "session-1",
        lastSeenCampaignId: "campaign-1",
        orderId: "gid://shopify/Order/1",
        revenueAmount: "128.5",
        currencyCode: "usd",
      }),
    ).toEqual({
      ok: true,
      payload: expect.objectContaining({
        eventType: AnalyticsEventType.ORDER_ATTRIBUTED,
        orderId: "gid://shopify/Order/1",
        revenueAmount: "128.50",
        currencyCode: "USD",
      }),
    });
  });

  it("does not map campaign metrics without a recently seen campaign", () => {
    expect(
      mapWebPixelEventToAnalyticsPayload({
        shop: "promo-pulse-demo.myshopify.com",
        eventName: "product_added_to_cart",
        sessionId: "session-1",
      }),
    ).toEqual({
      ok: false,
      reason: "missing_attribution",
      errors: [
        "No recently rendered campaign was available for session attribution.",
      ],
    });
  });
});
