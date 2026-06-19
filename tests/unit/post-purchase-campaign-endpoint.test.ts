import { ShopPlan } from "@prisma/client";
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
  customerAccount: vi.fn(),
}));

vi.mock("../../app/models/campaign.server", () => campaignModelMock);
vi.mock("../../app/models/shop.server", () => shopModelMock);
vi.mock("../../app/shopify.server", () => ({
  authenticate: {
    public: {
      checkout: shopifyMock.checkout,
      customerAccount: shopifyMock.customerAccount,
    },
  },
}));

import { loader } from "../../app/routes/api.post-purchase.campaign";

describe("post-purchase campaign endpoint", () => {
  beforeEach(() => {
    vi.stubEnv("E2E_TEST_MODE", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.clearAllMocks();

    shopifyMock.checkout.mockResolvedValue({
      sessionToken: { dest: "https://demo-shop.myshopify.com" },
      cors: (response: Response) => response,
    });
    shopifyMock.customerAccount.mockResolvedValue({
      sessionToken: { dest: "https://demo-shop.myshopify.com" },
      cors: (response: Response) => response,
    });
    shopModelMock.getShopByDomain.mockResolvedValue({
      id: "shop-1",
      plan: ShopPlan.PRO,
      shopifyDomain: "demo-shop.myshopify.com",
    });
    campaignModelMock.getActiveCampaignsForShop.mockResolvedValue([
      thankYouCampaign(),
    ]);
  });

  it("authenticates thank-you requests with checkout session tokens", async () => {
    const response = await loader({
      request: new Request(
        "https://app.test/api/post-purchase/campaign?shop=demo-shop.myshopify.com&surface=THANK_YOU_PAGE&appliedDiscountCodes=SAVE20",
        {
          headers: { Authorization: "Bearer session-token" },
        },
      ),
      ...loaderArgs(),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(shopifyMock.checkout).toHaveBeenCalled();
    expect(shopifyMock.customerAccount).not.toHaveBeenCalled();
    expect(campaignModelMock.getActiveCampaignsForShop).toHaveBeenCalledWith(
      "shop-1",
      expect.any(Date),
      "THANK_YOU_PAGE",
    );
    expect(body.campaign).toMatchObject({
      campaignId: "thank-you-campaign",
      kind: "OFFER_USED_SUCCESSFULLY",
      discountCode: "SAVE20",
    });
  });

  it("authenticates order-status requests with customer account session tokens", async () => {
    campaignModelMock.getActiveCampaignsForShop.mockResolvedValue([
      orderStatusCampaign(),
    ]);

    const response = await loader({
      request: new Request(
        "https://app.test/api/post-purchase/campaign?shop=demo-shop.myshopify.com&surface=ORDER_STATUS_PAGE",
        {
          headers: { Authorization: "Bearer session-token" },
        },
      ),
      ...loaderArgs(),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(shopifyMock.customerAccount).toHaveBeenCalled();
    expect(shopifyMock.checkout).not.toHaveBeenCalled();
    expect(campaignModelMock.getActiveCampaignsForShop).toHaveBeenCalledWith(
      "shop-1",
      expect.any(Date),
      "ORDER_STATUS_PAGE",
    );
    expect(body.campaign).toMatchObject({
      campaignId: "order-status-campaign",
      kind: "LIMITED_TIME_REORDER_DISCOUNT",
      discountCode: "REORDER10",
    });
  });

  it("returns null when the surface has no eligible campaign", async () => {
    const response = await loader({
      request: new Request(
        "https://app.test/api/post-purchase/campaign?shop=demo-shop.myshopify.com&surface=ORDER_STATUS_PAGE",
        {
          headers: { Authorization: "Bearer session-token" },
        },
      ),
      ...loaderArgs(),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.campaign).toBeNull();
  });

  it("blocks post-purchase campaign data below the Pro plan", async () => {
    shopModelMock.getShopByDomain.mockResolvedValue({
      id: "shop-1",
      plan: ShopPlan.STARTER,
      shopifyDomain: "demo-shop.myshopify.com",
    });

    const response = await loader({
      request: new Request(
        "https://app.test/api/post-purchase/campaign?shop=demo-shop.myshopify.com&surface=THANK_YOU_PAGE",
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
      requiredPlan: ShopPlan.PRO,
    });
    expect(campaignModelMock.getActiveCampaignsForShop).not.toHaveBeenCalled();
  });
});

function loaderArgs(): Omit<LoaderFunctionArgs, "request"> {
  return {
    url: new URL("https://app.test/api/post-purchase/campaign"),
    pattern: "/api/post-purchase/campaign",
    params: {},
    context: new RouterContextProvider(),
  };
}

function thankYouCampaign(): StorefrontCampaignSource {
  return baseCampaign({
    id: "thank-you-campaign",
    name: "Thank you offer",
    placementType: "THANK_YOU_PAGE",
    discountCode: "SAVE20",
  });
}

function orderStatusCampaign(): StorefrontCampaignSource {
  return baseCampaign({
    id: "order-status-campaign",
    name: "Order status offer",
    placementType: "ORDER_STATUS_PAGE",
    discountCode: "REORDER10",
  });
}

function baseCampaign({
  id,
  name,
  placementType,
  discountCode,
}: {
  id: string;
  name: string;
  placementType: "THANK_YOU_PAGE" | "ORDER_STATUS_PAGE";
  discountCode: string;
}): StorefrontCampaignSource {
  const now = new Date();
  const startsAt = new Date(now.getTime() - 60 * 1000);
  const endsAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  return {
    id,
    shopId: "shop-1",
    name,
    status: "ACTIVE",
    type: "COUNTDOWN_BAR",
    goal: "FLASH_SALE",
    startsAt,
    endsAt,
    timezone: "UTC",
    priority: 0,
    createdAt: new Date("2026-06-18T11:00:00.000Z"),
    updatedAt: new Date("2026-06-18T11:00:00.000Z"),
    placements: [
      {
        id: `${id}-placement`,
        campaignId: id,
        placementType,
        customSelector: null,
        enabled: true,
      },
    ],
    targeting: null,
    design: null,
    timerSettings: null,
    freeShippingSettings: null,
    deliveryCutoffSettings: null,
    lowStockSettings: null,
    badgeSettings: null,
    discountSync: {
      campaignId: id,
      shopifyDiscountId: null,
      discountCode,
      method: "CODE",
      syncStartEnd: false,
      startsAt: null,
      endsAt: null,
      lastSyncedAt: null,
      createdAt: new Date("2026-06-18T11:00:00.000Z"),
      updatedAt: new Date("2026-06-18T11:00:00.000Z"),
      title: null,
      valueType: null,
      value: null,
      minimumSubtotal: null,
      appliesOncePerCustomer: false,
      uniqueCodePrefix: null,
      uniqueCodeExpiresMinutes: null,
      uniqueCodeAutoApply: false,
      uniqueCodeStartsAt: null,
      uniqueCodeEndsAt: null,
    },
    marketCampaignRules: [],
    translations: [
      {
        id: `${id}-translation`,
        campaignId: id,
        locale: "en",
        headline: name,
        subheadline: "Use this offer after purchase.",
        ctaText: "Shop again",
        ctaUrl: "/collections/sale",
        expiredText: "This offer has ended.",
        freeShippingEmptyText: "",
        freeShippingProgressText: "",
        freeShippingSuccessText: "",
        deliveryBeforeCutoffText: "",
        deliveryAfterCutoffText: "",
        lowStockText: "",
        badgeText: "",
      },
    ],
    experiments: [],
  } as StorefrontCampaignSource;
}
