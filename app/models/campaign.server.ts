import {
  CampaignStatus,
  PlacementType,
  Prisma,
  type TimerExpiredBehavior,
  type TimerMode,
  type TimerResetBehavior,
} from "@prisma/client";

import prisma from "../db.server";
import {
  assertCanActivateCampaign,
  buildDuplicateCampaignName,
} from "../services/campaign-rules";
import {
  campaignDuplicateInclude,
  campaignDetailsInclude,
  createEmptyTargetingRules,
  type CreateCampaignInput,
  type CampaignTargetingRules,
  type UpdateCampaignInput,
} from "../types/campaign";
import type {
  CampaignGoalValue,
  CampaignStatusValue,
  CampaignTypeValue,
  EditableCampaignStatusValue,
  PlacementTypeValue,
} from "../types/campaign-options";
import type { CampaignDesignValues } from "../types/campaign-design";
import type { BadgeSettingsValues } from "../types/badge";
import { defaultBadgeSettingsValues } from "../types/badge";
import type { DeliveryCutoffSettingsValues } from "../types/delivery-cutoff";
import { defaultDeliveryCutoffSettingsValues } from "../types/delivery-cutoff";
import type { FreeShippingSettingsValues } from "../types/free-shipping";
import { defaultFreeShippingSettingsValues } from "../types/free-shipping";
import { defaultLowStockSettingsValues } from "../types/low-stock";
import type {
  CampaignTranslationValues,
  StorefrontLocale,
} from "../types/localization";

type CampaignFilters = {
  status?: CampaignStatusValue;
  type?: CampaignTypeValue;
  query?: string;
};

type CampaignBasicsInput = {
  name: string;
  status: EditableCampaignStatusValue;
  type: CampaignTypeValue;
  goal: CampaignGoalValue;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string;
  placementType: PlacementTypeValue;
  customSelector: string;
  targeting: CampaignTargetingRules;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  expiredText: string;
  timerSettings: {
    mode: TimerMode;
    durationMinutes: number | null;
    recurringDays: Prisma.InputJsonValue;
    resetBehavior: TimerResetBehavior;
    expiredBehavior: TimerExpiredBehavior;
  };
};

type CampaignTranslationInput = CampaignTranslationValues & {
  locale: StorefrontLocale;
};

type FreeShippingSettingsInput = {
  thresholdAmount: string;
  currencyCode: string;
  includeDiscountedSubtotal: boolean;
  emptyCartMessage: string;
  successMessage: string;
  progressStyle: FreeShippingSettingsValues["progressStyle"];
  thresholdRules: Prisma.InputJsonValue | null;
};

type DeliveryCutoffSettingsInput = {
  timezone: string;
  cutoffHour: number;
  cutoffMinute: number;
  processingDays: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  workingDays: Prisma.InputJsonValue;
  holidays: Prisma.InputJsonValue;
  countryRules: Prisma.InputJsonValue;
  afterCutoffBehavior: DeliveryCutoffSettingsValues["afterCutoffBehavior"];
};

type LowStockSettingsInput = {
  threshold: number;
  showExactQuantity: boolean;
  fallbackMessage: string;
};

type BadgeSettingsInput = BadgeSettingsValues;

type DiscountSyncInput = {
  shopifyDiscountId: string | null;
  discountCode: string | null;
  method: "CODE" | "AUTOMATIC" | "UNIQUE_CODE";
  syncStartEnd: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  lastSyncedAt?: Date | null;
  title?: string | null;
  valueType?: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING" | null;
  value?: string | number | null;
  minimumSubtotal?: string | number | null;
  appliesOncePerCustomer?: boolean;
  uniqueCodePrefix?: string | null;
  uniqueCodeExpiresMinutes?: number | null;
  uniqueCodeAutoApply?: boolean;
  uniqueCodeStartsAt?: Date | null;
  uniqueCodeEndsAt?: Date | null;
};

type CampaignDetailsRecord = Prisma.CampaignGetPayload<{
  include: typeof campaignDetailsInclude;
}>;

export function getCampaignById(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: campaignDetailsInclude,
  });
}

