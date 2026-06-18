import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildPostPurchaseCampaignRequest,
  formatPostPurchaseTimerLabel,
  resolvePostPurchaseCampaignEndpoint,
  trackPostPurchaseEvent,
} from "../../extensions/promo-pulse-checkout/src/postPurchaseApi";

describe("post-purchase extension API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds an app proxy post-purchase request by default", () => {
    const request = buildPostPurchaseCampaignRequest({
      settings: { mode: "AUTO_ELIGIBLE", compactMode: true },
      shopDomain: "Demo-Shop.MyShopify.com",
      storefrontUrl: "",
      surface: "ORDER_STATUS_PAGE",
      currencyCode: "usd",
      countryCode: "us",
      locale: "en-US",
      marketHandle: "us",
      appliedDiscountCodes: ["SAVE20"] as string[],
    });

    expect(request.requiresSessionToken).toBe(false);
    expect(request.url).toContain(
      "https://demo-shop.myshopify.com/apps/counterpulse-campaigns/api/post-purchase/campaign?",
    );
    expect(request.url).toContain("mode=AUTO_ELIGIBLE");
    expect(request.url).toContain("surface=ORDER_STATUS_PAGE");
    expect(request.url).toContain("compactMode=true");
    expect(request.url).toContain("appliedDiscountCodes=SAVE20");
    expect(request.url).toContain("currency=USD");
  });

  it("supports direct app endpoints with session-token auth", () => {
    const endpoint = resolvePostPurchaseCampaignEndpoint({
      apiBaseUrl: "https://promo-pulse.example.com",
      shopDomain: "demo-shop.myshopify.com",
      storefrontUrl: "",
    });

    expect(endpoint).toEqual({
      url: "https://promo-pulse.example.com/api/post-purchase/campaign",
      shop: "demo-shop.myshopify.com",
      requiresSessionToken: true,
    });
  });

  it("tracks post-purchase events without customer PII", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", {
      status: 201,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await trackPostPurchaseEvent({
      campaign: { campaignId: "campaign-1" },
      shopDomain: "demo-shop.myshopify.com",
      storefrontUrl: "",
      eventType: "REORDER_OFFER_CLICK",
      surface: "ORDER_STATUS_PAGE",
      currencyCode: "usd",
      countryCode: "us",
      locale: "en-US",
    });
    const [, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(init.body));

    expect(result).toEqual({ ok: true, status: 201 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://demo-shop.myshopify.com/apps/counterpulse-campaigns",
      expect.objectContaining({ method: "POST" }),
    );
    expect(payload).toEqual({
      shop: "demo-shop.myshopify.com",
      campaignId: "campaign-1",
      eventType: "REORDER_OFFER_CLICK",
      placementType: "ORDER_STATUS_PAGE",
      currencyCode: "USD",
      country: "US",
      locale: "en-US",
      path: "/order-status",
    });
    expect(JSON.stringify(payload)).not.toMatch(/email|customer|address/i);
  });

  it("formats longer post-purchase timers", () => {
    expect(formatPostPurchaseTimerLabel(90061)).toBe("1d 01h");
    expect(formatPostPurchaseTimerLabel(3661)).toBe("1h 01m");
    expect(formatPostPurchaseTimerLabel(61)).toBe("1m 01s");
  });
});
