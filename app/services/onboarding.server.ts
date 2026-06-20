import {
  TimerExpiredBehavior,
  TimerMode,
  TimerResetBehavior,
  type Shop,
  type ShopOnboardingChecklist,
} from "@prisma/client";

import prisma from "../db.server";
import { createCampaign } from "../models/campaign.server";
import {
  findCampaignDesignTemplate,
  type CampaignDesignTemplate,
} from "../types/campaign-design";
import { defaultDeliveryCutoffSettingsValues } from "../types/delivery-cutoff";
import { defaultFreeShippingSettingsValues } from "../types/free-shipping";
import type {
  OnboardingChecklistField,
  OnboardingChecklistStatus,
  OnboardingGoalValue,
  OnboardingLocationValue,
} from "../types/onboarding";
import { buildDefaultCampaignTranslations } from "../utils/campaign-localization";
import { getStarterCampaignDefaults } from "../utils/onboarding";
import {
  canCreateCampaign,
  getCampaignPlanViolations,
  validateCampaignPlanAccess,
} from "./planLimits.server";

export type CreateStarterCampaignInput = {
  goal: OnboardingGoalValue;
  templateKey: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  location: OnboardingLocationValue;
  timezone?: string;
};

export type OnboardingChecklistInferredState = Partial<
  Pick<
    OnboardingChecklistStatus,
    "firstCampaignCreated" | "firstImpressionReceived"
  >
>;

export class OnboardingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnboardingError";
  }
}

const manualChecklistFields = new Set<OnboardingChecklistField>([
  "appEmbedEnabled",
  "productBlockAdded",
  "cartBlockAdded",
]);

export async function createStarterCampaignFromGoal(
  shop: Pick<Shop, "id" | "plan">,
  input: CreateStarterCampaignInput,
  now = new Date(),
) {
  const defaults = getStarterCampaignDefaults(input.goal, input.location);
  const template = findCampaignDesignTemplate(
    input.templateKey || defaults.templateKey,
  );
  const headline = normalizeText(input.headline) || defaults.headline;
  const subheadline = normalizeText(input.subheadline) || defaults.subheadline;
  const ctaText = normalizeText(input.ctaText) || defaults.ctaText;
  const ctaUrl = normalizeText(input.ctaUrl) || defaults.ctaUrl;
  const timezone = normalizeText(input.timezone) || "UTC";

  const createGate = await canCreateCampaign(shop);

  if (!createGate.allowed) {
    throw new OnboardingError(createGate.reason);
  }

  const planErrors = await validateCampaignPlanAccess(shop, {
    placementType: defaults.placementType,
    status: "ACTIVE",
    startsAt: "",
    type: defaults.type,
  });

  if (planErrors.length > 0) {
    throw new OnboardingError(planErrors.join(" "));
  }

  const campaign = await createCampaign({
    shop: { connect: { id: shop.id } },
    name: defaults.name,
    status: "ACTIVE",
    type: defaults.type,
    goal: defaults.goal,
    startsAt: null,
    endsAt: defaults.type === "COUNTDOWN_BAR" ? daysFromNow(7, now) : null,
    timezone,
    priority: 100,
    placements: {
      create: [
        {
          placementType: defaults.placementType,
          enabled: true,
        },
      ],
    },
    design: {
      create: toCampaignDesignCreateInput(template),
    },
    translations: {
      create: buildDefaultCampaignTranslations({
        goal: defaults.goal,
        type: defaults.type,
        overrides: {
          en: {
            headline,
            subheadline,
            ctaText,
            ctaUrl,
          },
        },
      }),
    },
    ...(defaults.type === "COUNTDOWN_BAR"
      ? {
          timerSettings: {
            create: {
              mode: TimerMode.FIXED_DATE,
              durationMinutes: null,
              recurringDays: [],
              resetBehavior: TimerResetBehavior.NEVER,
              expiredBehavior: TimerExpiredBehavior.UNPUBLISH_TIMER,
            },
          },
        }
      : {}),
    ...(defaults.type === "CART_TIMER"
      ? {
          timerSettings: {
            create: {
              mode: TimerMode.EVERGREEN_SESSION,
              durationMinutes: 15,
              recurringDays: [],
              resetBehavior: TimerResetBehavior.ON_SESSION_END,
              expiredBehavior: TimerExpiredBehavior.HIDE_TIMER,
            },
          },
        }
      : {}),
    ...(defaults.type === "FREE_SHIPPING_GOAL"
      ? {
          freeShippingSettings: {
            create: {
              thresholdAmount:
                defaultFreeShippingSettingsValues.thresholdAmount,
              currencyCode: defaultFreeShippingSettingsValues.currencyCode,
              includeDiscountedSubtotal:
                defaultFreeShippingSettingsValues.includeDiscountedSubtotal,
              emptyCartMessage:
                defaultFreeShippingSettingsValues.emptyCartMessage,
              successMessage: defaultFreeShippingSettingsValues.successMessage,
              progressStyle: defaultFreeShippingSettingsValues.progressStyle,
              thresholdRules: {},
            },
          },
        }
      : {}),
    ...(defaults.type === "DELIVERY_CUTOFF"
      ? {
          deliveryCutoffSettings: {
            create: {
              afterCutoffBehavior:
                defaultDeliveryCutoffSettingsValues.afterCutoffBehavior,
              countryRules: {},
              cutoffHour: Number(
                defaultDeliveryCutoffSettingsValues.cutoffHour,
              ),
              cutoffMinute: Number(
                defaultDeliveryCutoffSettingsValues.cutoffMinute,
              ),
              holidays: [],
              maxDeliveryDays: Number(
                defaultDeliveryCutoffSettingsValues.maxDeliveryDays,
              ),
              minDeliveryDays: Number(
                defaultDeliveryCutoffSettingsValues.minDeliveryDays,
              ),
              processingDays: Number(
                defaultDeliveryCutoffSettingsValues.processingDays,
              ),
              workingDays: [1, 2, 3, 4, 5],
            },
          },
        }
      : {}),
  });

  await updateOnboardingChecklist(shop.id, {
    firstCampaignCreated: true,
  });

  return campaign;
}