export function getCampaignsForShop(
  shopId: string,
  filters: CampaignFilters = {},
) {
  const where: Prisma.CampaignWhereInput = { shopId };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.query?.trim()) {
    where.name = { contains: filters.query.trim() };
  }

  return prisma.campaign.findMany({
    where,
    include: campaignDetailsInclude,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

export function getCampaignForShop(id: string, shopId: string) {
  return prisma.campaign.findFirst({
    where: { id, shopId },
    include: campaignDetailsInclude,
  });
}

export function createCampaign(data: CreateCampaignInput) {
  return prisma.campaign.create({
    data,
    include: campaignDetailsInclude,
  });
}

export function updateCampaign(id: string, data: UpdateCampaignInput) {
  return prisma.campaign.update({
    where: { id },
    data,
    include: campaignDetailsInclude,
  });
}

export function toTargetingWriteData(
  targeting: CampaignTargetingRules = createEmptyTargetingRules(),
) {
  return {
    countries: targeting.countries as Prisma.InputJsonValue,
    markets: targeting.markets as Prisma.InputJsonValue,
    locales: targeting.locales as Prisma.InputJsonValue,
    productIds: targeting.productIds as Prisma.InputJsonValue,
    collectionIds: targeting.collectionIds as Prisma.InputJsonValue,
    productTags: targeting.productTags as Prisma.InputJsonValue,
    customerTags: targeting.customerTags as Prisma.InputJsonValue,
    urlContains: targeting.urlContains as Prisma.InputJsonValue,
    utmSources: targeting.utmSources as Prisma.InputJsonValue,
    devices: targeting.devices as Prisma.InputJsonValue,
    excludeProductIds: targeting.excludeProductIds as Prisma.InputJsonValue,
    excludeCollectionIds:
      targeting.excludeCollectionIds as Prisma.InputJsonValue,
    behaviorRules: targeting.behaviorRules as Prisma.InputJsonValue,
  };
}

export async function updateCampaignBasicsForShop(
  id: string,
  shopId: string,
  input: CampaignBasicsInput,
) {
  await assertCampaignBelongsToShop(id, shopId);

  return prisma.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id },
      data: {
        name: input.name,
        status: input.status,
        type: input.type,
        goal: input.goal,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timezone: input.timezone,
        lastSavedAt: new Date(),
      },
    });

    await tx.campaignPlacement.deleteMany({
      where: { campaignId: id },
    });

    await tx.campaignPlacement.create({
      data: {
        campaignId: id,
        placementType: input.placementType,
        customSelector:
          input.placementType === "CUSTOM_SELECTOR"
            ? input.customSelector.trim() || null
            : null,
        enabled: true,
      },
    });

    await tx.campaignTargeting.upsert({
      where: { campaignId: id },
      create: {
        campaignId: id,
        ...toTargetingWriteData(input.targeting),
      },
      update: toTargetingWriteData(input.targeting),
    });

    await tx.campaignTranslation.upsert({
      where: {
        campaignId_locale: {
          campaignId: id,
          locale: "en",
        },
      },
      create: {
        campaignId: id,
        locale: "en",
        headline: input.headline,
        subheadline: input.subheadline,
        ctaText: input.ctaText,
        ctaUrl: input.ctaUrl,
        expiredText: input.expiredText,
      },
      update: {
        headline: input.headline,
        subheadline: input.subheadline,
        ctaText: input.ctaText,
        ctaUrl: input.ctaUrl,
        expiredText: input.expiredText,
      },
    });

    await tx.timerSettings.upsert({
      where: { campaignId: id },
      create: {
        campaignId: id,
        mode: input.timerSettings.mode,
        durationMinutes: input.timerSettings.durationMinutes,
        recurringDays: input.timerSettings.recurringDays,
        resetBehavior: input.timerSettings.resetBehavior,
        expiredBehavior: input.timerSettings.expiredBehavior,
      },
      update: {
        mode: input.timerSettings.mode,
        durationMinutes: input.timerSettings.durationMinutes,
        recurringDays: input.timerSettings.recurringDays,
        resetBehavior: input.timerSettings.resetBehavior,
        expiredBehavior: input.timerSettings.expiredBehavior,
      },
    });

    if (input.type === "FREE_SHIPPING_GOAL" || input.goal === "FREE_SHIPPING") {
      await tx.freeShippingSettings.upsert({
        where: { campaignId: id },
        create: {
          campaignId: id,
          thresholdAmount: defaultFreeShippingSettingsValues.thresholdAmount,
          currencyCode: defaultFreeShippingSettingsValues.currencyCode,
          includeDiscountedSubtotal:
            defaultFreeShippingSettingsValues.includeDiscountedSubtotal,
          emptyCartMessage: defaultFreeShippingSettingsValues.emptyCartMessage,
          successMessage: defaultFreeShippingSettingsValues.successMessage,
          progressStyle: defaultFreeShippingSettingsValues.progressStyle,
          thresholdRules: Prisma.JsonNull,
        },
        update: {},
      });
    }

    if (input.type === "DELIVERY_CUTOFF" || input.goal === "DELIVERY_CUTOFF") {
      await tx.deliveryCutoffSettings.upsert({
        where: { campaignId: id },
        create: {
          campaignId: id,
          cutoffHour: Number(defaultDeliveryCutoffSettingsValues.cutoffHour),
          cutoffMinute: Number(
            defaultDeliveryCutoffSettingsValues.cutoffMinute,
          ),
          processingDays: Number(
            defaultDeliveryCutoffSettingsValues.processingDays,
          ),
          minDeliveryDays: Number(
            defaultDeliveryCutoffSettingsValues.minDeliveryDays,
          ),
          maxDeliveryDays: Number(
            defaultDeliveryCutoffSettingsValues.maxDeliveryDays,
          ),
          workingDays: [1, 2, 3, 4, 5],
          holidays: [],
          countryRules: {},
          afterCutoffBehavior:
            defaultDeliveryCutoffSettingsValues.afterCutoffBehavior,
        },
        update: {},
      });
    }

    if (input.type === "LOW_STOCK" || input.goal === "LOW_STOCK_URGENCY") {
      await tx.lowStockSettings.upsert({
        where: { campaignId: id },
        create: {
          campaignId: id,
          threshold: Number(defaultLowStockSettingsValues.threshold),
          showExactQuantity: defaultLowStockSettingsValues.showExactQuantity,
          fallbackMessage: defaultLowStockSettingsValues.fallbackMessage,
        },
        update: {},
      });
    }

    if (input.type === "PRODUCT_BADGE" || input.goal === "PRODUCT_BADGE") {
      await tx.badgeSettings.upsert({
        where: { campaignId: id },
        create: {
          campaignId: id,
          badgeText: defaultBadgeSettingsValues.badgeText,
          badgeShape: defaultBadgeSettingsValues.badgeShape,
          badgePosition: defaultBadgeSettingsValues.badgePosition,
        },
        update: {},
      });
    }

    return tx.campaign.findUniqueOrThrow({
      where: { id },
      include: campaignDetailsInclude,
    });
  });
}

