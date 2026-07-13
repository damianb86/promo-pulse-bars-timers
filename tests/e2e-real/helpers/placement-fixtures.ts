import {
  BadgePosition,
  BadgeShape,
  CampaignDesignIcon,
  CampaignGoal,
  CampaignStatus,
  CampaignType,
  DesignAlignment,
  DesignBackgroundType,
  DesignBannerAnimation,
  DesignFontFamily,
  DesignLayout,
  DesignPositionMode,
  DesignTimerFormat,
  DesignTimerStyle,
  DesignTimerTickAnimation,
  DiscountCodePoolStatus,
  DiscountCodeValueType,
  DiscountSyncMethod,
  ExperimentPrimaryMetric,
  ExperimentStatus,
  ExperimentVariantStatus,
  FreeShippingProgressStyle,
  PlacementType,
  Prisma,
  TimerExpiredBehavior,
  TimerMode,
  TimerResetBehavior,
  UniqueDiscountCodeStatus,
  type Campaign,
} from "@prisma/client";

import prisma from "../../../app/db.server";
import { publishCampaignForShop } from "../../../app/models/campaign.server";
import { DISCOUNT_CODE_PREFIX, E2E_PREFIX, getConfig, uniqueName } from "./env";

export type PlacementFixtureDesign = {
  backgroundColor: string;
  layoutClass: string;
  textColor: string;
  timerClass: string;
};

export type PublishedPlacementCampaign = {
  design: PlacementFixtureDesign;
  headline: string;
  id: string;
  name: string;
  placement: PlacementType;
};

type PlacementCampaignOptions = {
  badgePosition?: BadgePosition;
  badgeText?: string;
  ctaText?: string;
  ctaUrl?: string;
  customSelector?: string;
  customStyle?: string;
  design?: Partial<PlacementFixtureDesign> & {
    borderRadius?: number;
    fullWidth?: boolean;
    layout?: DesignLayout;
  };
  /**
   * Raw CampaignDesign column overrides merged on top of the fixture defaults.
   * Lets a spec exercise the full design surface (gradients, alignment, timer
   * format, close button, custom CSS, sticky/overlay position, ...) that the
   * curated `design` option does not expose. Keys must match Prisma
   * CampaignDesign create fields.
   */
  designExtras?: Record<string, unknown>;
  deliveryCutoff?: Partial<{
    afterCutoffBehavior:
      | "HIDE"
      | "SHOW_AFTER_CUTOFF_MESSAGE"
      | "SHOW_NEXT_WINDOW";
    countryRules: Prisma.InputJsonValue;
    cutoffHour: number;
    cutoffMinute: number;
    maxDeliveryDays: number;
    minDeliveryDays: number;
    processingDays: number;
  }>;
  discountCode?: string;
  /**
   * Whether the linked discount code is exposed on the storefront. Defaults to
   * true. Set false to verify the code is gated out of the payload and DOM while
   * the campaign itself still renders.
   */
  discountShowCode?: boolean;
  experiment?: {
    name?: string;
    primaryMetric?: ExperimentPrimaryMetric;
    status?: ExperimentStatus;
    variants: Array<{
      designOverride?: Prisma.InputJsonValue;
      discountOverride?: Prisma.InputJsonValue;
      name: string;
      placementOverride?: Prisma.InputJsonValue;
      status?: ExperimentVariantStatus;
      textOverride?: Prisma.InputJsonValue;
      weight: number;
    }>;
  };
  freeShipping?: Partial<{
    currencyCode: string;
    emptyCartMessage: string;
    successMessage: string;
    thresholdAmount: number;
    thresholdRules: Prisma.InputJsonValue;
  }>;
  goal?: CampaignGoal;
  headline: string;
  lowStock?: Partial<{
    fallbackMessage: string;
    showExactQuantity: boolean;
    threshold: number;
  }>;
  marketRules?: Array<{
    countryCode?: string | null;
    currencyCode?: string | null;
    deliverySettings?: Prisma.InputJsonValue | null;
    enabled?: boolean;
    locale?: string | null;
    marketId?: string | null;
    textOverrides?: Prisma.InputJsonValue | null;
    thresholdAmount?: number | null;
  }>;
  name?: string;
  placement: PlacementType;
  startsAt?: Date;
  subheadline?: string;
  targeting?: Partial<{
    behaviorRules: Prisma.InputJsonValue | null;
    collectionIds: string[];
    countries: string[];
    customerTags: string[];
    devices: string[];
    excludeCollectionIds: string[];
    excludeProductIds: string[];
    excludedUrlContains: string[];
    locales: string[];
    markets: string[];
    productIds: string[];
    productTags: string[];
    urlContains: string[];
    utmSources: string[];
  }>;
  translations?: Array<{
    badgeText?: string;
    ctaText?: string;
    ctaUrl?: string;
    expiredText?: string;
    headline?: string;
    locale: string;
    subheadline?: string;
  }>;
  type?: CampaignType;
  uniqueCodeCount?: number;
  uniqueCodePrefix?: string;
  endsAt?: Date;
};