export function getOnboardingGoalLockReasons(
  shop: Pick<Shop, "plan">,
): Record<OnboardingGoalValue, string> {
  return {
    FLASH_SALE: getGoalLockReason(shop, "FLASH_SALE"),
    FREE_SHIPPING: getGoalLockReason(shop, "FREE_SHIPPING"),
    DELIVERY_CUTOFF: getGoalLockReason(shop, "DELIVERY_CUTOFF"),
    CART_RESCUE: getGoalLockReason(shop, "CART_RESCUE"),
  };
}

export async function getOnboardingChecklistStatus(
  shopId: string,
  inferred: OnboardingChecklistInferredState = {},
): Promise<OnboardingChecklistStatus> {
  const checklist = await getOrCreateOnboardingChecklist(shopId);
  const nextValues: Partial<OnboardingChecklistStatus> = {};

  if (inferred.firstCampaignCreated && !checklist.firstCampaignCreated) {
    nextValues.firstCampaignCreated = true;
  }

  if (inferred.firstImpressionReceived && !checklist.firstImpressionReceived) {
    nextValues.firstImpressionReceived = true;
  }

  const updatedChecklist =
    Object.keys(nextValues).length > 0
      ? await updateOnboardingChecklist(shopId, nextValues)
      : checklist;

  return toChecklistStatus(updatedChecklist);
}

export async function updateManualOnboardingChecklistField(
  shopId: string,
  field: OnboardingChecklistField,
  value: boolean,
) {
  if (!manualChecklistFields.has(field)) {
    throw new OnboardingError(
      "This onboarding step cannot be changed manually.",
    );
  }

  return updateOnboardingChecklist(shopId, { [field]: value });
}

export function markFirstImpressionReceived(shopId: string) {
  return updateOnboardingChecklist(shopId, {
    firstImpressionReceived: true,
  });
}