export async function updateLowStockSettingsForShop(
  id: string,
  shopId: string,
  input: LowStockSettingsInput,
) {
  await assertCampaignBelongsToShop(id, shopId);

  return prisma.lowStockSettings.upsert({
    where: { campaignId: id },
    create: {
      campaignId: id,
      threshold: input.threshold,
      showExactQuantity: input.showExactQuantity,
      fallbackMessage: input.fallbackMessage,
    },
    update: {
      threshold: input.threshold,
      showExactQuantity: input.showExactQuantity,
      fallbackMessage: input.fallbackMessage,
    },
  });
}

export async function updateBadgeSettingsForShop(
  id: string,
  shopId: string,
  input: BadgeSettingsInput,
) {
  await assertCampaignBelongsToShop(id, shopId);

  return prisma.badgeSettings.upsert({
    where: { campaignId: id },
    create: {
      campaignId: id,
      badgeText: input.badgeText,
      badgeShape: input.badgeShape,
      badgePosition: input.badgePosition,
    },
    update: {
      badgeText: input.badgeText,
      badgeShape: input.badgeShape,
      badgePosition: input.badgePosition,
    },
  });
}

export async function clearDiscountSyncForShop(id: string, shopId: string) {
  await assertCampaignBelongsToShop(id, shopId);

  return prisma.discountSync.deleteMany({
    where: { campaignId: id },
  });
}

export async function updateDiscountSyncForShop(
  id: string,
  shopId: string,
  input: DiscountSyncInput,
) {
  await assertCampaignBelongsToShop(id, shopId);

  return prisma.$transaction(async (tx) => {
    if (input.syncStartEnd) {
      await tx.campaign.update({
        where: { id },
        data: {
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
        },
      });
    }

    return tx.discountSync.upsert({
      where: { campaignId: id },
      create: {
        campaignId: id,
        shopifyDiscountId: input.shopifyDiscountId,
        discountCode: input.discountCode,
        method: input.method,
        syncStartEnd: input.syncStartEnd,
        lastSyncedAt: input.lastSyncedAt ?? null,
        title: input.title ?? null,
        valueType: input.valueType ?? null,
        value: input.value ?? null,
        minimumSubtotal: input.minimumSubtotal ?? null,
        appliesOncePerCustomer: input.appliesOncePerCustomer ?? false,
        uniqueCodePrefix: input.uniqueCodePrefix ?? null,
        uniqueCodeExpiresMinutes: input.uniqueCodeExpiresMinutes ?? null,
        uniqueCodeAutoApply: input.uniqueCodeAutoApply ?? false,
        uniqueCodeStartsAt: input.uniqueCodeStartsAt ?? null,
        uniqueCodeEndsAt: input.uniqueCodeEndsAt ?? null,
      },
      update: {
        shopifyDiscountId: input.shopifyDiscountId,
        discountCode: input.discountCode,
        method: input.method,
        syncStartEnd: input.syncStartEnd,
        lastSyncedAt: input.lastSyncedAt ?? null,
        title: input.title ?? null,
        valueType: input.valueType ?? null,
        value: input.value ?? null,
        minimumSubtotal: input.minimumSubtotal ?? null,
        appliesOncePerCustomer: input.appliesOncePerCustomer ?? false,
        uniqueCodePrefix: input.uniqueCodePrefix ?? null,
        uniqueCodeExpiresMinutes: input.uniqueCodeExpiresMinutes ?? null,
        uniqueCodeAutoApply: input.uniqueCodeAutoApply ?? false,
        uniqueCodeStartsAt: input.uniqueCodeStartsAt ?? null,
        uniqueCodeEndsAt: input.uniqueCodeEndsAt ?? null,
      },
    });
  });
}

