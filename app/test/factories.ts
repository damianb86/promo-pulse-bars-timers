import {
  BadgePosition,
  BadgeShape,
  CampaignDesignIcon,
  CampaignGoal,
  CampaignStatus,
  CampaignType,
  DeliveryAfterCutoffBehavior,
  DesignAlignment,
  DiscountSyncMethod,
  FreeShippingProgressStyle,
  PlacementType,
  Prisma,
  ShopPlan,
  TimerMode,
  TimerResetBehavior,
  type Shop,
} from "@prisma/client";

import type {
  StorefrontCampaignContext,
  StorefrontCampaignSource,
} from "../utils/storefront-campaigns";

const testDate = new Date("2026-06-16T12:00:00.000Z");

type PlacementInput = {
  placementType: PlacementType;
  enabled?: boolean;
  customSelector?: string | null;
};

type TestCampaignOverrides = {
  id?: string;
  shopId?: string;
  name?: string;
  status?: CampaignStatus;
  type?: CampaignType;
  goal?: CampaignGoal;
  startsAt?: Date | null;
  endsAt?: Date | null;
  timezone?: string;
  priority?: number;
  placements?: PlacementInput[];
  targeting?: Partial<
    NonNullable<StorefrontCampaignSource["targeting"]>
  > | null;
  design?: Partial<NonNullable<StorefrontCampaignSource["design"]>> | null;
  timerSettings?: Partial<
    NonNullable<StorefrontCampaignSource["timerSettings"]>
  > | null;
  freeShippingSettings?: Partial<
    NonNullable<StorefrontCampaignSource["freeShippingSettings"]>
  > | null;
  deliveryCutoffSettings?: Partial<
    NonNullable<StorefrontCampaignSource["deliveryCutoffSettings"]>
  > | null;
  lowStockSettings?: Partial<
    NonNullable<StorefrontCampaignSource["lowStockSettings"]>
  > | null;
  badgeSettings?: Partial<
    NonNullable<StorefrontCampaignSource["badgeSettings"]>
  > | null;
  discountSync?: Partial<
    NonNullable<StorefrontCampaignSource["discountSync"]>
  > | null;
  translations?: Array<
    Partial<StorefrontCampaignSource["translations"][number]> & {
      locale: string;
    }
  >;
};

export function createTestShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: "shop-1",
    shopifyDomain: "example.myshopify.com",
    plan: ShopPlan.GROWTH,
    createdAt: testDate,
    updatedAt: testDate,
    ...overrides,
  };
}

export function createTestContext(
  overrides: Partial<StorefrontCampaignContext> = {},
): StorefrontCampaignContext {
  return {
    shop: "example.myshopify.com",
    path: "/collections/sale/products/hoodie",
    locale: "en",
    country: "US",
    market: "US",
    productId: "gid://shopify/Product/1",
    collectionIds: ["gid://shopify/Collection/1"],
    productTags: ["sale"],
    customerTags: [],
    device: "desktop",
    utmSource: "",
    cartSubtotal: null,
    currency: "USD",
    placement: PlacementType.TOP_BAR,
    campaignId: "",
    ...overrides,
  };
}

export function createTestCampaign(
  overrides: TestCampaignOverrides = {},
): StorefrontCampaignSource {
  const id = overrides.id ?? "campaign-1";
  const shopId = overrides.shopId ?? "shop-1";
  const type = overrides.type ?? CampaignType.COUNTDOWN_BAR;
  const goal = overrides.goal ?? CampaignGoal.FLASH_SALE;
  const placements = overrides.placements ?? [
    { placementType: PlacementType.TOP_BAR, enabled: true },
  ];

  return {
    id,
    shopId,
    name: overrides.name ?? "Flash Sale Countdown Bar",
    status: overrides.status ?? CampaignStatus.ACTIVE,
    type,
    goal,
    startsAt:
      "startsAt" in overrides
        ? overrides.startsAt!
        : new Date("2026-06-16T10:00:00.000Z"),
    endsAt:
      "endsAt" in overrides
        ? overrides.endsAt!
        : new Date("2026-06-20T23:59:00.000Z"),
    timezone: overrides.timezone ?? "America/New_York",
    priority: overrides.priority ?? 0,
    createdAt: testDate,
    updatedAt: testDate,
    placements: placements.map((placement, index) => ({
      id: `${id}-placement-${index + 1}`,
      campaignId: id,
      placementType: placement.placementType,
      customSelector: placement.customSelector ?? null,
      enabled: placement.enabled ?? true,
    })),
    targeting:
      overrides.targeting === undefined
        ? null
        : createTargeting(id, overrides.targeting),
    design:
      overrides.design === undefined
        ? null
        : overrides.design === null
          ? null
          : createDesign(id, overrides.design),
    timerSettings:
      overrides.timerSettings === null
        ? null
        : createTimerSettings(id, overrides.timerSettings),
    freeShippingSettings:
      overrides.freeShippingSettings === undefined
        ? null
        : overrides.freeShippingSettings === null
          ? null
          : createFreeShippingSettings(id, overrides.freeShippingSettings),
    deliveryCutoffSettings:
      overrides.deliveryCutoffSettings === undefined
        ? null
        : overrides.deliveryCutoffSettings === null
          ? null
          : createDeliveryCutoffSettings(id, overrides.deliveryCutoffSettings),
    lowStockSettings:
      overrides.lowStockSettings === undefined
        ? null
        : overrides.lowStockSettings === null
          ? null
          : createLowStockSettings(id, overrides.lowStockSettings),
    badgeSettings:
      overrides.badgeSettings === undefined
        ? null
        : overrides.badgeSettings === null
          ? null
          : createBadgeSettings(id, overrides.badgeSettings),
    discountSync:
      overrides.discountSync === undefined
        ? null
        : overrides.discountSync === null
          ? null
          : createDiscountSync(id, overrides.discountSync),
    translations: (
      overrides.translations ?? [
        {
          locale: "en",
          headline: "Sale ends soon",
          subheadline: "Save before midnight.",
          ctaText: "Shop sale",
          ctaUrl: "/collections/sale",
          expiredText: "This offer has ended.",
        },
      ]
    ).map((translation, index) => ({
      id: `${id}-translation-${index + 1}`,
      campaignId: id,
      headline: translation.headline ?? null,
      subheadline: translation.subheadline ?? null,
      ctaText: translation.ctaText ?? null,
      ctaUrl: translation.ctaUrl ?? null,
      expiredText: translation.expiredText ?? null,
      freeShippingEmptyText: translation.freeShippingEmptyText ?? null,
      freeShippingProgressText: translation.freeShippingProgressText ?? null,
      freeShippingSuccessText: translation.freeShippingSuccessText ?? null,
      deliveryBeforeCutoffText: translation.deliveryBeforeCutoffText ?? null,
      deliveryAfterCutoffText: translation.deliveryAfterCutoffText ?? null,
      lowStockText: translation.lowStockText ?? null,
      badgeText: translation.badgeText ?? null,
      locale: translation.locale,
    })),
  };
}