export async function findRealE2EShopId() {
  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: getConfig().shopDomain },
    select: { id: true },
  });

  return shop?.id ?? "";
}

export async function createPublishedPlacementCampaign(
  shopId: string,
  options: PlacementCampaignOptions,
): Promise<PublishedPlacementCampaign> {
  const now = new Date();
  const startsAt = options.startsAt ?? new Date(now.getTime() - 60 * 1000);
  const endsAt = options.endsAt ?? new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const placement = options.placement;
  const type = options.type ?? typeForPlacement(placement);
  const goal = options.goal ?? goalForType(type);
  const design = buildFixtureDesign(placement, options.design);
  const uniqueCodePrefix =
    options.uniqueCodePrefix ?? uniquePrefixForCampaign();
  const campaign = await prisma.campaign.create({
    data: {
      shopId,
      name: options.name ?? uniqueName(`Placement ${placement}`),
      status: CampaignStatus.DRAFT,
      type,
      goal,
      startsAt,
      endsAt,
      timezone: "UTC",
      priority: await nextCampaignPriority(shopId),
      placements: {
        create: [
          {
            placementType: placement,
            customSelector:
              placement === PlacementType.CUSTOM_SELECTOR
                ? options.customSelector
                : null,
            customStyle:
              placement === PlacementType.CUSTOM_SELECTOR
                ? options.customStyle
                : null,
            enabled: true,
          },
        ],
      },
      ...(options.targeting
        ? {
            targeting: {
              create: targetingData(options.targeting),
            },
          }
        : {}),
      design: {
        create: {
          ...designDataForFixture(design, options.design),
          ...(options.designExtras ?? {}),
        },
      },
      timerSettings: {
        create: {
          mode:
            type === CampaignType.CART_TIMER
              ? TimerMode.EVERGREEN_SESSION
              : TimerMode.FIXED_DATE,
          durationMinutes: type === CampaignType.CART_TIMER ? 45 : null,
          recurringDays: [],
          resetBehavior:
            type === CampaignType.CART_TIMER
              ? TimerResetBehavior.ON_SESSION_END
              : TimerResetBehavior.NEVER,
          expiredBehavior:
            type === CampaignType.PRODUCT_BADGE
              ? TimerExpiredBehavior.DO_NOTHING
              : TimerExpiredBehavior.UNPUBLISH_TIMER,
        },
      },
      ...(type === CampaignType.FREE_SHIPPING_GOAL
        ? {
            freeShippingSettings: {
              create: {
                thresholdAmount: new Prisma.Decimal(
                  options.freeShipping?.thresholdAmount ?? 75,
                ),
                currencyCode: options.freeShipping?.currencyCode ?? "USD",
                includeDiscountedSubtotal: true,
                emptyCartMessage:
                  options.freeShipping?.emptyCartMessage ??
                  "Add items to unlock free shipping.",
                successMessage:
                  options.freeShipping?.successMessage ??
                  "Free shipping unlocked.",
                progressStyle: FreeShippingProgressStyle.BAR,
                thresholdRules:
                  options.freeShipping?.thresholdRules ?? Prisma.JsonNull,
              },
            },
          }
        : {}),
      ...(type === CampaignType.DELIVERY_CUTOFF
        ? {
            deliveryCutoffSettings: {
              create: {
                cutoffHour: options.deliveryCutoff?.cutoffHour ?? 15,
                cutoffMinute: options.deliveryCutoff?.cutoffMinute ?? 0,
                processingDays: options.deliveryCutoff?.processingDays ?? 1,
                minDeliveryDays: options.deliveryCutoff?.minDeliveryDays ?? 2,
                maxDeliveryDays: options.deliveryCutoff?.maxDeliveryDays ?? 5,
                workingDays: [1, 2, 3, 4, 5],
                holidays: [],
                countryRules:
                  options.deliveryCutoff?.countryRules ?? Prisma.JsonNull,
                afterCutoffBehavior:
                  options.deliveryCutoff?.afterCutoffBehavior ??
                  "SHOW_NEXT_WINDOW",
              },
            },
          }
        : {}),
      ...(type === CampaignType.LOW_STOCK
        ? {
            lowStockSettings: {
              create: {
                threshold: options.lowStock?.threshold ?? 5,
                showExactQuantity: options.lowStock?.showExactQuantity ?? true,
                fallbackMessage:
                  options.lowStock?.fallbackMessage ??
                  "Only a few left in stock.",
              },
            },
          }
        : {}),
      ...(type === CampaignType.CART_TIMER
        ? {
            cartRescueSettings: {
              create: {
                rescueReason: "CART_RESERVED",
                showTimer: true,
                showButton: true,
              },
            },
          }
        : {}),
      ...(type === CampaignType.PRODUCT_BADGE
        ? {
            badgeSettings: {
              create: {
                badgeText: options.badgeText ?? options.headline,
                badgeShape: BadgeShape.PILL,
                badgePosition: options.badgePosition ?? BadgePosition.TOP_RIGHT,
              },
            },
          }
        : {}),
      ...(options.discountCode
        ? {
            discountSync: {
              create: {
                method: DiscountSyncMethod.CODE,
                discountCode: options.discountCode,
                showCodeOnStorefront: options.discountShowCode ?? true,
                syncStartEnd: false,
                title: `${options.headline} discount`,
                valueType: DiscountCodeValueType.PERCENTAGE,
                value: new Prisma.Decimal(10),
              },
            },
          }
        : options.uniqueCodeCount
          ? {
              discountSync: {
                create: {
                  method: DiscountSyncMethod.UNIQUE_CODE,
                  showCodeOnStorefront: true,
                  syncStartEnd: false,
                  title: `${options.headline} unique discount`,
                  valueType: DiscountCodeValueType.PERCENTAGE,
                  value: new Prisma.Decimal(15),
                  appliesOncePerCustomer: true,
                  uniqueCodePrefix,
                  uniqueCodeExpiresMinutes: 60,
                  uniqueCodeAutoApply: true,
                  uniqueCodeReassignExpired: false,
                  uniqueCodeStartsAt: new Date(now.getTime() - 60 * 1000),
                  uniqueCodeEndsAt: endsAt,
                },
              },
            }
          : {}),
      translations: {
        create: translationData(options, placement),
      },
      ...(options.marketRules?.length
        ? {
            marketCampaignRules: {
              create: options.marketRules.map((rule) => ({
                shopId,
                enabled: rule.enabled ?? true,
                marketId: rule.marketId ?? null,
                countryCode: rule.countryCode ?? null,
                locale: rule.locale ?? null,
                currencyCode: rule.currencyCode ?? null,
                thresholdAmount:
                  rule.thresholdAmount == null
                    ? null
                    : new Prisma.Decimal(rule.thresholdAmount),
                deliverySettings: rule.deliverySettings ?? Prisma.JsonNull,
                textOverrides: rule.textOverrides ?? Prisma.JsonNull,
              })),
            },
          }
        : {}),
    },
  });

  if (options.experiment) {
    await prisma.experiment.create({
      data: {
        shopId,
        campaignId: campaign.id,
        name: options.experiment.name ?? uniqueName("Experiment"),
        status: options.experiment.status ?? ExperimentStatus.RUNNING,
        primaryMetric:
          options.experiment.primaryMetric ??
          ExperimentPrimaryMetric.CLICK_RATE,
        startsAt,
        endsAt,
        variants: {
          create: options.experiment.variants.map((variant) => ({
            campaignId: campaign.id,
            name: variant.name,
            weight: variant.weight,
            status: variant.status ?? ExperimentVariantStatus.ACTIVE,
            designOverride: variant.designOverride ?? Prisma.JsonNull,
            textOverride: variant.textOverride ?? Prisma.JsonNull,
            discountOverride: variant.discountOverride ?? Prisma.JsonNull,
            placementOverride: variant.placementOverride ?? Prisma.JsonNull,
          })),
        },
      },
    });
  }

  if (options.uniqueCodeCount) {
    await seedUniqueCodes({
      campaign,
      codeCount: options.uniqueCodeCount,
      expiresAt: endsAt,
      prefix: uniqueCodePrefix,
      shopId,
    });
  }

  const published = await publishCampaignForShop(campaign.id, shopId);

  return {
    design,
    headline: options.headline,
    id: published.id,
    name: published.name,
    placement,
  };
}

