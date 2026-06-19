import {
  AgencyShopRole,
  AnalyticsEventType,
  AttributionModel,
  CampaignDesignIcon,
  CampaignGoal,
  CampaignRecommendationStatus,
  CampaignRecommendationType,
  CampaignStatus,
  CampaignType,
  DeliveryAfterCutoffBehavior,
  DesignAlignment,
  DiscountCodePoolStatus,
  DiscountCodeValueType,
  DiscountSyncMethod,
  ExperimentPrimaryMetric,
  ExperimentStatus,
  ExperimentVariantStatus,
  PlacementType,
  Prisma,
  ShopPlan,
  TimerMode,
  TimerResetBehavior,
  UniqueDiscountCodeStatus,
} from "@prisma/client";

import prisma from "../db.server";

export const E2E_DEMO_SHOP_DOMAIN = "demo-shop.myshopify.com";
export const E2E_AUTH_COOKIE = "counterpulse_e2e_shop";

export type E2ETestScenario =
  | "empty"
  | "countdown"
  | "targeting"
  | "behavior-targeting"
  | "free-shipping"
  | "delivery-cutoff"
  | "delivery-cutoff-after"
  | "cart-drawer"
  | "analytics"
  | "ab-test"
  | "unique-discount"
  | "unique-discount-expired"
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

  const shop = await prisma.shop.upsert({
    where: { shopifyDomain: E2E_DEMO_SHOP_DOMAIN },
    update: { plan: ShopPlan.PRO },
    create: {
      shopifyDomain: E2E_DEMO_SHOP_DOMAIN,
      plan: ShopPlan.PRO,
    },
  });

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

async function seedScenario(shopId: string, scenario: E2ETestScenario) {
  if (scenario === "countdown") {
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
    await createCountdownCampaign(shopId, {
      discountCode: "SAVE20",
    });
    return;
  }

  if (scenario === "ab-test") {
    await createAbTestCampaign(shopId);
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
        create: [{ placementType: PlacementType.TOP_BAR, enabled: true }],
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
  const secondShop = await createE2EShopWithSettings(
    "agency-second.myshopify.com",
  );
  const unassignedShop = await createE2EShopWithSettings(
    "agency-hidden.myshopify.com",
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

async function createE2EShopWithSettings(shopifyDomain: string) {
  const shop = await prisma.shop.create({
    data: {
      shopifyDomain,
      plan: ShopPlan.PRO,
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

async function createFreeShippingCampaign(
  shopId: string,
  placements: PlacementType[],
) {
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
          thresholdAmount: new Prisma.Decimal(100),
          currencyCode: "USD",
          includeDiscountedSubtotal: true,
          emptyCartMessage: "Add items to unlock free shipping",
          progressStyle: "BAR",
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

async function createCartTimerCampaign(shopId: string) {
  return prisma.campaign.create({
    data: {
      shopId,
      name: "E2E Cart Reserve Timer",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.CART_TIMER,
      goal: CampaignGoal.CART_RESCUE,
      timezone: "America/New_York",
      placements: {
        create: [{ placementType: PlacementType.CART_DRAWER, enabled: true }],
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
    backgroundColor: "#7F1D1D",
    textColor: "#FFFFFF",
    accentColor: "#FDE047",
    buttonColor: "#FFFFFF",
    buttonTextColor: "#7F1D1D",
    fontSize: 15,
    borderRadius: 6,
    positionSticky: true,
    mobileEnabled: true,
    alignment: DesignAlignment.CENTER,
    showCloseButton: true,
    showIcon: true,
    icon: CampaignDesignIcon.FIRE,
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
