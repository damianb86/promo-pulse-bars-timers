import { Prisma, ShopPlan, type PlacementType } from "@prisma/client";
import { RouterContextProvider, type LoaderFunctionArgs } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StorefrontCampaignSource } from "../../app/utils/storefront-campaigns";

const campaignModelMock = vi.hoisted(() => ({
  getActiveCampaignsForShop: vi.fn(),
}));

const shopModelMock = vi.hoisted(() => ({
  getShopByDomain: vi.fn(),
}));

const shopifyMock = vi.hoisted(() => ({
  checkout: vi.fn(),
}));

vi.mock("../../app/models/campaign.server", () => campaignModelMock);
vi.mock("../../app/models/shop.server", () => shopModelMock);
vi.mock("../../app/shopify.server", () => ({
  authenticate: {
    public: {
      checkout: shopifyMock.checkout,
    },
  },
}));

import { loader } from "../../app/routes/api.checkout.campaign";

describe("checkout campaign endpoint", () => {
  beforeEach(() => {
    vi.stubEnv("E2E_TEST_MODE", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.clearAllMocks();

    shopifyMock.checkout.mockResolvedValue({
      sessionToken: { dest: "https://demo-shop.myshopify.com" },
      cors: (response: Response) => response,
    });
    shopModelMock.getShopByDomain.mockResolvedValue({
      id: "shop-1",
      plan: ShopPlan.GROWTH,
      shopifyDomain: "demo-shop.myshopify.com",
    });
    campaignModelMock.getActiveCampaignsForShop.mockResolvedValue([
      freeShippingCampaign(),
    ]);
  });

  it("authenticates checkout requests and returns a checkout-safe campaign", async () => {
    const response = await loader({
      request: new Request(
        "https://app.test/api/checkout/campaign?shop=demo-shop.myshopify.com&cartSubtotal=40&currency=USD&locale=en-US",
        {
          headers: { Authorization: "Bearer session-token" },
        },
      ),
      ...loaderArgs(),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(shopifyMock.checkout).toHaveBeenCalled();
    expect(shopModelMock.getShopByDomain).toHaveBeenCalledWith(
      "demo-shop.myshopify.com",
    );
    expect(body.campaign).toMatchObject({
      campaignId: "campaign-1",
      kind: "FREE_SHIPPING_REMINDER",
      progress: {
        remainingAmount: 60,
      },
    });
  });

  it("rejects a shop query that does not match the checkout session token", async () => {
    const response = await loader({
      request: new Request(
        "https://app.test/api/checkout/campaign?shop=other.myshopify.com",
        {
          headers: { Authorization: "Bearer session-token" },
        },
      ),
      ...loaderArgs(),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/authenticated shop/i);
    expect(shopModelMock.getShopByDomain).not.toHaveBeenCalled();
  });

  it("blocks checkout campaign data below the Growth plan", async () => {
    shopModelMock.getShopByDomain.mockResolvedValue({
      id: "shop-1",
      plan: ShopPlan.STARTER,
      shopifyDomain: "demo-shop.myshopify.com",
    });

    const response = await loader({
      request: new Request(
        "https://app.test/api/checkout/campaign?shop=demo-shop.myshopify.com",
        {
          headers: { Authorization: "Bearer session-token" },
        },
      ),
      ...loaderArgs(),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      campaign: null,
      gated: true,
      requiredPlan: ShopPlan.GROWTH,
    });
    expect(campaignModelMock.getActiveCampaignsForShop).not.toHaveBeenCalled();
  });

  it("supports E2E mode without a real checkout session token", async () => {
    vi.stubEnv("E2E_TEST_MODE", "true");

    const response = await loader({
      request: new Request(
        "https://app.test/api/checkout/campaign?shop=demo-shop.myshopify.com&cartSubtotal=80&currency=USD",
      ),
      ...loaderArgs(),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(shopifyMock.checkout).not.toHaveBeenCalled();
    expect(body.campaign).toMatchObject({
      kind: "FREE_SHIPPING_REMINDER",
      progress: {
        remainingAmount: 20,
      },
    });
  });
});

function loaderArgs(): Omit<LoaderFunctionArgs, "request"> {
  return {
    url: new URL("https://app.test/api/checkout/campaign"),
    pattern: "/api/checkout/campaign",
    params: {},
    context: new RouterContextProvider(),
  };
}

function freeShippingCampaign(): StorefrontCampaignSource {
  return {
    id: "campaign-1",
    shopId: "shop-1",
    name: "Free shipping",
    status: "ACTIVE",
    type: "FREE_SHIPPING_GOAL",
    goal: "FREE_SHIPPING",
    startsAt: new Date("2026-06-18T11:00:00.000Z"),
    endsAt: new Date("2026-06-18T13:00:00.000Z"),
    timezone: "UTC",
    priority: 0,
    createdAt: new Date("2026-06-18T11:00:00.000Z"),
    updatedAt: new Date("2026-06-18T11:00:00.000Z"),
    placements: [
      {
        id: "placement-1",
        campaignId: "campaign-1",
        placementType: "CART_PAGE" as PlacementType,
        customSelector: null,
        enabled: true,
      },
    ],
    targeting: null,
    design: null,
    timerSettings: null,
    freeShippingSettings: {
      campaignId: "campaign-1",
      thresholdAmount: new Prisma.Decimal(100),
      currencyCode: "USD",
      includeDiscountedSubtotal: true,
      emptyCartMessage: null,
      successMessage: "Free shipping unlocked",
      progressStyle: "BAR",
      thresholdRules: null,
    },
    deliveryCutoffSettings: null,
    lowStockSettings: null,
    badgeSettings: null,
    discountSync: null,
    translations: [
      {
        id: "translation-1",
        campaignId: "campaign-1",
        locale: "en",
        headline: "Free shipping",
        subheadline: "Checkout now.",
        ctaText: "Checkout",
        ctaUrl: "/checkout",
        expiredText: "This offer has ended.",
        freeShippingEmptyText: "",
        freeShippingProgressText:
          "You're {{amount}} away from free shipping",
        freeShippingSuccessText: "Free shipping unlocked",
        deliveryBeforeCutoffText: "",
        deliveryAfterCutoffText: "",
        lowStockText: "",
        badgeText: "",
      },
    ],
    experiments: [],
  };
}