function targetingData(
  targeting: NonNullable<PlacementCampaignOptions["targeting"]>,
) {
  return {
    countries: targeting.countries ?? [],
    markets: targeting.markets ?? [],
    locales: targeting.locales ?? [],
    productIds: targeting.productIds ?? [],
    collectionIds: targeting.collectionIds ?? [],
    productTags: targeting.productTags ?? [],
    customerTags: targeting.customerTags ?? [],
    urlContains: targeting.urlContains ?? [],
    excludedUrlContains: targeting.excludedUrlContains ?? [],
    utmSources: targeting.utmSources ?? [],
    devices: targeting.devices ?? [],
    excludeProductIds: targeting.excludeProductIds ?? [],
    excludeCollectionIds: targeting.excludeCollectionIds ?? [],
    behaviorRules: targeting.behaviorRules ?? Prisma.JsonNull,
  };
}

function translationData(
  options: PlacementCampaignOptions,
  placement: PlacementType,
) {
  const translations = options.translations?.length
    ? options.translations
    : [
        {
          locale: "en",
          headline: options.headline,
          subheadline:
            options.subheadline ?? `Real E2E placement check for ${placement}.`,
          ctaText: options.ctaText ?? "Shop now",
          ctaUrl: options.ctaUrl ?? "/collections/all",
          expiredText: "This test offer has ended.",
          badgeText: options.badgeText ?? options.headline,
        },
      ];

  return translations.map((translation) => ({
    locale: translation.locale,
    headline: translation.headline ?? options.headline,
    subheadline:
      translation.subheadline ??
      options.subheadline ??
      `Real E2E placement check for ${placement}.`,
    ctaText: translation.ctaText ?? options.ctaText ?? "Shop now",
    ctaUrl: translation.ctaUrl ?? options.ctaUrl ?? "/collections/all",
    expiredText: translation.expiredText ?? "This test offer has ended.",
    badgeText: translation.badgeText ?? options.badgeText ?? options.headline,
  }));
}

