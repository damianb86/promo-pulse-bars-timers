import {
  AgencyShopRole,
  AnalyticsEventType,
  AttributionModel,
  BadgePosition,
  BadgeShape,
  CampaignDesignIcon,
  CampaignGoal,
  CampaignRecommendationStatus,
  CampaignRecommendationType,
  CampaignStatus,
  CampaignType,
  DesignBackgroundType,
  DeliveryAfterCutoffBehavior,
  DesignAlignment,
  DesignFontFamily,
  DesignLayout,
  DesignPositionMode,
  DesignTimerFormat,
  DesignTimerStyle,
  DiscountCodePoolStatus,
  DiscountCodeValueType,
  DiscountSyncMethod,
  ExperimentPrimaryMetric,
  ExperimentStatus,
  ExperimentVariantStatus,
  PlacementType,
  Prisma,
  ShopPlan,
  TimerExpiredBehavior,
  TimerMode,
  TimerResetBehavior,
  UniqueDiscountCodeStatus,
} from "@prisma/client";

import prisma from "../db.server";
import { publishCampaignForShop } from "../models/campaign.server";

export const E2E_DEMO_SHOP_DOMAIN =
  process.env.E2E_DEMO_SHOP_DOMAIN?.trim() || "demo-shop.myshopify.com";
export const E2E_AUTH_COOKIE =
  process.env.E2E_AUTH_COOKIE?.trim() || "promo_pulse_e2e_shop";

export type E2ETestScenario =
  | "empty"
  | "campaign-type-countdown"
  | "campaign-type-product-timer"
  | "campaign-type-cart-timer"
  | "campaign-type-free-shipping"
  | "campaign-type-free-shipping-circular"
  | "campaign-type-delivery-cutoff"
  | "campaign-type-low-stock"
  | "campaign-type-product-badge"
  | "campaign-targeting-filters"
  | "campaign-custom-selector"
  | "countdown"
  | "countdown-consent-strict"
  | "targeting"
  | "behavior-targeting"
  | "free-shipping"
  | "delivery-cutoff"
  | "delivery-cutoff-after"
  | "cart-drawer"
  | "analytics"
  | "premium"
  | "ab-test"
  | "auto-winner"
  | "unique-discount"
  | "unique-discount-expired"
  | "reports"
  | "recommendations"
  | "agency"
  | "template-library"
  | "post-purchase";

