import { describe, expect, it } from "vitest";

import {
  buildCheckoutCampaignRequest,
  formatTimerLabel,
  normalizeBlockSettings,
  resolveCheckoutCampaignEndpoint,
} from "../../extensions/promo-pulse-checkout/src/checkoutApi";

describe("checkout extension API helpers", () => {
  it("builds an app proxy checkout campaign request by default", () => {
    const request = buildCheckoutCampaignRequest({
      settings: { mode: "AUTO_ELIGIBLE", compactMode: true },
      shopDomain: "Demo-Shop.MyShopify.com",
      storefrontUrl: "",
      subtotalAmount: 42.5,
      currencyCode: "usd",
      countryCode: "us",
      locale: "en-US",
      marketHandle: "us",
    });

    expect(request.requiresSessionToken).toBe(false);
    expect(request.url).toContain(
      "https://demo-shop.myshopify.com/apps/promo-pulse/api/checkout/campaign?",
    );
    expect(request.url).toContain("mode=AUTO_ELIGIBLE");
    expect(request.url).toContain("compactMode=true");
    expect(request.url).toContain("cartSubtotal=42.5");
    expect(request.url).toContain("currency=USD");
  });

  it("requires a campaign id before calling specific campaign mode", () => {
    const request = buildCheckoutCampaignRequest({
      settings: { mode: "SPECIFIC_CAMPAIGN" },
      shopDomain: "demo-shop.myshopify.com",
      storefrontUrl: "",
      subtotalAmount: 0,
      currencyCode: "USD",
      countryCode: "",
      locale: "en",
      marketHandle: "",
    });

    expect(request).toEqual({
      url: "",
      cacheKey: "missing-campaign",
      requiresSessionToken: false,
    });
  });

  it("supports direct app endpoints with checkout session-token auth", () => {
    const endpoint = resolveCheckoutCampaignEndpoint({
      apiBaseUrl: "https://promo-pulse.example.com",
      shopDomain: "demo-shop.myshopify.com",
      storefrontUrl: "",
    });

    expect(endpoint).toEqual({
      url: "https://promo-pulse.example.com/api/checkout/campaign",
      shop: "demo-shop.myshopify.com",
      requiresSessionToken: true,
    });
  });

  it("normalizes block settings and timer labels", () => {
    expect(
      normalizeBlockSettings({
        mode: "manual",
        compactMode: "true",
        showTimer: "false",
      }),
    ).toMatchObject({
      mode: "AUTO_ELIGIBLE",
      compactMode: true,
      showTimer: false,
    });
    expect(formatTimerLabel(3661)).toBe("1h 01m");
    expect(formatTimerLabel(61)).toBe("1m 01s");
  });
});