function buildFixtureDesign(
  placement: PlacementType,
  overrides: PlacementCampaignOptions["design"] = {},
): PlacementFixtureDesign {
  const defaults = designDefaultsForPlacement(placement);

  return {
    backgroundColor: overrides.backgroundColor ?? defaults.backgroundColor,
    layoutClass:
      overrides.layoutClass ??
      layoutClassForDesign(overrides.layout ?? defaults.layout),
    textColor: overrides.textColor ?? "#FFFFFF",
    timerClass: overrides.timerClass ?? "pp-countdown--boxes",
  };
}

function designDataForFixture(
  design: PlacementFixtureDesign,
  overrides: PlacementCampaignOptions["design"] = {},
) {
  const layout = overrides.layout ?? layoutForClass(design.layoutClass);

  return {
    templateKey: "real-e2e-placement",
    layout,
    backgroundType: DesignBackgroundType.SOLID,
    backgroundColor: design.backgroundColor,
    backgroundImageUrl: "",
    gradientStartColor: design.backgroundColor,
    gradientEndColor: design.backgroundColor,
    gradientAngle: 90,
    textColor: design.textColor,
    accentColor: "#FACC15",
    buttonColor: "#FFFFFF",
    buttonTextColor: "#111827",
    closeButtonColor: design.textColor,
    fontSize: 14,
    borderRadius: overrides.borderRadius ?? 8,
    borderSize: 0,
    borderColor: design.backgroundColor,
    fontFamily: DesignFontFamily.SYSTEM,
    titleFontSize: 18,
    titleColor: design.textColor,
    subheadingFontSize: 13,
    subheadingColor: design.textColor,
    timerFontSize: 22,
    timerColor: design.textColor,
    legendFontSize: 10,
    legendColor: design.textColor,
    timerStyle: DesignTimerStyle.BOXES,
    timerFormat: DesignTimerFormat.UNITS,
    timerShowLabels: true,
    timerShowSeconds: true,
    timerDaysLabel: "Days",
    timerHoursLabel: "Hrs",
    timerMinutesLabel: "Mins",
    timerSecondsLabel: "Secs",
    timerHideZeroDays: true,
    timerSurfaceColor: "#111827",
    timerSurfaceBorderColor: "#FFFFFF",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 8,
    paddingBlock: 12,
    paddingInline: 16,
    contentGap: 8,
    contentMaxWidth: 960,
    fullWidth: overrides.fullWidth ?? false,
    positionMode: DesignPositionMode.FLOW,
    positionSticky: false,
    entranceAnimation: DesignBannerAnimation.NONE,
    exitAnimation: DesignBannerAnimation.NONE,
    animationDurationMs: 0,
    timerTickAnimation: DesignTimerTickAnimation.NONE,
    customCss: "",
    mobileEnabled: true,
    alignment: DesignAlignment.CENTER,
    showCloseButton: false,
    showButton: true,
    showProgressBar: true,
    showIcon: true,
    icon: CampaignDesignIcon.TAG,
    iconSize: 18,
    customIconUrl: "",
  };
}