export async function updateDeliveryCutoffSettingsForShop(
  id: string,
  shopId: string,
  input: DeliveryCutoffSettingsInput,
) {
  await assertCampaignBelongsToShop(id, shopId);

  return prisma.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id },
      data: { timezone: input.timezone },
    });

    return tx.deliveryCutoffSettings.upsert({
      where: { campaignId: id },
      create: {
        campaignId: id,
        cutoffHour: input.cutoffHour,
        cutoffMinute: input.cutoffMinute,
        processingDays: input.processingDays,
        minDeliveryDays: input.minDeliveryDays,
        maxDeliveryDays: input.maxDeliveryDays,
        workingDays: input.workingDays,
        holidays: input.holidays,
        countryRules: input.countryRules,
        afterCutoffBehavior: input.afterCutoffBehavior,
      },
      update: {
        cutoffHour: input.cutoffHour,
        cutoffMinute: input.cutoffMinute,
        processingDays: input.processingDays,
        minDeliveryDays: input.minDeliveryDays,
        maxDeliveryDays: input.maxDeliveryDays,
        workingDays: input.workingDays,
        holidays: input.holidays,
        countryRules: input.countryRules,
        afterCutoffBehavior: input.afterCutoffBehavior,
      },
    });
  });
}

export async function updateFreeShippingSettingsForShop(
  id: string,
  shopId: string,
  input: FreeShippingSettingsInput,
) {
  await assertCampaignBelongsToShop(id, shopId);

  return prisma.freeShippingSettings.upsert({
    where: { campaignId: id },
    create: {
      campaignId: id,
      thresholdAmount: input.thresholdAmount,
      currencyCode: input.currencyCode,
      includeDiscountedSubtotal: input.includeDiscountedSubtotal,
      emptyCartMessage: input.emptyCartMessage,
      successMessage: input.successMessage,
      progressStyle: input.progressStyle,
      thresholdRules: input.thresholdRules ?? Prisma.JsonNull,
    },
    update: {
      thresholdAmount: input.thresholdAmount,
      currencyCode: input.currencyCode,
      includeDiscountedSubtotal: input.includeDiscountedSubtotal,
      emptyCartMessage: input.emptyCartMessage,
      successMessage: input.successMessage,
      progressStyle: input.progressStyle,
      thresholdRules: input.thresholdRules ?? Prisma.JsonNull,
    },
  });
}

function toCampaignDesignWriteData(input: CampaignDesignValues) {
  return {
    templateKey: input.templateKey,
    layout: input.layout,
    backgroundType: input.backgroundType,
    backgroundColor: input.backgroundColor,
    backgroundImageUrl: input.backgroundImageUrl,
    gradientStartColor: input.gradientStartColor,
    gradientEndColor: input.gradientEndColor,
    gradientAngle: input.gradientAngle,
    textColor: input.textColor,
    accentColor: input.accentColor,
    buttonColor: input.buttonColor,
    buttonTextColor: input.buttonTextColor,
    fontSize: input.fontSize,
    borderRadius: input.borderRadius,
    borderSize: input.borderSize,
    borderColor: input.borderColor,
    fontFamily: input.fontFamily,
    titleFontSize: input.titleFontSize,
    titleColor: input.titleColor,
    subheadingFontSize: input.subheadingFontSize,
    subheadingColor: input.subheadingColor,
    timerFontSize: input.timerFontSize,
    timerColor: input.timerColor,
    legendFontSize: input.legendFontSize,
    legendColor: input.legendColor,
    timerStyle: input.timerStyle,
    timerFormat: input.timerFormat,
    timerShowLabels: input.timerShowLabels,
    timerShowSeconds: input.timerShowSeconds,
    timerDaysLabel: input.timerDaysLabel,
    timerHoursLabel: input.timerHoursLabel,
    timerMinutesLabel: input.timerMinutesLabel,
    timerSecondsLabel: input.timerSecondsLabel,
    timerHideZeroDays: input.timerHideZeroDays,
    timerSurfaceColor: input.timerSurfaceColor,
    timerSurfaceBorderColor: input.timerSurfaceBorderColor,
    timerSurfaceBorderSize: input.timerSurfaceBorderSize,
    timerSurfaceRadius: input.timerSurfaceRadius,
    paddingBlock: input.paddingBlock,
    paddingInline: input.paddingInline,
    contentGap: input.contentGap,
    contentMaxWidth: input.contentMaxWidth,
    fullWidth: input.fullWidth,
    positionMode: input.positionMode,
    positionSticky: input.positionSticky,
    customCss: input.customCss,
    mobileEnabled: input.mobileEnabled,
    alignment: input.alignment,
    showCloseButton: input.showCloseButton,
    showButton: input.showButton,
    showIcon: input.showIcon,
    icon: input.icon,
    customIconUrl: input.customIconUrl,
  };
}

