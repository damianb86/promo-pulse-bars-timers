import { describe, expect, it } from "vitest";

import {
  parseStorefrontCampaignContext,
  serializeStorefrontCampaign,
  serializeStorefrontCampaigns,
  type StorefrontCampaignContext,
  type StorefrontCampaignSource,
} from "./storefront-campaigns";

describe("storefront campaign serialization", () => {
  it("serializes only storefront-safe campaign fields", () => {
    const campaign = buildCampaign({
      discountSync: {
        method: "CODE",
        discountCode: "FLASH20",
        shopifyDiscountId: "gid://shopify/DiscountCodeNode/private",
      },
    });
    const serialized = serializeStorefrontCampaign(campaign, baseContext());

    expect(serialized).toMatchObject({
      id: "campaign-1",
      type: "COUNTDOWN_BAR",
      goal: "FLASH_SALE",
      placement: "TOP_BAR",
      placementSelector: "",
      discount: {
        method: "CODE",
        discountCode: "FLASH20",
      },
      texts: {
        headline: "Sale ends soon",
        ctaUrl: "/collections/sale",
      },
    });
    expect(JSON.stringify(serialized)).not.toContain("shopifyDiscountId");
  });

  it("filters by placement", () => {
    const campaigns = [
      buildCampaign({
        id: "top-bar",
        placements: [{ placementType: "TOP_BAR", enabled: true }],
      }),
      buildCampaign({
        id: "cart-drawer",
        placements: [{ placementType: "CART_DRAWER", enabled: true }],
      }),
    ];

    expect(
      serializeStorefrontCampaigns(campaigns, {
        ...baseContext(),
        placement: "CART_DRAWER",
      }).map((campaign) => campaign.id),
    ).toEqual(["cart-drawer"]);
  });

  it("serializes custom placement selectors for drawer insertion", () => {
    const campaign = buildCampaign({
      placements: [
        {
          placementType: "CART_DRAWER",
          customSelector: "#CartDrawer .drawer__contents",
          enabled: true,
        },
      ],
    });

    expect(
      serializeStorefrontCampaign(campaign, {
        ...baseContext(),
        placement: "CART_DRAWER",
      })?.placementSelector,
    ).toBe("#CartDrawer .drawer__contents");
  });

  it("resolves free shipping thresholds by market and country rules", () => {
    const campaign = buildCampaign({
      type: "FREE_SHIPPING_GOAL",
      goal: "FREE_SHIPPING",
      freeShippingSettings: {
        thresholdAmount: "75.00",
        currencyCode: "USD",
        thresholdRules: {
          countries: { CA: 100 },
          markets: { EU: 80 },
        },
      },
    });

    expect(
      serializeStorefrontCampaign(campaign, {
        ...baseContext(),
        market: "EU",
      })?.freeShipping?.thresholdAmount,
    ).toBe("80.00");

    expect(
      serializeStorefrontCampaign(campaign, {
        ...baseContext(),
        country: "CA",
      })?.freeShipping?.thresholdAmount,
    ).toBe("100.00");
  });

  it("resolves delivery cutoff country rules without exposing raw rules", () => {
    const campaign = buildCampaign({
      type: "DELIVERY_CUTOFF",
      goal: "DELIVERY_CUTOFF",
      deliveryCutoffSettings: {
        cutoffHour: 14,
        countryRules: {
          countries: {
            US: {
              afterCutoffBehavior: "SHOW_AFTER_CUTOFF_MESSAGE",
              cutoffHour: 16,
              maxDeliveryDays: 3,
            },
          },
        },
      },
    });
    const serialized = serializeStorefrontCampaign(campaign, {
      ...baseContext(),
      country: "US",
    });

    expect(serialized?.deliveryCutoff).toMatchObject({
      afterCutoffBehavior: "SHOW_AFTER_CUTOFF_MESSAGE",
      cutoffHour: 16,
      maxDeliveryDays: 3,
    });
    expect(JSON.stringify(serialized?.deliveryCutoff)).not.toContain(
      "countryRules",
    );
  });

  it("serializes low stock and badge settings for storefront blocks", () => {
    const lowStock = serializeStorefrontCampaign(
      buildCampaign({
        type: "LOW_STOCK",
        goal: "LOW_STOCK_URGENCY",
        lowStockSettings: {
          fallbackMessage: "Low stock",
          showExactQuantity: false,
          threshold: 5,
        },
        placements: [{ placementType: "PRODUCT_PAGE", enabled: true }],
      }),
      {
        ...baseContext(),
        placement: "PRODUCT_PAGE",
      },
    );
    const badge = serializeStorefrontCampaign(
      buildCampaign({
        type: "PRODUCT_BADGE",
        goal: "PRODUCT_BADGE",
        badgeSettings: {
          badgePosition: "TOP_LEFT",
          badgeShape: "ROUNDED",
          badgeText: "New drop",
        },
        placements: [{ placementType: "COLLECTION_CARD", enabled: true }],
      }),
      {
        ...baseContext(),
        placement: "COLLECTION_CARD",
      },
    );

    expect(lowStock?.lowStock).toEqual({
      fallbackMessage: "Low stock",
      showExactQuantity: false,
      threshold: 5,
    });
    expect(badge?.badge).toEqual({
      badgePosition: "TOP_LEFT",
      badgeShape: "ROUNDED",
      badgeText: "New drop",
    });
  });

  it("filters by specific campaign id after eligibility", () => {
    const campaigns = [
      buildCampaign({ id: "first" }),
      buildCampaign({ id: "specific" }),
    ];

    expect(
      serializeStorefrontCampaigns(campaigns, {
        ...baseContext(),
        campaignId: "specific",
      }).map((campaign) => campaign.id),
    ).toEqual(["specific"]);
  });

  it("applies inclusion and exclusion targeting", () => {
    const eligibleCampaign = buildCampaign({
      id: "eligible",
      targeting: {
        countries: ["US"],
        locales: ["es"],
        productIds: ["gid://shopify/Product/1"],
        excludeProductIds: ["gid://shopify/Product/999"],
      },
    });
    const excludedCampaign = buildCampaign({
      id: "excluded",
      targeting: {
        countries: ["US"],
        productIds: ["gid://shopify/Product/1"],
        excludeProductIds: ["gid://shopify/Product/1"],
      },
    });

    expect(
      serializeStorefrontCampaigns([eligibleCampaign, excludedCampaign], {
        ...baseContext(),
        country: "US",
        locale: "es-MX",
        productId: "gid://shopify/Product/1",
      }).map((campaign) => campaign.id),
    ).toEqual(["eligible"]);
  });

  it("falls back to English texts when locale text is missing", () => {
    const campaign = buildCampaign({
      translations: [
        {
          locale: "en",
          headline: "English headline",
          ctaText: "Shop sale",
          ctaUrl: "/collections/sale",
        },
        {
          locale: "es",
          headline: "",
          ctaText: "",
          ctaUrl: "",
        },
      ],
    });

    expect(
      serializeStorefrontCampaign(campaign, {
        ...baseContext(),
        locale: "es",
      })?.texts,
    ).toMatchObject({
      headline: "English headline",
      ctaText: "Shop sale",
      ctaUrl: "/collections/sale",
    });
  });

  it("parses comma-separated storefront context values", () => {
    const context = parseStorefrontCampaignContext(
      new URL(
        "https://counterpulse.test/api/storefront/campaigns?shop=https://example.myshopify.com/admin&collectionIds=1,2&productTags=sale,new&cartSubtotal=42.5",
      ),
    );

    expect(context.shop).toBe("example.myshopify.com");
    expect(context.collectionIds).toEqual(["1", "2"]);
    expect(context.productTags).toEqual(["sale", "new"]);
    expect(context.cartSubtotal).toBe(42.5);
  });
});