async function seedUniqueCodes({
  campaign,
  codeCount,
  expiresAt,
  prefix,
  shopId,
}: {
  campaign: Campaign;
  codeCount: number;
  expiresAt: Date;
  prefix: string;
  shopId: string;
}) {
  const pool = await prisma.discountCodePool.create({
    data: {
      shopId,
      campaignId: campaign.id,
      prefix,
      discountType: DiscountCodeValueType.PERCENTAGE,
      value: new Prisma.Decimal(15),
      startsAt: new Date(Date.now() - 60 * 1000),
      expiresAt,
      totalGenerated: codeCount,
      status: DiscountCodePoolStatus.ACTIVE,
    },
  });

  await prisma.uniqueDiscountCode.createMany({
    data: Array.from({ length: codeCount }, (_, index) => ({
      shopId,
      campaignId: campaign.id,
      poolId: pool.id,
      code: `${prefix}-${String(index + 1).padStart(3, "0")}`,
      expiresAt,
      status: UniqueDiscountCodeStatus.AVAILABLE,
    })),
  });
}

async function nextCampaignPriority(shopId: string) {
  const result = await prisma.campaign.aggregate({
    where: { shopId },
    _max: { priority: true },
  });

  return (result._max.priority ?? 0) + 1;
}

function typeForPlacement(placement: PlacementType) {
  if (placement === PlacementType.PRODUCT_PAGE)
    return CampaignType.PRODUCT_TIMER;
  if (
    placement === PlacementType.PRODUCT_PAGE_BADGE ||
    placement === PlacementType.COLLECTION_CARD
  ) {
    return CampaignType.PRODUCT_BADGE;
  }
  if (
    placement === PlacementType.CART_PAGE ||
    placement === PlacementType.CART_DRAWER
  ) {
    return CampaignType.CART_TIMER;
  }

  return CampaignType.COUNTDOWN_BAR;
}