export async function updateCampaignDesignForShop(
  id: string,
  shopId: string,
  input: CampaignDesignValues,
) {
  await assertCampaignBelongsToShop(id, shopId);

  return prisma.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id },
      data: { lastSavedAt: new Date() },
    });

    return tx.campaignDesign.upsert({
      where: { campaignId: id },
      create: {
        campaignId: id,
        ...toCampaignDesignWriteData(input),
      },
      update: toCampaignDesignWriteData(input),
    });
  });
}

export async function publishCampaignForShop(id: string, shopId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id, shopId },
    include: campaignDetailsInclude,
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  assertCanActivateCampaign(campaign);

  const now = new Date();
  const snapshot = createCampaignPublicationSnapshot({
    ...campaign,
    status: CampaignStatus.ACTIVE,
    publishedAt: now,
    lastSavedAt: now,
  });

  return prisma.campaign.update({
    where: { id },
    data: {
      status: CampaignStatus.ACTIVE,
      lastSavedAt: now,
      publishedAt: now,
      publishedSnapshot: snapshot,
    },
    include: campaignDetailsInclude,
  });
}

export async function updateCampaignTranslationsForShop(
  id: string,
  shopId: string,
  translations: CampaignTranslationInput[],
) {
  await assertCampaignBelongsToShop(id, shopId);

  return prisma.$transaction(async (tx) => {
    for (const translation of translations) {
      await tx.campaignTranslation.upsert({
        where: {
          campaignId_locale: {
            campaignId: id,
            locale: translation.locale,
          },
        },
        create: {
          campaignId: id,
          locale: translation.locale,
          headline: translation.headline,
          subheadline: translation.subheadline,
          ctaText: translation.ctaText,
          expiredText: translation.expiredText,
          freeShippingEmptyText: translation.freeShippingEmptyText,
          freeShippingProgressText: translation.freeShippingProgressText,
          freeShippingSuccessText: translation.freeShippingSuccessText,
          deliveryBeforeCutoffText: translation.deliveryBeforeCutoffText,
          deliveryAfterCutoffText: translation.deliveryAfterCutoffText,
          lowStockText: translation.lowStockText,
          badgeText: translation.badgeText,
        },
        update: {
          headline: translation.headline,
          subheadline: translation.subheadline,
          ctaText: translation.ctaText,
          expiredText: translation.expiredText,
          freeShippingEmptyText: translation.freeShippingEmptyText,
          freeShippingProgressText: translation.freeShippingProgressText,
          freeShippingSuccessText: translation.freeShippingSuccessText,
          deliveryBeforeCutoffText: translation.deliveryBeforeCutoffText,
          deliveryAfterCutoffText: translation.deliveryAfterCutoffText,
          lowStockText: translation.lowStockText,
          badgeText: translation.badgeText,
        },
      });
    }

    return tx.campaign.findUniqueOrThrow({
      where: { id },
      include: campaignDetailsInclude,
    });
  });
}

export function deleteCampaign(id: string) {
  return prisma.campaign.delete({
    where: { id },
    include: campaignDetailsInclude,
  });
}

export async function deleteCampaignForShop(id: string, shopId: string) {
  await assertCampaignBelongsToShop(id, shopId);

  return deleteCampaign(id);
}

export async function activateCampaign(id: string, shopId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id, shopId },
    include: {
      placements: true,
      translations: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  assertCanActivateCampaign(campaign);

  return prisma.campaign.update({
    where: { id },
    data: { status: CampaignStatus.ACTIVE },
    include: campaignDetailsInclude,
  });
}

export function pauseCampaign(id: string, shopId: string) {
  return updateCampaignStatusForShop(id, shopId, CampaignStatus.PAUSED);
}

export function expireCampaign(id: string, shopId: string) {
  return updateCampaignStatusForShop(id, shopId, CampaignStatus.EXPIRED);
}

async function updateCampaignStatusForShop(
  id: string,
  shopId: string,
  status: CampaignStatus,
) {
  await assertCampaignBelongsToShop(id, shopId);

  return prisma.campaign.update({
    where: { id },
    data: { status },
    include: campaignDetailsInclude,
  });
}

