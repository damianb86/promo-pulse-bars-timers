import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  attributeCheckoutStarted,
  attributeOrderRevenue,
} from "./orderAttribution.server";

const prismaMock = vi.hoisted(() => ({
  shop: { findUnique: vi.fn() },
  analyticsEvent: { findFirst: vi.fn() },
}));

const analyticsMock = vi.hoisted(() => ({
  recordAnalyticsEvent: vi.fn(),
  validateAnalyticsEventPayload: vi.fn(),
}));

vi.mock("../../db.server", () => ({ default: prismaMock }));
vi.mock("../../models/analytics.server", () => analyticsMock);

const order = {
  id: "gid://shopify/Order/1",
  admin_graphql_api_id: "gid://shopify/Order/1",
  cart_token: "cart-token-abc",
  total_price: "42.50",
  currency: "USD",
};

describe("attributeOrderRevenue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.shop.findUnique.mockResolvedValue({ id: "shop-1" });
    analyticsMock.validateAnalyticsEventPayload.mockImplementation(
      (payload: unknown) => ({ ok: true, payload }),
    );
    analyticsMock.recordAnalyticsEvent.mockResolvedValue({ saved: true });
  });

  it("attributes revenue to the campaign that shared the order's cart token", async () => {
    // No prior ORDER_ATTRIBUTED, then a matching cart-token touch.
    prismaMock.analyticsEvent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        campaignId: "campaign-9",
        sessionId: "cps-1",
        placementType: "TOP_BAR",
        country: "US",
        locale: "en",
      });

    const result = await attributeOrderRevenue({
      shopDomain: "demo-shop.myshopify.com",
      order,
    });

    expect(result.attributed).toBe(true);
    expect(result.campaignId).toBe("campaign-9");
    const payload = analyticsMock.recordAnalyticsEvent.mock.calls[0][0];
    expect(payload).toMatchObject({
      campaignId: "campaign-9",
      eventType: "ORDER_ATTRIBUTED",
      orderId: "gid://shopify/Order/1",
      cartToken: "cart-token-abc",
      revenueAmount: "42.50",
      sessionId: "cps-1",
      consentGranted: true,
    });
  });

  it("never double-counts an order already attributed (webhook retry)", async () => {
    prismaMock.analyticsEvent.findFirst.mockResolvedValueOnce({ id: "e1" });

    const result = await attributeOrderRevenue({
      shopDomain: "demo-shop.myshopify.com",
      order,
    });

    expect(result).toEqual({ attributed: false, reason: "already_attributed" });
    expect(analyticsMock.recordAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("skips orders with no cart token (cannot be attributed)", async () => {
    const result = await attributeOrderRevenue({
      shopDomain: "demo-shop.myshopify.com",
      order: { id: "gid://shopify/Order/2", total_price: "10.00" },
    });

    expect(result).toEqual({ attributed: false, reason: "missing_cart_token" });
    expect(prismaMock.analyticsEvent.findFirst).not.toHaveBeenCalled();
  });

  it("skips when no campaign ever touched the cart", async () => {
    prismaMock.analyticsEvent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await attributeOrderRevenue({
      shopDomain: "demo-shop.myshopify.com",
      order,
    });

    expect(result).toEqual({ attributed: false, reason: "no_campaign_touch" });
    expect(analyticsMock.recordAnalyticsEvent).not.toHaveBeenCalled();
  });
});

describe("attributeCheckoutStarted", () => {
  const checkout = { cart_token: "cart-token-abc", currency: "USD" };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.shop.findUnique.mockResolvedValue({ id: "shop-1" });
    analyticsMock.validateAnalyticsEventPayload.mockImplementation(
      (payload: unknown) => ({ ok: true, payload }),
    );
    analyticsMock.recordAnalyticsEvent.mockResolvedValue({ saved: true });
  });

  it("records CHECKOUT_STARTED for the cart token's campaign", async () => {
    prismaMock.analyticsEvent.findFirst
      .mockResolvedValueOnce(null) // no existing checkout for this cart
      .mockResolvedValueOnce({
        campaignId: "campaign-3",
        sessionId: "cps-9",
        placementType: "CART_PAGE",
        country: "US",
        locale: "en",
      });

    const result = await attributeCheckoutStarted({
      shopDomain: "demo-shop.myshopify.com",
      checkout,
    });

    expect(result.attributed).toBe(true);
    expect(result.campaignId).toBe("campaign-3");
    expect(analyticsMock.recordAnalyticsEvent.mock.calls[0][0]).toMatchObject({
      campaignId: "campaign-3",
      eventType: "CHECKOUT_STARTED",
      cartToken: "cart-token-abc",
    });
  });

  it("does not double-count a checkout already recorded for the cart", async () => {
    prismaMock.analyticsEvent.findFirst.mockResolvedValueOnce({ id: "e1" });

    const result = await attributeCheckoutStarted({
      shopDomain: "demo-shop.myshopify.com",
      checkout,
    });

    expect(result).toEqual({ attributed: false, reason: "already_attributed" });
    expect(analyticsMock.recordAnalyticsEvent).not.toHaveBeenCalled();
  });
});