function goalForType(type: CampaignType) {
  if (type === CampaignType.PRODUCT_TIMER) return CampaignGoal.FLASH_SALE;
  if (type === CampaignType.PRODUCT_BADGE) return CampaignGoal.PRODUCT_BADGE;
  if (type === CampaignType.CART_TIMER) return CampaignGoal.CART_RESCUE;
  if (type === CampaignType.DELIVERY_CUTOFF)
    return CampaignGoal.DELIVERY_CUTOFF;
  if (type === CampaignType.FREE_SHIPPING_GOAL)
    return CampaignGoal.FREE_SHIPPING;
  if (type === CampaignType.LOW_STOCK) return CampaignGoal.LOW_STOCK_URGENCY;

  return CampaignGoal.ANNOUNCEMENT;
}

function designDefaultsForPlacement(placement: PlacementType) {
  const colors: Record<PlacementType, string> = {
    [PlacementType.TOP_BAR]: "#0F766E",
    [PlacementType.BOTTOM_BAR]: "#6D28D9",
    [PlacementType.PRODUCT_PAGE]: "#1D4ED8",
    [PlacementType.PRODUCT_PAGE_BADGE]: "#B91C1C",
    [PlacementType.COLLECTION_CARD]: "#047857",
    [PlacementType.CART_PAGE]: "#92400E",
    [PlacementType.CART_DRAWER]: "#BE185D",
    [PlacementType.THANK_YOU_PAGE]: "#4338CA",
    [PlacementType.ORDER_STATUS_PAGE]: "#0369A1",
    [PlacementType.CUSTOM_SELECTOR]: "#B45309",
  };

  return {
    backgroundColor: colors[placement],
    layout:
      placement === PlacementType.TOP_BAR ||
      placement === PlacementType.BOTTOM_BAR
        ? DesignLayout.INLINE
        : DesignLayout.STANDARD,
  };
}

function layoutClassForDesign(layout: DesignLayout) {
  return `layout-${layout.toLowerCase()}`;
}

function layoutForClass(layoutClass: string) {
  if (layoutClass.endsWith("inline")) return DesignLayout.INLINE;
  if (layoutClass.endsWith("balanced")) return DesignLayout.BALANCED;
  if (layoutClass.endsWith("stacked-wide")) return DesignLayout.STACKED_WIDE;
  if (layoutClass.endsWith("stacked_wide")) return DesignLayout.STACKED_WIDE;
  if (layoutClass.endsWith("compact-stack")) return DesignLayout.COMPACT_STACK;
  if (layoutClass.endsWith("compact_stack")) return DesignLayout.COMPACT_STACK;
  if (layoutClass.endsWith("cta-right")) return DesignLayout.CTA_RIGHT;
  if (layoutClass.endsWith("cta_right")) return DesignLayout.CTA_RIGHT;
  if (layoutClass.endsWith("cta-left")) return DesignLayout.CTA_LEFT;
  if (layoutClass.endsWith("cta_left")) return DesignLayout.CTA_LEFT;
  if (layoutClass.endsWith("cta-top")) return DesignLayout.CTA_TOP;
  if (layoutClass.endsWith("cta_top")) return DesignLayout.CTA_TOP;

  return DesignLayout.STANDARD;
}

function uniquePrefixForCampaign() {
  return `${DISCOUNT_CODE_PREFIX}${Date.now().toString(36).toUpperCase()}`;
}

export function placementHeadline(label: string) {
  return `${E2E_PREFIX} ${label}`;
}