function createTargeting(
  campaignId: string,
  overrides: TestCampaignOverrides["targeting"],
): NonNullable<StorefrontCampaignSource["targeting"]> {
  return {
    campaignId,
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
    ...overrides,
  };
}

function createDesign(
  campaignId: string,
  overrides: NonNullable<TestCampaignOverrides["design"]>,
): NonNullable<StorefrontCampaignSource["design"]> {
  return {
    campaignId,
    templateKey: "clean-minimal",
    backgroundColor: "#FFFFFF",
    textColor: "#111827",
    accentColor: "#2563EB",
    buttonColor: "#111827",
    buttonTextColor: "#FFFFFF",
    fontSize: 14,
    borderRadius: 4,
    positionSticky: false,
    customCss: null,
    mobileEnabled: true,
    alignment: DesignAlignment.CENTER,
    showCloseButton: true,
    showIcon: false,
    icon: CampaignDesignIcon.NONE,
    ...overrides,
  };
}

function createTimerSettings(
  campaignId: string,
  overrides:
    | Partial<NonNullable<StorefrontCampaignSource["timerSettings"]>>
    | undefined,
): NonNullable<StorefrontCampaignSource["timerSettings"]> {
  return {
    campaignId,
    mode: TimerMode.FIXED_DATE,
    durationMinutes: null,
    recurringDays: [],
    resetBehavior: TimerResetBehavior.NEVER,
    ...overrides,
  };
}

function createFreeShippingSettings(
  campaignId: string,
  overrides: NonNullable<TestCampaignOverrides["freeShippingSettings"]>,
): NonNullable<StorefrontCampaignSource["freeShippingSettings"]> {
  return {
    campaignId,
    thresholdAmount: new Prisma.Decimal("75.00"),
    currencyCode: "USD",
    includeDiscountedSubtotal: true,
    emptyCartMessage: "Your cart is empty. Add items to unlock free shipping.",
    successMessage: "You've unlocked free shipping!",
    progressStyle: FreeShippingProgressStyle.BAR,
    thresholdRules: null,
    ...overrides,
  };
}

function createDeliveryCutoffSettings(
  campaignId: string,
  overrides: NonNullable<TestCampaignOverrides["deliveryCutoffSettings"]>,
): NonNullable<StorefrontCampaignSource["deliveryCutoffSettings"]> {
  return {
    campaignId,
    cutoffHour: 14,
    cutoffMinute: 0,
    processingDays: 0,
    minDeliveryDays: 2,
    maxDeliveryDays: 5,
    workingDays: [1, 2, 3, 4, 5],
    holidays: [],
    countryRules: {},
    afterCutoffBehavior: DeliveryAfterCutoffBehavior.SHOW_NEXT_WINDOW,
    ...overrides,
  };
}

function createLowStockSettings(
  campaignId: string,
  overrides: NonNullable<TestCampaignOverrides["lowStockSettings"]>,
): NonNullable<StorefrontCampaignSource["lowStockSettings"]> {
  return {
    campaignId,
    threshold: 5,
    showExactQuantity: false,
    fallbackMessage: "Low stock",
    ...overrides,
  };
}

function createBadgeSettings(
  campaignId: string,
  overrides: NonNullable<TestCampaignOverrides["badgeSettings"]>,
): NonNullable<StorefrontCampaignSource["badgeSettings"]> {
  return {
    campaignId,
    badgeText: "Limited offer",
    badgeShape: BadgeShape.PILL,
    badgePosition: BadgePosition.TOP_RIGHT,
    ...overrides,
  };
}

function createDiscountSync(
  campaignId: string,
  overrides: NonNullable<TestCampaignOverrides["discountSync"]>,
): NonNullable<StorefrontCampaignSource["discountSync"]> {
  return {
    campaignId,
    shopifyDiscountId: null,
    discountCode: "SAVE20",
    method: DiscountSyncMethod.CODE,
    syncStartEnd: true,
    lastSyncedAt: null,
    ...overrides,
  };
}