function getGoalLockReason(
  shop: Pick<Shop, "plan">,
  goal: OnboardingGoalValue,
) {
  const defaults = getStarterCampaignDefaults(goal);
  const violations = getCampaignPlanViolations(shop, {
    type: defaults.type,
    placements: [
      {
        enabled: true,
        placementType: defaults.placementType,
      },
    ],
  });

  return violations.join(" ");
}

function getOrCreateOnboardingChecklist(shopId: string) {
  return prisma.shopOnboardingChecklist.upsert({
    where: { shopId },
    update: {},
    create: { shopId },
  });
}

function updateOnboardingChecklist(
  shopId: string,
  values: Partial<OnboardingChecklistStatus>,
) {
  return prisma.shopOnboardingChecklist.upsert({
    where: { shopId },
    update: values,
    create: {
      shopId,
      ...values,
    },
  });
}

function toChecklistStatus(
  checklist: Pick<
    ShopOnboardingChecklist,
    | "firstCampaignCreated"
    | "appEmbedEnabled"
    | "productBlockAdded"
    | "cartBlockAdded"
    | "firstImpressionReceived"
  >,
): OnboardingChecklistStatus {
  return {
    firstCampaignCreated: checklist.firstCampaignCreated,
    appEmbedEnabled: checklist.appEmbedEnabled,
    productBlockAdded: checklist.productBlockAdded,
    cartBlockAdded: checklist.cartBlockAdded,
    firstImpressionReceived: checklist.firstImpressionReceived,
  };
}

function toCampaignDesignCreateInput(template: CampaignDesignTemplate) {
  return {
    templateKey: template.templateKey,
    layout: template.layout,
    backgroundType: template.backgroundType,
    backgroundColor: template.backgroundColor,
    gradientStartColor: template.gradientStartColor,
    gradientEndColor: template.gradientEndColor,
    gradientAngle: template.gradientAngle,
    textColor: template.textColor,
    accentColor: template.accentColor,
    buttonColor: template.buttonColor,
    buttonTextColor: template.buttonTextColor,
    fontSize: template.fontSize,
    borderRadius: template.borderRadius,
    borderSize: template.borderSize,
    borderColor: template.borderColor,
    fontFamily: template.fontFamily,
    titleFontSize: template.titleFontSize,
    titleColor: template.titleColor,
    subheadingFontSize: template.subheadingFontSize,
    subheadingColor: template.subheadingColor,
    timerFontSize: template.timerFontSize,
    timerColor: template.timerColor,
    legendFontSize: template.legendFontSize,
    legendColor: template.legendColor,
    timerStyle: template.timerStyle,
    timerFormat: template.timerFormat,
    timerShowLabels: template.timerShowLabels,
    timerShowSeconds: template.timerShowSeconds,
    timerDaysLabel: template.timerDaysLabel,
    timerHoursLabel: template.timerHoursLabel,
    timerMinutesLabel: template.timerMinutesLabel,
    timerSecondsLabel: template.timerSecondsLabel,
    timerHideZeroDays: template.timerHideZeroDays,
    timerSurfaceColor: template.timerSurfaceColor,
    timerSurfaceBorderColor: template.timerSurfaceBorderColor,
    timerSurfaceBorderSize: template.timerSurfaceBorderSize,
    timerSurfaceRadius: template.timerSurfaceRadius,
    paddingBlock: template.paddingBlock,
    paddingInline: template.paddingInline,
    contentGap: template.contentGap,
    fullWidth: template.fullWidth,
    positionMode: template.positionMode,
    positionSticky: template.positionSticky,
    mobileEnabled: template.mobileEnabled,
    customCss: "",
    alignment: template.alignment,
    showCloseButton: template.showCloseButton,
    showIcon: template.showIcon,
    icon: template.icon,
    customIconUrl: template.customIconUrl,
  };
}

function normalizeText(value: string | undefined) {
  return (value ?? "").trim();
}

function daysFromNow(days: number, now: Date) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}