export function isE2ETestMode() {
  return (
    process.env.E2E_TEST_MODE === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

export function requireE2ETestMode() {
  if (!isE2ETestMode()) {
    throw new Response("Not found", { status: 404 });
  }
}

export function hasE2EAuthCookie(request: Request) {
  const cookies = parseCookieHeader(request.headers.get("cookie") ?? "");

  return cookies[E2E_AUTH_COOKIE] === E2E_DEMO_SHOP_DOMAIN;
}

export function buildE2ELoginCookie() {
  return `${E2E_AUTH_COOKIE}=${E2E_DEMO_SHOP_DOMAIN}; Path=/; HttpOnly; SameSite=Lax`;
}

export function buildE2ELogoutCookie() {
  return `${E2E_AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function ensureE2EShop() {
  requireE2ETestMode();

  const shop = await upsertE2EShop();

  await prisma.shopSettings.upsert({
    where: { shopId: shop.id },
    update: {},
    create: {
      shopId: shop.id,
      analyticsEnabled: true,
      consentMode: "BASIC",
      defaultCountry: "US",
      defaultCurrency: "USD",
      defaultLocale: "en",
      defaultTimezone: "America/New_York",
      enableDebugMode: true,
      enabledLocales: ["en", "es", "pt-BR", "fr", "de"],
      respectDoNotTrack: false,
    },
  });

  await prisma.shopOnboardingChecklist.upsert({
    where: { shopId: shop.id },
    update: {},
    create: { shopId: shop.id },
  });

  return shop;
}

async function upsertE2EShop() {
  try {
    return await prisma.shop.upsert({
      where: { shopifyDomain: E2E_DEMO_SHOP_DOMAIN },
      update: {},
      create: {
        shopifyDomain: E2E_DEMO_SHOP_DOMAIN,
        plan: ShopPlan.PRO,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const shop = await prisma.shop.findUnique({
        where: { shopifyDomain: E2E_DEMO_SHOP_DOMAIN },
      });

      if (shop) return shop;
    }

    throw error;
  }
}

export async function resetE2ETestDatabase(
  scenario: E2ETestScenario = "empty",
) {
  requireE2ETestMode();

  await prisma.$transaction([
    prisma.analyticsEvent.deleteMany({}),
    prisma.campaign.deleteMany({}),
    prisma.agencyAccount.deleteMany({}),
    prisma.shopOnboardingChecklist.deleteMany({}),
    prisma.shopSettings.deleteMany({}),
    prisma.session.deleteMany({}),
    prisma.shop.deleteMany({}),
  ]);

  const shop = await ensureE2EShop();

  if (scenario !== "empty") {
    await seedScenario(shop.id, scenario);
    await publishE2EActiveCampaigns();
  }

  const campaignCount = await prisma.campaign.count({
    where: { shopId: shop.id },
  });

  await prisma.shopOnboardingChecklist.update({
    where: { shopId: shop.id },
    data: {
      firstCampaignCreated: campaignCount > 0,
      appEmbedEnabled: true,
      productBlockAdded: true,
      cartBlockAdded: true,
    },
  });

  return { shop, campaignCount, scenario };
}

function parseCookieHeader(header: string) {
  return header.split(";").reduce<Record<string, string>>((cookies, part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) return cookies;
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

async function publishE2EActiveCampaigns() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: CampaignStatus.ACTIVE },
    select: { id: true, shopId: true },
  });

  for (const campaign of campaigns) {
    await publishCampaignForShop(campaign.id, campaign.shopId);
  }
}

async function seedScenario(shopId: string, scenario: E2ETestScenario) {
  if (
    scenario === "ab-test" ||
    scenario === "auto-winner" ||
    scenario === "reports" ||
    scenario.startsWith("unique-discount")
  ) {
    await prisma.shop.update({
      where: { id: shopId },
      data: { plan: ShopPlan.PREMIUM },
    });
  }

  if (scenario === "countdown") {
    await createCountdownCampaign(shopId, {});
    return;
  }

  if (scenario === "campaign-type-countdown") {
    await createCountdownCampaign(shopId, {
      placements: [PlacementType.TOP_BAR],
      translations: [
        {
          ...englishTranslation("Flash sale ends soon"),
          subheadline: "Countdown bar across the storefront.",
          ctaText: "Shop countdown",
        },
      ],
    });
    await createCountdownCampaign(shopId, {
      placements: [PlacementType.BOTTOM_BAR],
      translations: [
        {
          ...englishTranslation("Bottom bar flash sale"),
          subheadline: "Countdown bar anchored at the bottom.",
          ctaText: "Shop bottom bar",
        },
      ],
    });
    return;
  }

  if (scenario === "campaign-type-product-timer") {
    await createProductTimerCampaign(shopId);
    return;
  }

  if (scenario === "campaign-type-cart-timer") {
    await createCartTimerCampaign(shopId, [
      PlacementType.CART_PAGE,
      PlacementType.CART_DRAWER,
    ]);
    return;
  }

  if (scenario === "campaign-type-free-shipping") {
    await createFreeShippingCampaign(
      shopId,
      [PlacementType.CART_PAGE, PlacementType.CART_DRAWER],
      {
        thresholdAmount: 50,
        progressStyle: "BAR",
      },
    );
    return;
  }

  if (scenario === "campaign-type-free-shipping-circular") {
    await createFreeShippingCampaign(shopId, [PlacementType.CART_PAGE], {
      thresholdAmount: 80,
      progressStyle: "CIRCULAR",
    });
    return;
  }

  if (scenario === "campaign-type-delivery-cutoff") {
    await createDeliveryCutoffCampaign(shopId);
    return;
  }

  if (scenario === "campaign-type-low-stock") {
    await createLowStockCampaign(shopId);
    return;
  }

  if (scenario === "campaign-type-product-badge") {
    await createProductBadgeCampaign(shopId);
    return;
  }

  if (scenario === "campaign-targeting-filters") {
    await createTargetingMatrixCampaigns(shopId);
    return;
  }

  if (scenario === "campaign-custom-selector") {
    await createCustomSelectorCampaign(shopId);
    return;
  }

  if (scenario === "countdown-consent-strict") {
    await prisma.shopSettings.update({
      where: { shopId },
      data: {
        consentMode: "STRICT",
        respectDoNotTrack: true,
      },
    });
    await createCountdownCampaign(shopId, {});
    return;
  }

  if (scenario === "targeting") {
    await createCountdownCampaign(shopId, {
      targeting: {
        countries: ["AR"],
        locales: ["es"],
      },
      translations: [
        englishTranslation("Sale ends soon"),
        {
          locale: "es",
          headline: "La oferta termina pronto",
          subheadline: "Ahorra antes de medianoche.",
          ctaText: "Comprar oferta",
          ctaUrl: "/collections/sale",
          expiredText: "Esta oferta termino.",
        },
      ],
    });
    return;
  }

  if (scenario === "behavior-targeting") {
    await createCountdownCampaign(shopId, {
      targeting: {
        behaviorRules: {
          enabled: true,
          segments: ["NEW_VISITOR"],
          campaignIds: [],
          lookbackDays: 30,
          inactiveCartMinutes: 60,
          highIntentMinEvents: 3,
          highIntentWindowMinutes: 60,
        },
      },
      translations: [
        {
          ...englishTranslation("New visitor offer"),
          subheadline: "Shown only before the first Promo Pulse touch.",
        },
      ],
    });
    return;
  }

  if (scenario === "free-shipping") {
    await createFreeShippingCampaign(shopId, [
      PlacementType.CART_PAGE,
      PlacementType.CART_DRAWER,
    ]);
    return;
  }

  if (scenario === "delivery-cutoff") {
    await createDeliveryCutoffCampaign(shopId);
    return;
  }

  if (scenario === "delivery-cutoff-after") {
    await createDeliveryCutoffCampaign(shopId, {
      afterCutoffBehavior: "SHOW_AFTER_CUTOFF_MESSAGE",
    });
    return;
  }

  if (scenario === "cart-drawer") {
    await createCartTimerCampaign(shopId);
    return;
  }

  if (scenario === "analytics") {
    await prisma.shop.update({
      where: { id: shopId },
      data: { plan: ShopPlan.PREMIUM },
    });
    await createCountdownCampaign(shopId, {
      discountCode: "SAVE20",
    });
    return;
  }

  if (scenario === "premium") {
    await prisma.shop.update({
      where: { id: shopId },
      data: { plan: ShopPlan.PREMIUM },
    });
    return;
  }

  if (scenario === "ab-test") {
    await createAbTestCampaign(shopId);
    return;
  }

  if (scenario === "auto-winner") {
    await createAutoWinnerScenario(shopId);
    return;
  }

  if (scenario === "unique-discount") {
    await createUniqueDiscountCampaign(shopId);
    return;
  }

  if (scenario === "unique-discount-expired") {
    await createUniqueDiscountCampaign(shopId, { codes: [] });
    return;
  }

  if (scenario === "reports") {
    await createReportsScenario(shopId);
    return;
  }

  if (scenario === "recommendations") {
    await createRecommendationsScenario(shopId);
    return;
  }

  if (scenario === "agency") {
    await createAgencyScenario(shopId);
    return;
  }

  if (scenario === "template-library") {
    return;
  }

  if (scenario === "post-purchase") {
    await createPostPurchaseCampaigns(shopId);
  }
}

async function createCountdownCampaign(
  shopId: string,
  options: {
    targeting?: {
      countries?: string[];
      locales?: string[];
      behaviorRules?: Prisma.InputJsonValue;
    };
    discountCode?: string;
    translations?: Array<{
      locale: string;
      headline: string;
      subheadline?: string;
      ctaText?: string;
      ctaUrl?: string;
      expiredText?: string;
    }>;
    placements?: PlacementType[];
  },
) {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  return prisma.campaign.create({
    data: {
      shopId,
      name: "E2E Flash Sale Countdown",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.COUNTDOWN_BAR,
      goal: CampaignGoal.FLASH_SALE,
      startsAt: new Date(now.getTime() - 60 * 1000),
      endsAt,
      timezone: "America/New_York",
      placements: {
        create: (options.placements ?? [PlacementType.TOP_BAR]).map(
          (placementType) => ({
            placementType,
            enabled: true,
          }),
        ),
      },
      targeting: options.targeting
        ? {
            create: {
              countries: options.targeting.countries ?? [],
              markets: [],
              locales: options.targeting.locales ?? [],
              productIds: [],
              collectionIds: [],
              productTags: [],
              customerTags: [],
              urlContains: [],
              utmSources: [],
              devices: [],
              excludeProductIds: [],
              excludeCollectionIds: [],
              behaviorRules: options.targeting.behaviorRules ?? Prisma.JsonNull,
            },
          }
        : undefined,
      design: {
        create: flashSaleDesign(),
      },
      timerSettings: {
        create: {
          mode: TimerMode.FIXED_DATE,
          durationMinutes: null,
          recurringDays: [],
          resetBehavior: TimerResetBehavior.NEVER,
          expiredBehavior: TimerExpiredBehavior.UNPUBLISH_TIMER,
        },
      },
      discountSync: options.discountCode
        ? {
            create: {
              discountCode: options.discountCode,
              method: DiscountSyncMethod.CODE,
              syncStartEnd: false,
            },
          }
        : undefined,
      translations: {
        create: options.translations ?? [englishTranslation("Sale ends soon")],
      },
    },
  });
}

async function createAbTestCampaign(shopId: string) {
  const now = new Date();
  const campaign = await createCountdownCampaign(shopId, {
    discountCode: "CONTROL10",
    translations: [
      {
        ...englishTranslation("Control headline"),
        ctaText: "Shop control",
      },
    ],
  });

  await prisma.experiment.create({
    data: {
      id: "e2e-experiment-headline",
      shopId,
      campaignId: campaign.id,
      name: "E2E Headline Test",
      status: ExperimentStatus.RUNNING,
      trafficSplitStrategy: "WEIGHTED",
      primaryMetric: ExperimentPrimaryMetric.CLICK_RATE,
      startsAt: new Date(now.getTime() - 60 * 1000),
      variants: {
        create: [
          {
            id: "e2e-variant-control",
            campaign: { connect: { id: campaign.id } },
            name: "Control",
            weight: 0,
            status: ExperimentVariantStatus.ACTIVE,
            textOverride: {
              headline: "Control headline",
              ctaText: "Shop control",
            },
          },
          {
            id: "e2e-variant-treatment",
            campaign: { connect: { id: campaign.id } },
            name: "Treatment",
            weight: 100,
            status: ExperimentVariantStatus.ACTIVE,
            textOverride: {
              headline: "Variant headline",
              subheadline: "A/B treatment copy.",
              ctaText: "Shop variant",
            },
            designOverride: {
              backgroundColor: "#064E3B",
              accentColor: "#34D399",
            },
            discountOverride: {
              discountCode: "VARIANT20",
            },
          },
        ],
      },
    },
  });

  return campaign;
}

async function createUniqueDiscountCampaign(
  shopId: string,
  options: { codes?: string[] } = {},
) {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const codes = options.codes ?? [
    "E2E-VISITOR-001",
    "E2E-VISITOR-002",
    "E2E-VISITOR-003",
    "E2E-VISITOR-004",
  ];

  const campaign = await prisma.campaign.create({
    data: {
      shopId,
      name: "E2E Unique Visitor Discount",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.COUNTDOWN_BAR,
      goal: CampaignGoal.FLASH_SALE,
      startsAt: new Date(now.getTime() - 60 * 1000),
      endsAt,
      timezone: "America/New_York",
      placements: {
        create: [{ placementType: PlacementType.TOP_BAR, enabled: true }],
      },
      design: {
        create: flashSaleDesign(),
      },
      timerSettings: {
        create: {
          mode: TimerMode.FIXED_DATE,
          durationMinutes: null,
          recurringDays: [],
          resetBehavior: TimerResetBehavior.NEVER,
          expiredBehavior: TimerExpiredBehavior.UNPUBLISH_TIMER,
        },
      },
      discountSync: {
        create: {
          method: DiscountSyncMethod.UNIQUE_CODE,
          syncStartEnd: false,
          title: "E2E unique visitor discount",
          valueType: "PERCENTAGE",
          value: "15",
          appliesOncePerCustomer: true,
          uniqueCodePrefix: "E2E",
          uniqueCodeExpiresMinutes: 60,
          uniqueCodeAutoApply: true,
          uniqueCodeStartsAt: new Date(now.getTime() - 60 * 1000),
          uniqueCodeEndsAt: endsAt,
        },
      },
      translations: {
        create: [
          {
            locale: "en",
            headline: "Private code unlocked",
            subheadline: "Save with your unique visitor code.",
            ctaText: "Shop sale",
            ctaUrl: "/collections/sale",
            expiredText: "This offer has ended.",
          },
        ],
      },
    },
  });

  await prisma.discountCodePool.create({
    data: {
      shopId,
      campaignId: campaign.id,
      prefix: "E2E",
      discountType: DiscountCodeValueType.PERCENTAGE,
      value: new Prisma.Decimal(15),
      startsAt: new Date(now.getTime() - 60 * 1000),
      expiresAt: endsAt,
      totalGenerated: codes.length,
      status: DiscountCodePoolStatus.ACTIVE,
    },
  });

  if (codes.length > 0) {
    await prisma.uniqueDiscountCode.createMany({
      data: codes.map((code) => ({
        shopId,
        campaignId: campaign.id,
        code,
        expiresAt: endsAt,
        status: UniqueDiscountCodeStatus.AVAILABLE,
      })),
    });
  }

  return campaign;
}

async function createAutoWinnerScenario(shopId: string) {
  const now = new Date();
  const campaign = await createCountdownCampaign(shopId, {
    discountCode: "CONTROL10",
    translations: [
      {
        ...englishTranslation("Auto winner control"),
        subheadline: "Control copy before the winner is applied.",
      },
    ],
  });

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { name: "E2E Auto Winner Campaign" },
  });

  await prisma.experiment.create({
    data: {
      id: "e2e-auto-winner-experiment",
      shopId,
      campaignId: campaign.id,
      name: "E2E Auto Winner Test",
      status: ExperimentStatus.RUNNING,
      trafficSplitStrategy: "WEIGHTED",
      primaryMetric: ExperimentPrimaryMetric.CLICK_RATE,
      startsAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      autoWinnerEnabled: true,
      autoWinnerMinSampleSize: 50,
      autoWinnerMinRuntimeHours: 1,
      autoWinnerConfidenceThreshold: 0.7,
      variants: {
        create: [
          {
            id: "e2e-auto-winner-control",
            campaign: { connect: { id: campaign.id } },
            name: "Control",
            weight: 50,
            status: ExperimentVariantStatus.ACTIVE,
            textOverride: {
              headline: "Auto winner control",
            },
          },
          {
            id: "e2e-auto-winner-treatment",
            campaign: { connect: { id: campaign.id } },
            name: "Treatment",
            weight: 50,
            status: ExperimentVariantStatus.ACTIVE,
            textOverride: {
              headline: "Winning headline",
              subheadline: "Winning treatment copy.",
              ctaText: "Shop winner",
            },
            discountOverride: {
              discountCode: "WINNER20",
            },
          },
        ],
      },
    },
  });

  await prisma.attributionTouch.createMany({
    data: [
      ...buildExperimentTouches({
        shopId,
        campaignId: campaign.id,
        experimentId: "e2e-auto-winner-experiment",
        variantId: "e2e-auto-winner-control",
        impressions: 100,
        clicks: 10,
        visitorPrefix: "control",
        now,
      }),
      ...buildExperimentTouches({
        shopId,
        campaignId: campaign.id,
        experimentId: "e2e-auto-winner-experiment",
        variantId: "e2e-auto-winner-treatment",
        impressions: 100,
        clicks: 40,
        visitorPrefix: "treatment",
        now,
      }),
    ],
  });

  await prisma.attributionConversion.createMany({
    data: [
      {
        shopId,
        campaignId: campaign.id,
        experimentId: "e2e-auto-winner-experiment",
        variantId: "e2e-auto-winner-treatment",
        visitorId: "treatment-visitor-order",
        sessionId: "treatment-session-order",
        orderId: "e2e-auto-winner-order",
        revenueAmount: new Prisma.Decimal(120),
        currencyCode: "USD",
        attributionModel: AttributionModel.LAST_TOUCH_7D,
        occurredAt: now,
      },
    ],
  });

  return campaign;
}

function buildExperimentTouches({
  shopId,
  campaignId,
  experimentId,
  variantId,
  impressions,
  clicks,
  visitorPrefix,
  now,
}: {
  shopId: string;
  campaignId: string;
  experimentId: string;
  variantId: string;
  impressions: number;
  clicks: number;
  visitorPrefix: string;
  now: Date;
}) {
  const impressionTouches = Array.from({ length: impressions }, (_, index) => ({
    shopId,
    campaignId,
    experimentId,
    variantId,
    visitorId: `${visitorPrefix}-visitor-${index}`,
    sessionId: `${visitorPrefix}-session-${index}`,
    eventType: AnalyticsEventType.IMPRESSION,
    placementType: PlacementType.TOP_BAR,
    path: "/collections/sale",
    country: "US",
    locale: "en",
    occurredAt: new Date(now.getTime() - index * 1000),
  }));
  const clickTouches = Array.from({ length: clicks }, (_, index) => ({
    shopId,
    campaignId,
    experimentId,
    variantId,
    visitorId: `${visitorPrefix}-visitor-${index}`,
    sessionId: `${visitorPrefix}-session-${index}`,
    eventType: AnalyticsEventType.CLICK,
    placementType: PlacementType.TOP_BAR,
    path: "/collections/sale",
    country: "US",
    locale: "en",
    occurredAt: new Date(now.getTime() - (impressions + index) * 1000),
  }));

  return [...impressionTouches, ...clickTouches];
}

async function createReportsScenario(shopId: string) {
  const now = new Date();
  const usCampaign = await createCountdownCampaign(shopId, {
    discountCode: "US20",
    translations: [
      {
        ...englishTranslation("Reports US campaign"),
        subheadline: "US report seed.",
      },
    ],
  });
  const esCampaign = await createCountdownCampaign(shopId, {
    discountCode: "ES20",
    translations: [
      {
        locale: "en",
        headline: "Reports ES campaign",
        subheadline: "ES report seed.",
        ctaText: "Shop ES",
        ctaUrl: "/collections/es",
        expiredText: "This offer ended.",
      },
    ],
  });

  await Promise.all([
    prisma.campaign.update({
      where: { id: usCampaign.id },
      data: { name: "E2E Reports US Campaign" },
    }),
    prisma.campaign.update({
      where: { id: esCampaign.id },
      data: { name: "E2E Reports ES Campaign" },
    }),
    prisma.marketCampaignRule.createMany({
      data: [
        {
          shopId,
          campaignId: usCampaign.id,
          marketId: "US",
          countryCode: "US",
          locale: "en",
          currencyCode: "USD",
        },
        {
          shopId,
          campaignId: esCampaign.id,
          marketId: "ES",
          countryCode: "ES",
          locale: "es",
          currencyCode: "EUR",
        },
      ],
    }),
  ]);

  await prisma.analyticsEvent.createMany({
    data: [
      ...reportEvents({
        shopId,
        campaignId: usCampaign.id,
        country: "US",
        locale: "en",
        currencyCode: "USD",
        impressions: 30,
        clicks: 6,
        now,
      }),
      ...reportEvents({
        shopId,
        campaignId: esCampaign.id,
        country: "ES",
        locale: "es",
        currencyCode: "EUR",
        impressions: 20,
        clicks: 5,
        now,
      }),
    ],
  });

  await prisma.attributionTouch.createMany({
    data: [
      ...reportTouches({
        shopId,
        campaignId: usCampaign.id,
        country: "US",
        locale: "en",
        count: 8,
        now,
      }),
      ...reportTouches({
        shopId,
        campaignId: esCampaign.id,
        country: "ES",
        locale: "es",
        count: 8,
        now,
      }),
    ],
  });

  await prisma.attributionConversion.createMany({
    data: [
      {
        shopId,
        campaignId: usCampaign.id,
        visitorId: "reports-us-visitor-1",
        sessionId: "reports-us-session-1",
        orderId: "reports-us-order-1",
        revenueAmount: new Prisma.Decimal(150),
        currencyCode: "USD",
        attributionModel: AttributionModel.LAST_TOUCH_7D,
        occurredAt: now,
      },
      {
        shopId,
        campaignId: esCampaign.id,
        visitorId: "reports-es-visitor-1",
        sessionId: "reports-es-session-1",
        orderId: "reports-es-order-1",
        revenueAmount: new Prisma.Decimal(90),
        currencyCode: "EUR",
        attributionModel: AttributionModel.LAST_TOUCH_7D,
        occurredAt: now,
      },
    ],
  });

  await prisma.uniqueDiscountCode.createMany({
    data: [
      {
        shopId,
        campaignId: usCampaign.id,
        code: "REPORT-US-1",
        visitorId: "reports-us-visitor-1",
        status: UniqueDiscountCodeStatus.USED,
        assignedAt: new Date(now.getTime() - 60_000),
        usedAt: now,
        orderId: "reports-us-order-1",
      },
      {
        shopId,
        campaignId: esCampaign.id,
        code: "REPORT-ES-1",
        visitorId: "reports-es-visitor-1",
        status: UniqueDiscountCodeStatus.ASSIGNED,
        assignedAt: now,
      },
    ],
  });
}

function reportEvents({
  shopId,
  campaignId,
  country,
  locale,
  currencyCode,
  impressions,
  clicks,
  now,
}: {
  shopId: string;
  campaignId: string;
  country: string;
  locale: string;
  currencyCode: string;
  impressions: number;
  clicks: number;
  now: Date;
}) {
  const common = {
    shopId,
    campaignId,
    placementType: PlacementType.TOP_BAR,
    country,
    locale,
    currencyCode,
    path: "/collections/sale",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  };

  return [
    ...Array.from({ length: impressions }, (_, index) => ({
      ...common,
      eventType: AnalyticsEventType.IMPRESSION,
      sessionId: `${country.toLowerCase()}-impression-${index}`,
      occurredAt: new Date(now.getTime() - index * 1000),
    })),
    ...Array.from({ length: clicks }, (_, index) => ({
      ...common,
      eventType: AnalyticsEventType.CLICK,
      sessionId: `${country.toLowerCase()}-click-${index}`,
      occurredAt: new Date(now.getTime() - (impressions + index) * 1000),
    })),
  ];
}

function reportTouches({
  shopId,
  campaignId,
  country,
  locale,
  count,
  now,
}: {
  shopId: string;
  campaignId: string;
  country: string;
  locale: string;
  count: number;
  now: Date;
}) {
  return Array.from({ length: count }, (_, index) => ({
    shopId,
    campaignId,
    visitorId: `reports-${country.toLowerCase()}-visitor-${index}`,
    sessionId: `reports-${country.toLowerCase()}-session-${index}`,
    eventType: AnalyticsEventType.IMPRESSION,
    placementType: PlacementType.TOP_BAR,
    path: "/collections/sale",
    country,
    locale,
    occurredAt: new Date(now.getTime() - index * 1000),
  }));
}

async function createRecommendationsScenario(shopId: string) {
  const campaign = await createCountdownCampaign(shopId, {});
  const now = new Date();

  await prisma.analyticsEvent.createMany({
    data: [
      ...Array.from({ length: 140 }, (_, index) => ({
        shopId,
        campaignId: campaign.id,
        eventType: AnalyticsEventType.IMPRESSION,
        placementType: PlacementType.TOP_BAR,
        sessionId: `e2e-rec-session-${index}`,
        country: "US",
        locale: "en",
        path: "/collections/sale",
        occurredAt: new Date(now.getTime() - index * 1000),
      })),
      {
        shopId,
        campaignId: campaign.id,
        eventType: AnalyticsEventType.CLICK,
        placementType: PlacementType.TOP_BAR,
        sessionId: "e2e-rec-click-session",
        country: "US",
        locale: "en",
        path: "/collections/sale",
        occurredAt: now,
      },
    ],
  });
}

async function createAgencyScenario(shopId: string) {
  await prisma.shop.update({
    where: { id: shopId },
    data: { plan: ShopPlan.AGENCY },
  });

  const secondShop = await createE2EShopWithSettings(
    "agency-second.myshopify.com",
    ShopPlan.AGENCY,
    "e2e-agency-second-shop",
  );
  const unassignedShop = await createE2EShopWithSettings(
    "agency-hidden.myshopify.com",
    ShopPlan.AGENCY,
    "e2e-agency-hidden-shop",
  );

  const [sourceCampaign, secondCampaign, hiddenCampaign] = await Promise.all([
    createCountdownCampaign(shopId, {
      translations: [
        {
          ...englishTranslation("Agency source campaign"),
          ctaText: "Shop source",
        },
      ],
    }),
    createCountdownCampaign(secondShop.id, {
      translations: [
        {
          ...englishTranslation("Second shop campaign"),
          ctaText: "Shop second",
        },
      ],
    }),
    createCountdownCampaign(unassignedShop.id, {
      translations: [
        {
          ...englishTranslation("Hidden shop campaign"),
          ctaText: "Shop hidden",
        },
      ],
    }),
  ]);

  await Promise.all([
    prisma.campaign.update({
      where: { id: sourceCampaign.id },
      data: { name: "E2E Agency Source Campaign" },
    }),
    prisma.campaign.update({
      where: { id: secondCampaign.id },
      data: { name: "E2E Second Shop Campaign" },
    }),
    prisma.campaign.update({
      where: { id: hiddenCampaign.id },
      data: { name: "E2E Hidden Shop Campaign" },
    }),
  ]);

  await prisma.agencyAccount.create({
    data: {
      name: "E2E Promo Agency",
      shopAccesses: {
        create: [
          { shopId, role: AgencyShopRole.OWNER },
          { shopId: secondShop.id, role: AgencyShopRole.ADMIN },
        ],
      },
    },
  });

  await prisma.attributionConversion.createMany({
    data: [
      {
        shopId,
        campaignId: sourceCampaign.id,
        orderId: "e2e-agency-order-1",
        revenueAmount: new Prisma.Decimal(320),
        currencyCode: "USD",
        attributionModel: AttributionModel.LAST_TOUCH_24H,
      },
      {
        shopId: secondShop.id,
        campaignId: secondCampaign.id,
        orderId: "e2e-agency-order-2",
        revenueAmount: new Prisma.Decimal(540),
        currencyCode: "USD",
        attributionModel: AttributionModel.LAST_TOUCH_24H,
      },
      {
        shopId: unassignedShop.id,
        campaignId: hiddenCampaign.id,
        orderId: "e2e-hidden-order-1",
        revenueAmount: new Prisma.Decimal(999),
        currencyCode: "USD",
        attributionModel: AttributionModel.LAST_TOUCH_24H,
      },
    ],
  });

  await prisma.campaignRecommendation.create({
    data: {
      shopId: secondShop.id,
      campaignId: secondCampaign.id,
      type: CampaignRecommendationType.MESSAGE,
      title: "Improve second shop campaign copy",
      description: "E2E recommendation for the assigned agency shop.",
      impact: "Better CTA clarity for assigned multi-store traffic.",
      confidence: 0.8,
      status: CampaignRecommendationStatus.NEW,
      payload: {
        action: "CREATE_DRAFT_EXPERIMENT",
        fingerprint: "E2E_AGENCY_SECOND_SHOP",
        ruleKey: "LOW_CTR_COPY",
      },
    },
  });
}

async function createE2EShopWithSettings(
  shopifyDomain: string,
  plan: ShopPlan = ShopPlan.PRO,
  id?: string,
) {
  const shop = await prisma.shop.create({
    data: {
      ...(id ? { id } : {}),
      shopifyDomain,
      plan,
    },
  });

  await prisma.shopSettings.create({
    data: {
      shopId: shop.id,
      analyticsEnabled: true,
      consentMode: "BASIC",
      defaultCountry: "US",
      defaultCurrency: "USD",
      defaultLocale: "en",
      defaultTimezone: "America/New_York",
      enableDebugMode: true,
      enabledLocales: ["en", "es"],
      respectDoNotTrack: false,
    },
  });

  await prisma.shopOnboardingChecklist.create({
    data: {
      shopId: shop.id,
      appEmbedEnabled: true,
      cartBlockAdded: true,
      firstCampaignCreated: true,
      productBlockAdded: true,
    },
  });

  return shop;
}

async function createPostPurchaseCampaigns(shopId: string) {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  await prisma.campaign.create({
    data: {
      shopId,
      name: "E2E Thank You Offer",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.COUNTDOWN_BAR,
      goal: CampaignGoal.FLASH_SALE,
      startsAt: new Date(now.getTime() - 60 * 1000),
      endsAt,
      timezone: "America/New_York",
      placements: {
        create: [
          { placementType: PlacementType.THANK_YOU_PAGE, enabled: true },
        ],
      },
      design: {
        create: flashSaleDesign(),
      },
      timerSettings: {
        create: {
          mode: TimerMode.FIXED_DATE,
          durationMinutes: null,
          recurringDays: [],
          resetBehavior: TimerResetBehavior.NEVER,
          expiredBehavior: TimerExpiredBehavior.UNPUBLISH_TIMER,
        },
      },
      discountSync: {
        create: {
          discountCode: "SAVE20",
          method: DiscountSyncMethod.CODE,
          syncStartEnd: false,
        },
      },
      translations: {
        create: [
          {
            ...englishTranslation("Thank you offer"),
            subheadline: "Your checkout offer was detected.",
            ctaText: "Shop again",
            ctaUrl: "/collections/sale",
          },
        ],
      },
    },
  });

  await prisma.campaign.create({
    data: {
      shopId,
      name: "E2E Order Status Reorder",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.COUNTDOWN_BAR,
      goal: CampaignGoal.FLASH_SALE,
      startsAt: new Date(now.getTime() - 60 * 1000),
      endsAt,
      timezone: "America/New_York",
      placements: {
        create: [
          { placementType: PlacementType.ORDER_STATUS_PAGE, enabled: true },
        ],
      },
      design: {
        create: flashSaleDesign(),
      },
      timerSettings: {
        create: {
          mode: TimerMode.FIXED_DATE,
          durationMinutes: null,
          recurringDays: [],
          resetBehavior: TimerResetBehavior.NEVER,
          expiredBehavior: TimerExpiredBehavior.UNPUBLISH_TIMER,
        },
      },
      discountSync: {
        create: {
          discountCode: "REORDER10",
          method: DiscountSyncMethod.CODE,
          syncStartEnd: false,
        },
      },
      translations: {
        create: [
          {
            ...englishTranslation("Come back soon"),
            subheadline: "Use this code on a limited-time reorder.",
            ctaText: "Reorder now",
            ctaUrl: "/collections/bestsellers",
          },
        ],
      },
    },
  });
}

async function createProductTimerCampaign(shopId: string) {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 90 * 60 * 1000);

  return prisma.campaign.create({
    data: {
      shopId,
      name: "E2E Product Timer",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.PRODUCT_TIMER,
      goal: CampaignGoal.FLASH_SALE,
      startsAt: new Date(now.getTime() - 60 * 1000),
      endsAt,
      timezone: "America/New_York",
      placements: {
        create: [{ placementType: PlacementType.PRODUCT_PAGE, enabled: true }],
      },
      targeting: {
        create: {
          countries: [],
          markets: [],
          locales: [],
          productIds: ["gid://shopify/Product/e2e-hoodie"],
          collectionIds: [],
          productTags: ["hoodie"],
          customerTags: [],
          urlContains: [],
          excludedUrlContains: [],
          utmSources: [],
          devices: [],
          excludeProductIds: [],
          excludeCollectionIds: [],
          behaviorRules: Prisma.JsonNull,
        },
      },
      design: {
        create: {
          ...flashSaleDesign(),
          templateKey: "product-timer",
          layout: DesignLayout.BALANCED,
          icon: CampaignDesignIcon.CLOCK,
          gradientStartColor: "#0F766E",
          gradientEndColor: "#2563EB",
        },
      },
      timerSettings: {
        create: {
          mode: TimerMode.FIXED_DATE,
          durationMinutes: null,
          recurringDays: [],
          resetBehavior: TimerResetBehavior.NEVER,
          expiredBehavior: TimerExpiredBehavior.UNPUBLISH_TIMER,
        },
      },
      translations: {
        create: [
          {
            ...englishTranslation("Product timer offer"),
            subheadline: "Only for this hoodie.",
            ctaText: "Add before it ends",
          },
        ],
      },
    },
  });
}

async function createLowStockCampaign(shopId: string) {
  return prisma.campaign.create({
    data: {
      shopId,
      name: "E2E Low Stock Message",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.LOW_STOCK,
      goal: CampaignGoal.LOW_STOCK_URGENCY,
      timezone: "America/New_York",
      placements: {
        create: [{ placementType: PlacementType.PRODUCT_PAGE, enabled: true }],
      },
      targeting: {
        create: {
          countries: [],
          markets: [],
          locales: [],
          productIds: ["gid://shopify/Product/e2e-hoodie"],
          collectionIds: [],
          productTags: [],
          customerTags: [],
          urlContains: [],
          excludedUrlContains: [],
          utmSources: [],
          devices: [],
          excludeProductIds: [],
          excludeCollectionIds: [],
          behaviorRules: Prisma.JsonNull,
        },
      },
      design: {
        create: {
          ...flashSaleDesign(),
          templateKey: "low-stock",
          backgroundType: DesignBackgroundType.SOLID,
          backgroundColor: "#111827",
          textColor: "#FFFFFF",
          accentColor: "#F97316",
          icon: CampaignDesignIcon.TAG,
        },
      },
      lowStockSettings: {
        create: {
          threshold: 5,
          showExactQuantity: true,
          fallbackMessage: "Almost gone",
        },
      },
      translations: {
        create: [
          {
            ...englishTranslation("Low stock"),
            subheadline: "",
            ctaText: "",
            lowStockText: "Only {{quantity}} left in stock.",
          },
        ],
      },
    },
  });
}

async function createProductBadgeCampaign(shopId: string) {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  return prisma.campaign.create({
    data: {
      shopId,
      name: "E2E Product Badge",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.PRODUCT_BADGE,
      goal: CampaignGoal.PRODUCT_BADGE,
      startsAt: new Date(now.getTime() - 60 * 1000),
      endsAt,
      timezone: "America/New_York",
      placements: {
        create: [
          { placementType: PlacementType.COLLECTION_CARD, enabled: true },
          { placementType: PlacementType.PRODUCT_PAGE_BADGE, enabled: true },
        ],
      },
      design: {
        create: {
          ...flashSaleDesign(),
          templateKey: "product-badge",
          backgroundType: DesignBackgroundType.SOLID,
          backgroundColor: "#111827",
          textColor: "#FFFFFF",
          accentColor: "#A78BFA",
          borderRadius: 999,
          paddingBlock: 7,
          paddingInline: 11,
          fontSize: 13,
          timerStyle: DesignTimerStyle.BOXES,
          timerFontSize: 22,
          timerSurfaceColor: "#1F2937",
          timerSurfaceBorderColor: "#A78BFA",
          timerSurfaceBorderSize: 1,
          timerSurfaceRadius: 8,
          icon: CampaignDesignIcon.NONE,
        },
      },
      timerSettings: {
        create: {
          mode: TimerMode.FIXED_DATE,
          durationMinutes: null,
          recurringDays: [],
          resetBehavior: TimerResetBehavior.NEVER,
          expiredBehavior: TimerExpiredBehavior.UNPUBLISH_TIMER,
        },
      },
      badgeSettings: {
        create: {
          badgeText: "Launch badge",
          badgeShape: BadgeShape.PILL,
          badgePosition: BadgePosition.TOP_RIGHT,
        },
      },
      translations: {
        create: [
          {
            ...englishTranslation("Product badge"),
            badgeText: "Launch badge",
            ctaText: "",
          },
        ],
      },
    },
  });
}

async function createCustomSelectorCampaign(shopId: string) {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  return prisma.campaign.create({
    data: {
      id: "e2e-custom-selector-campaign",
      shopId,
      name: "E2E Custom Selector",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.COUNTDOWN_BAR,
      goal: CampaignGoal.ANNOUNCEMENT,
      startsAt: new Date(now.getTime() - 60 * 1000),
      endsAt,
      timezone: "America/New_York",
      placements: {
        create: [
          { placementType: PlacementType.CUSTOM_SELECTOR, enabled: true },
        ],
      },
      design: {
        create: {
          ...flashSaleDesign(),
          templateKey: "custom-selector",
          layout: DesignLayout.INLINE,
          icon: CampaignDesignIcon.GIFT,
        },
      },
      timerSettings: {
        create: {
          mode: TimerMode.FIXED_DATE,
          durationMinutes: null,
          recurringDays: [],
          resetBehavior: TimerResetBehavior.NEVER,
          expiredBehavior: TimerExpiredBehavior.UNPUBLISH_TIMER,
        },
      },
      translations: {
        create: [
          {
            ...englishTranslation("Custom slot announcement"),
            subheadline: "Rendered only into the configured HTML slot.",
            ctaText: "",
          },
        ],
      },
    },
  });
}

async function createTargetingMatrixCampaigns(shopId: string) {
  const matrix: Array<{
    id: string;
    headline: string;
    targeting: Prisma.CampaignTargetingCreateWithoutCampaignInput;
  }> = [
    {
      id: "e2e-target-product",
      headline: "Product targeting matched",
      targeting: targetingInput({
        productIds: ["gid://shopify/Product/e2e-hoodie"],
      }),
    },
    {
      id: "e2e-target-collection",
      headline: "Collection targeting matched",
      targeting: targetingInput({
        collectionIds: ["gid://shopify/Collection/e2e-sale"],
      }),
    },
    {
      id: "e2e-target-tag",
      headline: "Tag targeting matched",
      targeting: targetingInput({ productTags: ["vip-tag"] }),
    },
    {
      id: "e2e-target-country",
      headline: "Country targeting matched",
      targeting: targetingInput({ countries: ["AR"] }),
    },
    {
      id: "e2e-target-device",
      headline: "Device targeting matched",
      targeting: targetingInput({ devices: ["mobile"] }),
    },
    {
      id: "e2e-target-url",
      headline: "URL targeting matched",
      targeting: targetingInput({ urlContains: ["/collections/sale"] }),
    },
    {
      id: "e2e-target-exclude-url",
      headline: "Excluded URL targeting matched",
      targeting: targetingInput({ excludedUrlContains: ["/blocked"] }),
    },
    {
      id: "e2e-target-exclude-product",
      headline: "Excluded product targeting matched",
      targeting: targetingInput({
        excludeProductIds: ["gid://shopify/Product/e2e-blocked-product"],
      }),
    },
  ];

  for (const item of matrix) {
    await createTargetedCountdownCampaign(shopId, item);
  }
}

async function createTargetedCountdownCampaign(
  shopId: string,
  item: {
    id: string;
    headline: string;
    targeting: Prisma.CampaignTargetingCreateWithoutCampaignInput;
  },
) {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  return prisma.campaign.create({
    data: {
      id: item.id,
      shopId,
      name: item.headline,
      status: CampaignStatus.ACTIVE,
      type: CampaignType.COUNTDOWN_BAR,
      goal: CampaignGoal.FLASH_SALE,
      startsAt: new Date(now.getTime() - 60 * 1000),
      endsAt,
      timezone: "America/New_York",
      placements: {
        create: [{ placementType: PlacementType.TOP_BAR, enabled: true }],
      },
      targeting: {
        create: item.targeting,
      },
      design: {
        create: flashSaleDesign(),
      },
      timerSettings: {
        create: {
          mode: TimerMode.FIXED_DATE,
          durationMinutes: null,
          recurringDays: [],
          resetBehavior: TimerResetBehavior.NEVER,
          expiredBehavior: TimerExpiredBehavior.UNPUBLISH_TIMER,
        },
      },
      translations: {
        create: [
          {
            ...englishTranslation(item.headline),
            ctaText: "",
          },
        ],
      },
    },
  });
}

function targetingInput(
  overrides: Partial<Prisma.CampaignTargetingCreateWithoutCampaignInput>,
): Prisma.CampaignTargetingCreateWithoutCampaignInput {
  return {
    countries: [],
    markets: [],
    locales: [],
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
    behaviorRules: Prisma.JsonNull,
    ...overrides,
  };
}

async function createFreeShippingCampaign(
  shopId: string,
  placements: PlacementType[],
  options: {
    thresholdAmount?: number;
    progressStyle?: "BAR" | "COMPACT" | "CIRCULAR";
  } = {},
) {
  const thresholdAmount = options.thresholdAmount ?? 100;

  return prisma.campaign.create({
    data: {
      shopId,
      name: "E2E Free Shipping Goal",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.FREE_SHIPPING_GOAL,
      goal: CampaignGoal.FREE_SHIPPING,
      timezone: "America/New_York",
      placements: {
        create: placements.map((placementType) => ({
          placementType,
          enabled: true,
        })),
      },
      design: {
        create: {
          ...flashSaleDesign(),
          templateKey: "free-shipping",
          backgroundColor: "#ECFDF5",
          textColor: "#064E3B",
          accentColor: "#10B981",
          buttonColor: "#047857",
          buttonTextColor: "#FFFFFF",
          icon: CampaignDesignIcon.TRUCK,
        },
      },
      freeShippingSettings: {
        create: {
          thresholdAmount: new Prisma.Decimal(thresholdAmount),
          currencyCode: "USD",
          includeDiscountedSubtotal: true,
          emptyCartMessage: "Add items to unlock free shipping",
          progressStyle: options.progressStyle ?? "BAR",
          successMessage: "You've unlocked free shipping!",
        },
      },
      translations: {
        create: [
          {
            ...englishTranslation("Free shipping"),
            freeShippingProgressText:
              "You're {{amount}} away from free shipping",
            freeShippingSuccessText: "You've unlocked free shipping!",
          },
        ],
      },
    },
  });
}

async function createDeliveryCutoffCampaign(
  shopId: string,
  options: { afterCutoffBehavior?: DeliveryAfterCutoffBehavior } = {},
) {
  return prisma.campaign.create({
    data: {
      shopId,
      name: "E2E Delivery Cutoff",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.DELIVERY_CUTOFF,
      goal: CampaignGoal.DELIVERY_CUTOFF,
      timezone: "America/New_York",
      placements: {
        create: [{ placementType: PlacementType.PRODUCT_PAGE, enabled: true }],
      },
      design: {
        create: {
          ...flashSaleDesign(),
          templateKey: "delivery-cutoff",
          backgroundColor: "#EFF6FF",
          textColor: "#1E3A8A",
          accentColor: "#2563EB",
          icon: CampaignDesignIcon.CLOCK,
        },
      },
      deliveryCutoffSettings: {
        create: {
          cutoffHour: 23,
          cutoffMinute: 59,
          processingDays: 1,
          minDeliveryDays: 2,
          maxDeliveryDays: 4,
          workingDays: [1, 2, 3, 4, 5],
          holidays: [],
          countryRules: {},
          afterCutoffBehavior:
            options.afterCutoffBehavior ?? "SHOW_NEXT_WINDOW",
        },
      },
      translations: {
        create: [
          {
            ...englishTranslation("Fast delivery"),
            deliveryBeforeCutoffText:
              "Order within {{timeRemaining}} to get it by {{minDeliveryDate}}",
            deliveryAfterCutoffText: "Orders placed now ship {{shipsDate}}",
          },
        ],
      },
    },
  });
}

async function createCartTimerCampaign(
  shopId: string,
  placements: PlacementType[] = [PlacementType.CART_DRAWER],
) {
  return prisma.campaign.create({
    data: {
      shopId,
      name: "E2E Cart Reserve Timer",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.CART_TIMER,
      goal: CampaignGoal.CART_RESCUE,
      timezone: "America/New_York",
      placements: {
        create: placements.map((placementType) => ({
          placementType,
          enabled: true,
        })),
      },
      design: {
        create: flashSaleDesign(),
      },
      timerSettings: {
        create: {
          mode: TimerMode.EVERGREEN_SESSION,
          durationMinutes: 10,
          recurringDays: [],
          resetBehavior: TimerResetBehavior.ON_SESSION_END,
          expiredBehavior: TimerExpiredBehavior.HIDE_TIMER,
        },
      },
      translations: {
        create: [
          {
            ...englishTranslation("Your cart is reserved"),
            subheadline: "Complete checkout before the timer ends.",
            ctaText: "Checkout",
            ctaUrl: "/checkout",
          },
        ],
      },
    },
  });
}

function flashSaleDesign() {
  return {
    templateKey: "flash-sale",
    layout: DesignLayout.STANDARD,
    backgroundType: DesignBackgroundType.GRADIENT,
    backgroundColor: "#7F1D1D",
    backgroundImageUrl: "",
    gradientStartColor: "#7F1D1D",
    gradientEndColor: "#DC2626",
    gradientAngle: 135,
    textColor: "#FFFFFF",
    accentColor: "#FDE047",
    buttonColor: "#FFFFFF",
    buttonTextColor: "#7F1D1D",
    closeButtonColor: "#FFFFFF",
    fontSize: 15,
    borderRadius: 6,
    borderSize: 0,
    borderColor: "#E5E7EB",
    fontFamily: DesignFontFamily.THEME,
    titleFontSize: 22,
    titleColor: "#FFFFFF",
    subheadingFontSize: 14,
    subheadingColor: "#FEE2E2",
    timerFontSize: 38,
    timerColor: "#FDE047",
    legendFontSize: 12,
    legendColor: "#FECACA",
    timerStyle: DesignTimerStyle.PLAIN,
    timerFormat: DesignTimerFormat.UNITS,
    timerShowLabels: true,
    timerShowSeconds: true,
    timerDaysLabel: "Days",
    timerHoursLabel: "Hrs",
    timerMinutesLabel: "Mins",
    timerSecondsLabel: "Secs",
    timerHideZeroDays: true,
    timerSurfaceColor: "#FFFFFF",
    timerSurfaceBorderColor: "#D1D5DB",
    timerSurfaceBorderSize: 0,
    timerSurfaceRadius: 8,
    paddingBlock: 20,
    paddingInline: 24,
    contentGap: 8,
    contentMaxWidth: 960,
    fullWidth: false,
    positionMode: DesignPositionMode.FLOW,
    positionSticky: true,
    mobileEnabled: true,
    alignment: DesignAlignment.CENTER,
    showCloseButton: true,
    showButton: true,
    showProgressBar: true,
    showIcon: true,
    icon: CampaignDesignIcon.FIRE,
    customIconUrl: "",
  };
}

function englishTranslation(headline: string) {
  return {
    locale: "en",
    headline,
    subheadline: "Save before midnight.",
    ctaText: "Shop sale",
    ctaUrl: "/collections/sale",
    expiredText: "This offer has ended.",
  };
}
