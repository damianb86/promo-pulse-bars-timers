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
  discountCode?: string;
  goal?: CampaignGoal;
  headline: string;
  name?: string;
  placement: PlacementType;
  subheadline?: string;
  type?: CampaignType;
  uniqueCodeCount?: number;
  uniqueCodePrefix?: string;
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
  const endsAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);
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
      startsAt: new Date(now.getTime() - 60 * 1000),
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
      design: { create: designDataForFixture(design, options.design) },
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
                thresholdAmount: new Prisma.Decimal(75),
                currencyCode: "USD",
                includeDiscountedSubtotal: true,
                emptyCartMessage: "Add items to unlock free shipping.",
                successMessage: "Free shipping unlocked.",
                progressStyle: FreeShippingProgressStyle.BAR,
                thresholdRules: Prisma.JsonNull,
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
                showCodeOnStorefront: true,
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
                  uniqueCodeStartsAt: new Date(now.getTime() - 60 * 1000),
                  uniqueCodeEndsAt: endsAt,
                },
              },
            }
          : {}),
      translations: {
        create: [
          {
            locale: "en",
            headline: options.headline,
            subheadline:
              options.subheadline ??
              `Real E2E placement check for ${placement}.`,
            ctaText: options.ctaText ?? "Shop now",
            ctaUrl: options.ctaUrl ?? "/collections/all",
            expiredText: "This test offer has ended.",
            badgeText: options.badgeText ?? options.headline,
          },
        ],
      },
    },
  });

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
  await prisma.discountCodePool.create({
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
  if (type === CampaignType.FREE_SHIPPING_GOAL)
    return CampaignGoal.FREE_SHIPPING;

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
  if (layoutClass.endsWith("cta-right")) return DesignLayout.CTA_RIGHT;
  if (layoutClass.endsWith("cta-left")) return DesignLayout.CTA_LEFT;
  if (layoutClass.endsWith("cta-top")) return DesignLayout.CTA_TOP;

  return DesignLayout.STANDARD;
}

function uniquePrefixForCampaign() {
  return `${DISCOUNT_CODE_PREFIX}${Date.now().toString(36).toUpperCase()}`;
}

export function placementHeadline(label: string) {
  return `${E2E_PREFIX} ${label}`;
}