export async function duplicateCampaign(id: string, shopId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id, shopId },
    include: campaignDuplicateInclude,
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  return prisma.campaign.create({
    data: {
      shop: { connect: { id: shopId } },
      name: buildDuplicateCampaignName(campaign.name),
      status: CampaignStatus.DRAFT,
      type: campaign.type,
      goal: campaign.goal,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
      priority: campaign.priority,
      placements: {
        create: campaign.placements.map((placement) => ({
          placementType: placement.placementType,
          customSelector: placement.customSelector,
          enabled: placement.enabled,
        })),
      },
      ...(campaign.targeting
        ? {
            targeting: {
              create: {
                countries: campaign.targeting
                  .countries as Prisma.InputJsonValue,
                markets: campaign.targeting.markets as Prisma.InputJsonValue,
                locales: campaign.targeting.locales as Prisma.InputJsonValue,
                productIds: campaign.targeting
                  .productIds as Prisma.InputJsonValue,
                collectionIds: campaign.targeting
                  .collectionIds as Prisma.InputJsonValue,
                productTags: campaign.targeting
                  .productTags as Prisma.InputJsonValue,
                customerTags: campaign.targeting
                  .customerTags as Prisma.InputJsonValue,
                urlContains: campaign.targeting
                  .urlContains as Prisma.InputJsonValue,
                utmSources: campaign.targeting
                  .utmSources as Prisma.InputJsonValue,
                devices: campaign.targeting.devices as Prisma.InputJsonValue,
                excludeProductIds: campaign.targeting
                  .excludeProductIds as Prisma.InputJsonValue,
                excludeCollectionIds: campaign.targeting
                  .excludeCollectionIds as Prisma.InputJsonValue,
                behaviorRules:
                  (campaign.targeting.behaviorRules as Prisma.InputJsonValue) ??
                  Prisma.JsonNull,
              },
            },
          }
        : {}),
      ...(campaign.design
        ? {
            design: {
              create: {
                templateKey: campaign.design.templateKey,
                layout: campaign.design.layout,
                backgroundType: campaign.design.backgroundType,
                backgroundColor: campaign.design.backgroundColor,
                backgroundImageUrl: campaign.design.backgroundImageUrl,
                gradientStartColor: campaign.design.gradientStartColor,
                gradientEndColor: campaign.design.gradientEndColor,
                gradientAngle: campaign.design.gradientAngle,
                textColor: campaign.design.textColor,
                accentColor: campaign.design.accentColor,
                buttonColor: campaign.design.buttonColor,
                buttonTextColor: campaign.design.buttonTextColor,
                fontSize: campaign.design.fontSize,
                borderRadius: campaign.design.borderRadius,
                borderSize: campaign.design.borderSize,
                borderColor: campaign.design.borderColor,
                fontFamily: campaign.design.fontFamily,
                titleFontSize: campaign.design.titleFontSize,
                titleColor: campaign.design.titleColor,
                subheadingFontSize: campaign.design.subheadingFontSize,
                subheadingColor: campaign.design.subheadingColor,
                timerFontSize: campaign.design.timerFontSize,
                timerColor: campaign.design.timerColor,
                legendFontSize: campaign.design.legendFontSize,
                legendColor: campaign.design.legendColor,
                timerStyle: campaign.design.timerStyle,
                timerFormat: campaign.design.timerFormat,
                timerShowLabels: campaign.design.timerShowLabels,
                timerShowSeconds: campaign.design.timerShowSeconds,
                timerDaysLabel: campaign.design.timerDaysLabel,
                timerHoursLabel: campaign.design.timerHoursLabel,
                timerMinutesLabel: campaign.design.timerMinutesLabel,
                timerSecondsLabel: campaign.design.timerSecondsLabel,
                timerHideZeroDays: campaign.design.timerHideZeroDays,
                timerSurfaceColor: campaign.design.timerSurfaceColor,
                timerSurfaceBorderColor:
                  campaign.design.timerSurfaceBorderColor,
                timerSurfaceBorderSize: campaign.design.timerSurfaceBorderSize,
                timerSurfaceRadius: campaign.design.timerSurfaceRadius,
                paddingBlock: campaign.design.paddingBlock,
                paddingInline: campaign.design.paddingInline,
                contentGap: campaign.design.contentGap,
                contentMaxWidth: campaign.design.contentMaxWidth,
                fullWidth: campaign.design.fullWidth,
                positionMode: campaign.design.positionMode,
                positionSticky: campaign.design.positionSticky,
                customCss: campaign.design.customCss,
                mobileEnabled: campaign.design.mobileEnabled,
                alignment: campaign.design.alignment,
                showCloseButton: campaign.design.showCloseButton,
                showButton: campaign.design.showButton,
                showIcon: campaign.design.showIcon,
                icon: campaign.design.icon,
                customIconUrl: campaign.design.customIconUrl,
              },
            },
          }
        : {}),
      ...(campaign.timerSettings
        ? {
            timerSettings: {
              create: {
                mode: campaign.timerSettings.mode,
                durationMinutes: campaign.timerSettings.durationMinutes,
                recurringDays: campaign.timerSettings
                  .recurringDays as Prisma.InputJsonValue,
                resetBehavior: campaign.timerSettings.resetBehavior,
                expiredBehavior: campaign.timerSettings.expiredBehavior,
              },
            },
          }
        : {}),
      ...(campaign.freeShippingSettings
        ? {
            freeShippingSettings: {
              create: {
                thresholdAmount: campaign.freeShippingSettings.thresholdAmount,
                currencyCode: campaign.freeShippingSettings.currencyCode,
                includeDiscountedSubtotal:
                  campaign.freeShippingSettings.includeDiscountedSubtotal,
                emptyCartMessage:
                  campaign.freeShippingSettings.emptyCartMessage,
                successMessage: campaign.freeShippingSettings.successMessage,
                progressStyle: campaign.freeShippingSettings.progressStyle,
                thresholdRules:
                  campaign.freeShippingSettings.thresholdRules ??
                  Prisma.JsonNull,
              },
            },
          }
        : {}),
      ...(campaign.deliveryCutoffSettings
        ? {
            deliveryCutoffSettings: {
              create: {
                cutoffHour: campaign.deliveryCutoffSettings.cutoffHour,
                cutoffMinute: campaign.deliveryCutoffSettings.cutoffMinute,
                processingDays: campaign.deliveryCutoffSettings.processingDays,
                minDeliveryDays:
                  campaign.deliveryCutoffSettings.minDeliveryDays,
                maxDeliveryDays:
                  campaign.deliveryCutoffSettings.maxDeliveryDays,
                workingDays: campaign.deliveryCutoffSettings
                  .workingDays as Prisma.InputJsonValue,
                holidays: campaign.deliveryCutoffSettings
                  .holidays as Prisma.InputJsonValue,
                countryRules: campaign.deliveryCutoffSettings
                  .countryRules as Prisma.InputJsonValue,
                afterCutoffBehavior:
                  campaign.deliveryCutoffSettings.afterCutoffBehavior,
              },
            },
          }
        : {}),
      ...(campaign.lowStockSettings
        ? {
            lowStockSettings: {
              create: {
                threshold: campaign.lowStockSettings.threshold,
                showExactQuantity: campaign.lowStockSettings.showExactQuantity,
                fallbackMessage: campaign.lowStockSettings.fallbackMessage,
              },
            },
          }
        : {}),
      ...(campaign.badgeSettings
        ? {
            badgeSettings: {
              create: {
                badgeText: campaign.badgeSettings.badgeText,
                badgeShape: campaign.badgeSettings.badgeShape,
                badgePosition: campaign.badgeSettings.badgePosition,
              },
            },
          }
        : {}),
      ...(campaign.discountSync
        ? {
            discountSync: {
              create: {
                shopifyDiscountId: campaign.discountSync.shopifyDiscountId,
                discountCode: campaign.discountSync.discountCode,
                method: campaign.discountSync.method,
                syncStartEnd: campaign.discountSync.syncStartEnd,
                lastSyncedAt: campaign.discountSync.lastSyncedAt,
                title: campaign.discountSync.title,
                valueType: campaign.discountSync.valueType,
                value: campaign.discountSync.value,
                minimumSubtotal: campaign.discountSync.minimumSubtotal,
                appliesOncePerCustomer:
                  campaign.discountSync.appliesOncePerCustomer,
                uniqueCodePrefix: campaign.discountSync.uniqueCodePrefix,
                uniqueCodeExpiresMinutes:
                  campaign.discountSync.uniqueCodeExpiresMinutes,
                uniqueCodeAutoApply: campaign.discountSync.uniqueCodeAutoApply,
                uniqueCodeStartsAt: campaign.discountSync.uniqueCodeStartsAt,
                uniqueCodeEndsAt: campaign.discountSync.uniqueCodeEndsAt,
              },
            },
          }
        : {}),
      ...(campaign.marketCampaignRules.length > 0
        ? {
            marketCampaignRules: {
              create: campaign.marketCampaignRules.map((rule) => ({
                shop: { connect: { id: shopId } },
                enabled: rule.enabled,
                marketId: rule.marketId,
                countryCode: rule.countryCode,
                locale: rule.locale,
                currencyCode: rule.currencyCode,
                thresholdAmount: rule.thresholdAmount,
                deliverySettings: rule.deliverySettings ?? Prisma.JsonNull,
                textOverrides: rule.textOverrides ?? Prisma.JsonNull,
              })),
            },
          }
        : {}),
      translations: {
        create: campaign.translations.map((translation) => ({
          locale: translation.locale,
          headline: translation.headline,
          subheadline: translation.subheadline,
          ctaText: translation.ctaText,
          ctaUrl: translation.ctaUrl,
          expiredText: translation.expiredText,
          freeShippingEmptyText: translation.freeShippingEmptyText,
          freeShippingProgressText: translation.freeShippingProgressText,
          freeShippingSuccessText: translation.freeShippingSuccessText,
          deliveryBeforeCutoffText: translation.deliveryBeforeCutoffText,
          deliveryAfterCutoffText: translation.deliveryAfterCutoffText,
          lowStockText: translation.lowStockText,
          badgeText: translation.badgeText,
        })),
      },
    },
    include: campaignDetailsInclude,
  });
}

