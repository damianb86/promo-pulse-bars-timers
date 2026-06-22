import {
  AnalyticsEventType,
  AttributionModel,
  CampaignDesignIcon,
  CampaignGoal,
  CampaignStatus,
  CampaignType,
  DesignAlignment,
  PlacementType,
  Prisma,
  ShopPlan,
  TimerMode,
} from "@prisma/client";
import {
  RouterContextProvider,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { calculateDeliveryPromise } from "../lib/delivery-promise";
import { calculateFreeShippingProgress } from "../lib/free-shipping";
import {
  recordAnalyticsEvent,
  validateAnalyticsEventPayload,
} from "../models/analytics.server";
import {
  action as storefrontCampaignsAction,
  loader as storefrontCampaignsLoader,
} from "../routes/api.storefront.campaigns";
import { getCampaignStatusAfterTransition } from "../services/campaign-rules";
import {
  canUseFeature,
  evaluateCanActivateCampaign,
  getCampaignPlanViolations,
  isCampaignAllowedByPlan,
} from "../services/planLimits.server";
import { buildCampaignViewModel } from "../utils/campaign-view-model";
import {
  serializeStorefrontCampaign,
  serializeStorefrontCampaigns,
} from "../utils/storefront-campaigns";
import {
  createTestCampaign,
  createTestContext,
  createTestShop,
} from "./factories";

const prismaMock = vi.hoisted(() => ({
  shop: {
    findUnique: vi.fn(),
  },
  shopSettings: {
    findUnique: vi.fn(),
  },
  campaign: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  analyticsEvent: {
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  attributionTouch: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  attributionConversion: {
    create: vi.fn(),
  },
  uniqueDiscountCode: {
    findMany: vi.fn(),
  },
}));

const onboardingMock = vi.hoisted(() => ({
  markFirstImpressionReceived: vi.fn(),
}));

vi.mock("../db.server", () => ({
  default: prismaMock,
}));

vi.mock("../services/onboarding.server", () => onboardingMock);

const storefrontRoutePattern = "/api/storefront/campaigns";

function createLoaderArgs(request: Request): LoaderFunctionArgs {
  return {
    request,
    url: new URL(request.url),
    pattern: storefrontRoutePattern,
    params: {},
    context: new RouterContextProvider(),
  };
}

function createActionArgs(request: Request): ActionFunctionArgs {
  return {
    request,
    url: new URL(request.url),
    pattern: storefrontRoutePattern,
    params: {},
    context: new RouterContextProvider(),
  };
}

describe("Promo Pulse Stage 1 critical flow", () => {
  beforeEach(() => {
    vi.stubEnv("PROMO_PULSE_DEV_PLAN", "");
    vi.clearAllMocks();

    prismaMock.shop.findUnique.mockResolvedValue({
      ...createTestShop({ plan: ShopPlan.GROWTH }),
      settings: {
        analyticsEnabled: true,
        consentMode: "BASIC",
        respectDoNotTrack: true,
      },
    });
    prismaMock.shopSettings.findUnique.mockResolvedValue(null);
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "campaign-1" });
    prismaMock.campaign.findMany.mockResolvedValue([]);
    prismaMock.analyticsEvent.count.mockResolvedValue(0);
    prismaMock.analyticsEvent.findFirst.mockResolvedValue(null);
    prismaMock.analyticsEvent.create.mockImplementation(async () => ({
      id: `event-${prismaMock.analyticsEvent.create.mock.calls.length}`,
    }));
    prismaMock.attributionTouch.create.mockImplementation(async () => ({
      id: `touch-${prismaMock.attributionTouch.create.mock.calls.length}`,
    }));
    prismaMock.attributionTouch.findFirst.mockResolvedValue(null);
    prismaMock.attributionTouch.findMany.mockResolvedValue([]);
    prismaMock.attributionConversion.create.mockImplementation(async () => ({
      id: `conversion-${prismaMock.attributionConversion.create.mock.calls.length}`,
    }));
    prismaMock.uniqueDiscountCode.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates, edits, translates, targets, activates, serializes, and renders a Flash Sale Countdown Bar", () => {
    const shop = createTestShop({ plan: ShopPlan.GROWTH });
    const draftCampaign = createTestCampaign({
      status: CampaignStatus.DRAFT,
      type: CampaignType.COUNTDOWN_BAR,
      goal: CampaignGoal.FLASH_SALE,
      placements: [{ placementType: PlacementType.TOP_BAR }],
      design: {},
      translations: [
        {
          locale: "en",
          headline: "Sale ends soon",
          subheadline: "Save before midnight.",
          ctaText: "Shop sale",
          ctaUrl: "/collections/sale",
          expiredText: "This offer has ended.",
        },
      ],
    });

    const activeCampaign = {
      ...draftCampaign,
      status: getCampaignStatusAfterTransition(
        draftCampaign.status,
        "activate",
      ),
      targeting: {
        campaignId: draftCampaign.id,
        countries: ["US"],
        markets: [],
        locales: ["es"],
        productIds: [],
        collectionIds: [],
        productTags: [],
        customerTags: [],
        urlContains: [],
        excludedUrlContains: [],
        utmSources: [],
        devices: [],
        excludeProductIds: [],
        excludeCollectionIds: [],
        behaviorRules: null,
      },
      design: {
        ...draftCampaign.design!,
        campaignId: draftCampaign.id,
        templateKey: "flash-sale",
        backgroundColor: "#7F1D1D",
        textColor: "#FFFFFF",
        accentColor: "#FDE047",
        buttonColor: "#FFFFFF",
        buttonTextColor: "#7F1D1D",
        fontSize: 15,
        borderRadius: 6,
        positionSticky: true,
        customCss: null,
        mobileEnabled: true,
        alignment: DesignAlignment.CENTER,
        showCloseButton: true,
        showIcon: true,
        icon: CampaignDesignIcon.FIRE,
      },
      translations: [
        ...draftCampaign.translations,
        {
          id: "campaign-1-translation-es",
          campaignId: draftCampaign.id,
          locale: "es",
          headline: "La oferta termina pronto",
          subheadline: "Ahorra antes de medianoche.",
          ctaText: "Comprar oferta",
          ctaUrl: "/collections/sale",
          expiredText: "Esta oferta terminó.",
          freeShippingEmptyText: null,
          freeShippingProgressText: null,
          freeShippingSuccessText: null,
          deliveryBeforeCutoffText: null,
          deliveryAfterCutoffText: null,
          lowStockText: null,
          badgeText: null,
        },
      ],
    };

    expect(shop.shopifyDomain).toBe("example.myshopify.com");
    expect(activeCampaign.status).toBe(CampaignStatus.ACTIVE);

    const eligibleCampaigns = serializeStorefrontCampaigns(
      [activeCampaign],
      createTestContext({
        country: "US",
        locale: "es",
        placement: PlacementType.TOP_BAR,
      }),
    );

    expect(eligibleCampaigns).toHaveLength(1);
    expect(eligibleCampaigns[0]).toMatchObject({
      id: "campaign-1",
      type: CampaignType.COUNTDOWN_BAR,
      goal: CampaignGoal.FLASH_SALE,
      placement: PlacementType.TOP_BAR,
      design: {
        templateKey: "flash-sale",
        showIcon: true,
        icon: CampaignDesignIcon.FIRE,
      },
      texts: {
        headline: "La oferta termina pronto",
        ctaText: "Comprar oferta",
      },
    });

    expect(
      serializeStorefrontCampaigns(
        [activeCampaign],
        createTestContext({
          country: "CA",
          locale: "es",
          placement: PlacementType.TOP_BAR,
        }),
      ),
    ).toEqual([]);

    const viewModel = buildCampaignViewModel({
      ...activeCampaign,
      design: {
        ...activeCampaign.design,
        customCss: activeCampaign.design.customCss ?? "",
      },
    });

    expect(viewModel).toMatchObject({
      name: "Flash Sale Countdown Bar",
      type: CampaignType.COUNTDOWN_BAR,
      placements: [PlacementType.TOP_BAR],
      headline: "Sale ends soon",
      design: {
        templateKey: "flash-sale",
        backgroundColor: "#7F1D1D",
      },
      timer: {
        mode: TimerMode.FIXED_DATE,
      },
    });
  });

  it("serves eligible storefront campaigns through the public API and filters targeting mismatches", async () => {
    const activeCampaign = createTestCampaign({
      status: CampaignStatus.ACTIVE,
      type: CampaignType.COUNTDOWN_BAR,
      goal: CampaignGoal.FLASH_SALE,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      placements: [{ placementType: PlacementType.TOP_BAR }],
      targeting: {
        countries: ["US"],
        locales: ["es"],
      },
      translations: [
        {
          locale: "en",
          headline: "Sale ends soon",
          ctaText: "Shop sale",
          ctaUrl: "/collections/sale",
        },
        {
          locale: "es",
          headline: "La oferta termina pronto",
          ctaText: "Comprar oferta",
          ctaUrl: "/collections/sale",
        },
      ],
    });

    prismaMock.campaign.findMany.mockResolvedValue([activeCampaign]);

    const eligibleResponse = await storefrontCampaignsLoader(
      createLoaderArgs(
        new Request(
          "https://app.test/api/storefront/campaigns?shop=EXAMPLE.myshopify.com&path=/collections/sale&locale=es&country=US&placement=TOP_BAR",
          { headers: { "x-forwarded-for": "203.0.113.10" } },
        ),
      ),
    );
    const eligibleBody = await eligibleResponse.json();

    expect(eligibleResponse.status).toBe(200);
    expect(eligibleResponse.headers.get("Cache-Control")).toContain(
      "max-age=45",
    );
    expect(prismaMock.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          publishedAt: { not: null },
          shopId: "shop-1",
        }),
      }),
    );
    expect(eligibleBody.campaigns).toHaveLength(1);
    expect(eligibleBody.campaigns[0]).toMatchObject({
      id: activeCampaign.id,
      placement: PlacementType.TOP_BAR,
      texts: {
        headline: "La oferta termina pronto",
        ctaText: "Comprar oferta",
      },
    });
    expect(eligibleBody.campaigns[0]).not.toHaveProperty("shopId");

    const mismatchResponse = await storefrontCampaignsLoader(
      createLoaderArgs(
        new Request(
          "https://app.test/api/storefront/campaigns?shop=example.myshopify.com&path=/collections/sale&locale=es&country=CA&placement=TOP_BAR",
          { headers: { "x-forwarded-for": "203.0.113.11" } },
        ),
      ),
    );
    const mismatchBody = await mismatchResponse.json();

    expect(mismatchResponse.status).toBe(200);
    expect(mismatchBody.campaigns).toEqual([]);
  });

  it("serves behavior-targeted storefront campaigns from anonymous visitor history", async () => {
    prismaMock.shop.findUnique.mockResolvedValue({
      ...createTestShop({ plan: ShopPlan.PRO }),
      settings: {
        analyticsEnabled: true,
        consentMode: "BASIC",
        respectDoNotTrack: true,
      },
    });
    const activeCampaign = createTestCampaign({
      id: "behavior-campaign",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.COUNTDOWN_BAR,
      goal: CampaignGoal.FLASH_SALE,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      placements: [{ placementType: PlacementType.TOP_BAR }],
      targeting: {
        behaviorRules: {
          enabled: true,
          segments: ["CLICKED_CAMPAIGN"],
          campaignIds: ["source-campaign"],
          lookbackDays: 30,
          inactiveCartMinutes: 60,
          highIntentMinEvents: 3,
          highIntentWindowMinutes: 60,
        },
      },
    });

    prismaMock.campaign.findMany.mockResolvedValue([activeCampaign]);
    prismaMock.attributionTouch.findMany.mockResolvedValue([
      {
        id: "touch-1",
        shopId: "shop-1",
        campaignId: "source-campaign",
        experimentId: null,
        variantId: null,
        visitorId: "visitor-1",
        sessionId: "session-1",
        eventType: AnalyticsEventType.CLICK,
        placementType: PlacementType.TOP_BAR,
        path: "/collections/sale",
        country: "US",
        locale: "en",
        occurredAt: new Date("2026-06-18T11:00:00.000Z"),
      },
    ]);

    const response = await storefrontCampaignsLoader(
      createLoaderArgs(
        new Request(
          "https://app.test/api/storefront/campaigns?shop=example.myshopify.com&placement=TOP_BAR&visitorId=visitor-1&sessionId=session-1&consentGranted=true",
          { headers: { "x-forwarded-for": "203.0.113.12" } },
        ),
      ),
    );
    const body = await response.json();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(prismaMock.attributionTouch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ visitorId: "visitor-1" }, { sessionId: "session-1" }],
        }),
      }),
    );
    expect(
      body.campaigns.map((campaign: { id: string }) => campaign.id),
    ).toEqual(["behavior-campaign"]);
  });

  it("validates storefront API input and disables cache for dynamic cart or UTM context", async () => {
    const missingShopResponse = await storefrontCampaignsLoader(
      createLoaderArgs(
        new Request(
          "https://app.test/api/storefront/campaigns?placement=TOP_BAR",
        ),
      ),
    );

    expect(missingShopResponse.status).toBe(400);

    const dynamicResponse = await storefrontCampaignsLoader(
      createLoaderArgs(
        new Request(
          "https://app.test/api/storefront/campaigns?shop=example.myshopify.com&placement=CART_DRAWER&cartSubtotal=42&utmSource=newsletter",
          { headers: { "x-forwarded-for": "203.0.113.12" } },
        ),
      ),
    );

    expect(dynamicResponse.status).toBe(200);
    expect(dynamicResponse.headers.get("Cache-Control")).toBe("no-store");
  });

  it("creates and serializes a Free Shipping Goal with progress calculation", () => {
    const campaign = createTestCampaign({
      id: "free-shipping-1",
      name: "Free Shipping Goal",
      type: CampaignType.FREE_SHIPPING_GOAL,
      goal: CampaignGoal.FREE_SHIPPING,
      placements: [{ placementType: PlacementType.CART_DRAWER }],
      freeShippingSettings: {
        thresholdAmount: new Prisma.Decimal("100.00"),
        currencyCode: "USD",
      },
      translations: [
        {
          locale: "en",
          headline: "Unlock free shipping",
          freeShippingProgressText: "You're {{amount}} away from free shipping",
          freeShippingSuccessText: "You've unlocked free shipping!",
        },
      ],
    });

    const serialized = serializeStorefrontCampaign(
      campaign,
      createTestContext({
        cartSubtotal: 40,
        placement: PlacementType.CART_DRAWER,
      }),
    );
    const progress = calculateFreeShippingProgress(100, 40);

    expect(serialized).toMatchObject({
      id: "free-shipping-1",
      type: CampaignType.FREE_SHIPPING_GOAL,
      placement: PlacementType.CART_DRAWER,
      freeShipping: {
        thresholdAmount: "100.00",
        currencyCode: "USD",
      },
    });
    expect(progress).toMatchObject({
      amountRemaining: 60,
      percentage: 40,
      unlocked: false,
    });
  });

  it("creates and serializes a Delivery Cutoff campaign with promise calculation", () => {
    const campaign = createTestCampaign({
      id: "delivery-1",
      name: "Delivery Cutoff",
      type: CampaignType.DELIVERY_CUTOFF,
      goal: CampaignGoal.DELIVERY_CUTOFF,
      timezone: "America/New_York",
      placements: [{ placementType: PlacementType.PRODUCT_PAGE }],
      deliveryCutoffSettings: {
        cutoffHour: 14,
        cutoffMinute: 0,
        processingDays: 0,
        minDeliveryDays: 2,
        maxDeliveryDays: 4,
        workingDays: [1, 2, 3, 4, 5],
        holidays: [],
      },
      translations: [
        {
          locale: "en",
          headline: "Delivery estimate",
          deliveryBeforeCutoffText:
            "Order within {{time_left}} to get it by {{max_delivery_weekday}}",
        },
      ],
    });

    const serialized = serializeStorefrontCampaign(
      campaign,
      createTestContext({ placement: PlacementType.PRODUCT_PAGE }),
    );
    const promise = calculateDeliveryPromise(
      {
        ...campaign.deliveryCutoffSettings!,
        timezone: campaign.timezone,
      },
      new Date("2026-06-16T16:00:00.000Z"),
      "en",
    );

    expect(serialized).toMatchObject({
      id: "delivery-1",
      type: CampaignType.DELIVERY_CUTOFF,
      deliveryCutoff: {
        cutoffHour: 14,
        minDeliveryDays: 2,
        maxDeliveryDays: 4,
      },
    });
    expect(promise.beforeCutoff).toBe(true);
    expect(promise.timeRemainingMs).toBe(2 * 60 * 60 * 1000);
    expect(promise.messageVariables.max_delivery_weekday).toBeTruthy();
  });

  it("validates and records analytics impression and click events with mocked persistence", async () => {
    const impression = validateAnalyticsEventPayload({
      shop: "example.myshopify.com",
      campaignId: "campaign-1",
      eventType: AnalyticsEventType.IMPRESSION,
      placementType: PlacementType.TOP_BAR,
      sessionId: "session-1",
      country: "us",
      locale: "es",
      path: "/collections/sale",
    });
    const click = validateAnalyticsEventPayload({
      shop: "example.myshopify.com",
      campaignId: "campaign-1",
      eventType: AnalyticsEventType.CLICK,
      placementType: PlacementType.TOP_BAR,
      sessionId: "session-1",
    });

    expect(impression.ok).toBe(true);
    expect(click.ok).toBe(true);

    if (!impression.ok || !click.ok) {
      throw new Error("Expected valid analytics payloads.");
    }

    await expect(
      recordAnalyticsEvent(
        impression.payload,
        new Date("2026-06-16T12:00:00.000Z"),
      ),
    ).resolves.toMatchObject({ saved: true, deduped: false });
    await expect(
      recordAnalyticsEvent(click.payload, new Date("2026-06-16T12:01:00.000Z")),
    ).resolves.toMatchObject({ saved: true, deduped: false });

    expect(prismaMock.analyticsEvent.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.analyticsEvent.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: AnalyticsEventType.IMPRESSION,
          placementType: PlacementType.TOP_BAR,
          sessionId: "session-1",
        }),
      }),
    );
    expect(prismaMock.analyticsEvent.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: AnalyticsEventType.CLICK,
        }),
      }),
    );
    expect(prismaMock.attributionTouch.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.attributionTouch.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: AnalyticsEventType.IMPRESSION,
          sessionId: "session-1",
        }),
      }),
    );
    expect(onboardingMock.markFirstImpressionReceived).toHaveBeenCalledWith(
      "shop-1",
    );
  });

  it("records checkout completed analytics as an attribution conversion", async () => {
    const completedCheckout = validateAnalyticsEventPayload({
      shop: "example.myshopify.com",
      campaignId: "campaign-1",
      experimentId: "experiment-1",
      variantId: "variant-1",
      visitorId: "visitor-1",
      sessionId: "session-1",
      eventType: AnalyticsEventType.ORDER_ATTRIBUTED,
      placementType: PlacementType.TOP_BAR,
      orderId: "gid://shopify/Order/1",
      revenueAmount: "128.50",
      currencyCode: "usd",
    });

    expect(completedCheckout.ok).toBe(true);

    if (!completedCheckout.ok) {
      throw new Error("Expected valid checkout analytics payload.");
    }

    prismaMock.attributionTouch.findFirst.mockResolvedValue({
      campaignId: "campaign-1",
      experimentId: "experiment-1",
      variantId: "variant-1",
    });

    await expect(
      recordAnalyticsEvent(
        completedCheckout.payload,
        new Date("2026-06-16T12:02:00.000Z"),
      ),
    ).resolves.toMatchObject({
      saved: true,
      deduped: false,
      attributionConversionId: "conversion-1",
    });

    expect(prismaMock.attributionTouch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: AnalyticsEventType.ORDER_ATTRIBUTED,
          visitorId: "visitor-1",
          sessionId: "session-1",
        }),
      }),
    );
    expect(prismaMock.attributionConversion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attributionModel: AttributionModel.LAST_TOUCH_7D,
          campaignId: "campaign-1",
          experimentId: "experiment-1",
          variantId: "variant-1",
          orderId: "gid://shopify/Order/1",
          visitorId: "visitor-1",
          sessionId: "session-1",
        }),
      }),
    );
  });

  it("records analytics events through the public app proxy action and rejects invalid payloads", async () => {
    const invalidResponse = await storefrontCampaignsAction(
      createActionArgs(
        new Request("https://app.test/api/storefront/campaigns", {
          method: "POST",
          body: JSON.stringify({
            shop: "example.myshopify.com",
            eventType: AnalyticsEventType.CLICK,
          }),
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    expect(invalidResponse.status).toBe(400);

    const clickResponse = await storefrontCampaignsAction(
      createActionArgs(
        new Request("https://app.test/api/storefront/campaigns", {
          method: "POST",
          body: JSON.stringify({
            shop: "example.myshopify.com",
            campaignId: "campaign-1",
            eventType: AnalyticsEventType.CLICK,
            placementType: PlacementType.TOP_BAR,
            sessionId: "session-2",
            path: "/collections/sale",
          }),
          headers: {
            "content-type": "application/json",
            "user-agent": "vitest-stage-one",
          },
        }),
      ),
    );
    const clickBody = await clickResponse.json();

    expect(clickResponse.status).toBe(201);
    expect(clickBody).toMatchObject({
      ok: true,
      saved: true,
      deduped: false,
    });
    expect(prismaMock.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: AnalyticsEventType.CLICK,
          placementType: PlacementType.TOP_BAR,
          sessionId: "session-2",
          userAgent: "vitest-stage-one",
        }),
      }),
    );
  });

  it("blocks Stage 1 premium features according to plan limits", () => {
    const freeShop = createTestShop({ plan: ShopPlan.FREE });
    const proShop = createTestShop({ plan: ShopPlan.PRO });
    const premiumCampaign = createTestCampaign({
      type: CampaignType.PRODUCT_BADGE,
      goal: CampaignGoal.PRODUCT_BADGE,
      startsAt: null,
      placements: [{ placementType: PlacementType.CART_DRAWER }],
      design: { customCss: ".pp-badge { letter-spacing: 0; }" },
    });

    expect(evaluateCanActivateCampaign(ShopPlan.FREE, 1, false)).toMatchObject({
      allowed: false,
      requiredPlan: ShopPlan.STARTER,
    });
    expect(canUseFeature(freeShop, "custom_css")).toMatchObject({
      allowed: false,
      requiredPlan: ShopPlan.PRO,
    });
    expect(
      getCampaignPlanViolations(
        freeShop,
        premiumCampaign,
        PlacementType.CART_DRAWER,
      ),
    ).toEqual([
      "Product Badges requires the Pro plan.",
      "Cart Drawer requires the Growth plan.",
      "Custom CSS requires the Pro plan.",
    ]);
    expect(
      isCampaignAllowedByPlan(
        proShop,
        premiumCampaign,
        PlacementType.CART_DRAWER,
      ),
    ).toBe(true);
  });
});