function baseContext(
  overrides: Partial<StorefrontCampaignContext> = {},
): StorefrontCampaignContext {
  return {
    shop: "example.myshopify.com",
    path: "/collections/sale/products/hoodie",
    locale: "en",
    country: "",
    market: "",
    productId: "",
    collectionIds: [],
    productTags: [],
    customerTags: [],
    device: "",
    utmSource: "",
    cartSubtotal: null,
    currency: "",
    placement: "",
    campaignId: "",
    ...overrides,
  };
}

function buildCampaign(
  overrides: {
    id?: string;
    placements?: Array<{
      placementType: string;
      enabled: boolean;
      customSelector?: string | null;
    }>;
    type?: string;
    goal?: string;
    targeting?: Record<string, string[]>;
    translations?: Array<{
      locale: string;
      headline?: string;
      subheadline?: string;
      ctaText?: string;
      ctaUrl?: string;
    }>;
    discountSync?: {
      method: string;
      discountCode: string;
      shopifyDiscountId: string;
    };
    freeShippingSettings?: {
      thresholdAmount: string;
      currencyCode: string;
      thresholdRules?: unknown;
    };
    deliveryCutoffSettings?: {
      cutoffHour?: number;
      countryRules?: unknown;
    };
    lowStockSettings?: {
      fallbackMessage: string;
      showExactQuantity: boolean;
      threshold: number;
    };
    badgeSettings?: {
      badgePosition: string;
      badgeShape: string;
      badgeText: string;
    };
  } = {},
): StorefrontCampaignSource {
  return {
    id: overrides.id ?? "campaign-1",
    shopId: "shop-1",
    name: "Flash Sale",
    status: "ACTIVE",
    type: (overrides.type ??
      "COUNTDOWN_BAR") as StorefrontCampaignSource["type"],
    goal: (overrides.goal ?? "FLASH_SALE") as StorefrontCampaignSource["goal"],
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    endsAt: new Date("2026-01-02T00:00:00.000Z"),
    timezone: "UTC",
    priority: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    placements: (overrides.placements ?? [
      { placementType: "TOP_BAR", enabled: true },
    ]) as StorefrontCampaignSource["placements"],
    targeting: overrides.targeting
      ? ({
          campaignId: overrides.id ?? "campaign-1",
          countries: [],
          markets: [],
          locales: [],
          productIds: [],
          collectionIds: [],
          productTags: [],
          customerTags: [],
          urlContains: [],
          utmSources: [],
          devices: [],
          excludeProductIds: [],
          excludeCollectionIds: [],
          ...overrides.targeting,
        } as StorefrontCampaignSource["targeting"])
      : null,
    design: null,
    timerSettings: null,
    freeShippingSettings: overrides.freeShippingSettings
      ? ({
          campaignId: overrides.id ?? "campaign-1",
          thresholdAmount: {
            toString: () => overrides.freeShippingSettings!.thresholdAmount,
          },
          currencyCode: overrides.freeShippingSettings.currencyCode,
          includeDiscountedSubtotal: true,
          emptyCartMessage: null,
          successMessage: null,
          progressStyle: "BAR",
          thresholdRules: overrides.freeShippingSettings.thresholdRules ?? null,
        } as StorefrontCampaignSource["freeShippingSettings"])
      : null,
    deliveryCutoffSettings: overrides.deliveryCutoffSettings
      ? ({
          campaignId: overrides.id ?? "campaign-1",
          cutoffHour: overrides.deliveryCutoffSettings.cutoffHour ?? 14,
          cutoffMinute: 0,
          processingDays: 0,
          minDeliveryDays: 2,
          maxDeliveryDays: 5,
          workingDays: [1, 2, 3, 4, 5],
          holidays: [],
          countryRules: overrides.deliveryCutoffSettings.countryRules ?? {},
          afterCutoffBehavior: "SHOW_NEXT_WINDOW",
        } as StorefrontCampaignSource["deliveryCutoffSettings"])
      : null,
    lowStockSettings: overrides.lowStockSettings
      ? ({
          campaignId: overrides.id ?? "campaign-1",
          fallbackMessage: overrides.lowStockSettings.fallbackMessage,
          showExactQuantity: overrides.lowStockSettings.showExactQuantity,
          threshold: overrides.lowStockSettings.threshold,
        } as StorefrontCampaignSource["lowStockSettings"])
      : null,
    badgeSettings: overrides.badgeSettings
      ? ({
          campaignId: overrides.id ?? "campaign-1",
          badgePosition: overrides.badgeSettings.badgePosition,
          badgeShape: overrides.badgeSettings.badgeShape,
          badgeText: overrides.badgeSettings.badgeText,
        } as StorefrontCampaignSource["badgeSettings"])
      : null,
    discountSync: overrides.discountSync
      ? (overrides.discountSync as StorefrontCampaignSource["discountSync"])
      : null,
    translations: (overrides.translations ?? [
      {
        locale: "en",
        headline: "Sale ends soon",
        subheadline: "Save before midnight.",
        ctaText: "Shop sale",
        ctaUrl: "/collections/sale",
      },
    ]) as StorefrontCampaignSource["translations"],
  };
}