export async function updateCampaignBehaviorTargetingForShop(
  id: string,
  shopId: string,
  behaviorRules: Prisma.InputJsonValue,
) {
  await assertCampaignBelongsToShop(id, shopId);

  return prisma.campaignTargeting.upsert({
    where: { campaignId: id },
    create: {
      campaignId: id,
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
      behaviorRules,
    },
    update: {
      behaviorRules,
    },
  });
}

async function assertCampaignBelongsToShop(id: string, shopId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id, shopId },
    select: { id: true },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }
}

export async function getActiveCampaignsForShop(
  shopId: string,
  at = new Date(),
  placementType?: PlacementType,
) {
  const campaigns = await prisma.campaign.findMany({
    where: {
      shopId,
      publishedAt: { not: null },
    },
    include: campaignDetailsInclude,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return campaigns
    .map(hydratePublishedCampaignSnapshot)
    .filter((campaign) =>
      isPublishedCampaignActive(campaign, at, placementType),
    );
}

function isPublishedCampaignActive(
  campaign: CampaignDetailsRecord,
  at: Date,
  placementType?: PlacementType,
) {
  if (campaign.status !== CampaignStatus.ACTIVE) return false;

  if (campaign.startsAt && campaign.startsAt > at) return false;
  if (
    campaign.endsAt &&
    campaign.endsAt < at &&
    (campaign.timerSettings?.expiredBehavior ?? "UNPUBLISH_TIMER") ===
      "UNPUBLISH_TIMER"
  ) {
    return false;
  }

  if (!placementType) return true;

  return campaign.placements.some(
    (placement) =>
      placement.enabled && placement.placementType === placementType,
  );
}

function createCampaignPublicationSnapshot(
  campaign: CampaignDetailsRecord,
): Prisma.InputJsonValue {
  const snapshot = JSON.parse(
    JSON.stringify({
      ...campaign,
      publishedSnapshot: undefined,
    }),
  ) as Record<string, unknown>;

  delete snapshot.publishedSnapshot;

  return snapshot as Prisma.InputJsonObject;
}

function hydratePublishedCampaignSnapshot(
  campaign: CampaignDetailsRecord,
): CampaignDetailsRecord {
  const snapshot = readJsonObject(campaign.publishedSnapshot);

  if (!snapshot) return campaign;

  const hydrated = {
    ...campaign,
    ...snapshot,
    createdAt: readDate(snapshot.createdAt) ?? campaign.createdAt,
    updatedAt: readDate(snapshot.updatedAt) ?? campaign.updatedAt,
    startsAt: readDate(snapshot.startsAt),
    endsAt: readDate(snapshot.endsAt),
    lastSavedAt: readDate(snapshot.lastSavedAt) ?? campaign.lastSavedAt,
    publishedAt: readDate(snapshot.publishedAt) ?? campaign.publishedAt,
    placements: readArray(snapshot.placements, campaign.placements),
    targeting: readNullableObject(snapshot.targeting, campaign.targeting),
    design: readNullableObject(snapshot.design, campaign.design),
    timerSettings: readNullableObject(
      snapshot.timerSettings,
      campaign.timerSettings,
    ),
    freeShippingSettings: readNullableObject(
      snapshot.freeShippingSettings,
      campaign.freeShippingSettings,
    ),
    deliveryCutoffSettings: readNullableObject(
      snapshot.deliveryCutoffSettings,
      campaign.deliveryCutoffSettings,
    ),
    lowStockSettings: readNullableObject(
      snapshot.lowStockSettings,
      campaign.lowStockSettings,
    ),
    badgeSettings: readNullableObject(
      snapshot.badgeSettings,
      campaign.badgeSettings,
    ),
    discountSync: readNullableObject(
      snapshot.discountSync,
      campaign.discountSync,
    ),
    marketCampaignRules: readArray(
      snapshot.marketCampaignRules,
      campaign.marketCampaignRules,
    ),
    translations: readArray(snapshot.translations, campaign.translations),
    experiments: hydrateExperimentSnapshots(
      readArray(snapshot.experiments, campaign.experiments),
    ),
  };

  return hydrated as CampaignDetailsRecord;
}

function hydrateExperimentSnapshots(
  experiments: CampaignDetailsRecord["experiments"],
) {
  return experiments.map((experiment) => ({
    ...experiment,
    createdAt: readDate(experiment.createdAt) ?? experiment.createdAt,
    updatedAt: readDate(experiment.updatedAt) ?? experiment.updatedAt,
    startsAt: readDate(experiment.startsAt),
    endsAt: readDate(experiment.endsAt),
    variants: experiment.variants.map((variant) => ({
      ...variant,
      createdAt: readDate(variant.createdAt) ?? variant.createdAt,
      updatedAt: readDate(variant.updatedAt) ?? variant.updatedAt,
    })),
  }));
}

function readJsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readNullableObject<T>(value: unknown, fallback: T): T {
  if (value === null) return null as T;

  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : fallback;
}

function readArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function readDate(value: unknown) {
  if (!value || typeof value !== "string") return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}
