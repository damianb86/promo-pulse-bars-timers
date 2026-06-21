import {
  defaultCampaignDesignValues,
  type CampaignDesignValues,
} from "../types/campaign-design";
import type { BadgePositionValue, BadgeShapeValue } from "../types/badge";
import { toBadgePosition, toBadgeShape } from "../types/badge";
import type {
  AfterCutoffBehavior,
  DeliveryPromiseSettings,
} from "../lib/delivery-promise";
import type {
  TimerMode,
  TimerExpiredBehavior,
  TimerResetBehavior,
  TimerSettingsInput,
} from "../lib/timer";
import {
  getCampaignText,
  type CampaignTranslationRecord,
} from "./campaign-localization";

export type CampaignViewModelInput = {
  name: string;
  type: string;
  endsAt?: Date | string | null;
  timezone?: string | null;
  placements: Array<{ placementType: string; enabled: boolean }>;
  translations: CampaignTranslationRecord[];
  design:
    | (Partial<CampaignDesignValues> & {
        mobileDesign?: unknown;
        customCss?: string | null;
      })
    | null;
  timerSettings?: {
    mode: string;
    durationMinutes?: number | null;
    expiredBehavior?: string | null;
    recurringDays?: unknown;
    resetBehavior?: string | null;
  } | null;
  deliveryCutoffSettings?: {
    cutoffHour: number;
    cutoffMinute?: number | null;
    processingDays?: number | null;
    minDeliveryDays: number;
    maxDeliveryDays: number;
    workingDays?: unknown;
    holidays?: unknown;
    countryRules?: unknown;
    afterCutoffBehavior?: string | null;
  } | null;
  freeShippingSettings?: {
    thresholdAmount: { toString(): string } | string | number;
    currencyCode: string;
    includeDiscountedSubtotal?: boolean | null;
    emptyCartMessage?: string | null;
    successMessage?: string | null;
    progressStyle?: string | null;
    thresholdRules?: unknown;
  } | null;
  lowStockSettings?: {
    threshold: number;
    showExactQuantity: boolean;
    fallbackMessage?: string | null;
  } | null;
  badgeSettings?: {
    badgeText: string;
    badgeShape: string;
    badgePosition: string;
  } | null;
  discountSync?: {
    discountCode?: string | null;
    showCodeOnStorefront?: boolean | null;
  } | null;
};

export type CampaignViewModel = {
  name: string;
  type: string;
  timezone: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  expiredText: string;
  freeShippingEmptyText: string;
  freeShippingProgressText: string;
  freeShippingSuccessText: string;
  deliveryBeforeCutoffText: string;
  deliveryAfterCutoffText: string;
  lowStockText: string;
  badgeText: string;
  discountCode: string;
  placements: string[];
  design: CampaignDesignValues;
  timer: TimerSettingsInput | null;
  deliveryCutoff: DeliveryPromiseSettings | null;
  freeShipping: FreeShippingViewModel | null;
  lowStock: LowStockViewModel | null;
  badge: BadgeViewModel | null;
};

export type FreeShippingViewModel = {
  thresholdAmount: number;
  currencyCode: string;
  includeDiscountedSubtotal: boolean;
  emptyCartMessage: string;
  successMessage: string;
  progressStyle: string;
};

export type LowStockViewModel = {
  threshold: number;
  showExactQuantity: boolean;
  fallbackMessage: string;
};

export type BadgeViewModel = {
  badgeText: string;
  badgeShape: BadgeShapeValue;
  badgePosition: BadgePositionValue;
};

export function buildCampaignViewModel(
  campaign: CampaignViewModelInput,
): CampaignViewModel {
  const translation =
    campaign.translations.find((item) => item.locale === "en") ??
    campaign.translations[0];

  const baseDesign = { ...(campaign.design ?? {}) };
  delete baseDesign.mobileDesign;

  const design: CampaignDesignValues = {
    ...defaultCampaignDesignValues,
    ...baseDesign,
    customCss: campaign.design?.customCss ?? "",
  };

  return {
    name: campaign.name,
    type: campaign.type,
    timezone: campaign.timezone || "UTC",
    headline: getCampaignText(campaign, "en", "headline") || campaign.name,
    subheadline: getCampaignText(campaign, "en", "subheadline"),
    ctaText: getCampaignText(campaign, "en", "ctaText") || "Shop now",
    ctaUrl: translation?.ctaUrl || "#",
    expiredText: getCampaignText(campaign, "en", "expiredText"),
    freeShippingEmptyText: getCampaignText(
      campaign,
      "en",
      "freeShippingEmptyText",
    ),
    freeShippingProgressText: getCampaignText(
      campaign,
      "en",
      "freeShippingProgressText",
    ),
    freeShippingSuccessText: getCampaignText(
      campaign,
      "en",
      "freeShippingSuccessText",
    ),
    deliveryBeforeCutoffText: getCampaignText(
      campaign,
      "en",
      "deliveryBeforeCutoffText",
    ),
    deliveryAfterCutoffText: getCampaignText(
      campaign,
      "en",
      "deliveryAfterCutoffText",
    ),
    lowStockText: getCampaignText(campaign, "en", "lowStockText"),
    badgeText:
      campaign.badgeSettings?.badgeText ||
      getCampaignText(campaign, "en", "badgeText") ||
      getCampaignText(campaign, "en", "headline") ||
      campaign.name,
    discountCode:
      campaign.discountSync?.showCodeOnStorefront === false
        ? ""
        : (campaign.discountSync?.discountCode ?? ""),
    placements: campaign.placements
      .filter((placement) => placement.enabled)
      .map((placement) => placement.placementType),
    design,
    timer: buildTimerViewModel(campaign),
    deliveryCutoff: buildDeliveryCutoffViewModel(campaign),
    freeShipping: buildFreeShippingViewModel(campaign),
    lowStock: buildLowStockViewModel(campaign),
    badge: buildBadgeViewModel(campaign),
  };
}

function buildTimerViewModel(
  campaign: CampaignViewModelInput,
): TimerSettingsInput | null {
  const timerMode = toTimerMode(campaign.timerSettings?.mode);
  const endsAt = toIsoDate(campaign.endsAt);

  if (!timerMode && !endsAt) return null;

  return {
    mode: timerMode ?? "FIXED_DATE",
    endsAt,
    durationMinutes: campaign.timerSettings?.durationMinutes ?? null,
    recurringDays: campaign.timerSettings?.recurringDays ?? [],
    resetBehavior: toTimerResetBehavior(campaign.timerSettings?.resetBehavior),
    expiredBehavior: toTimerExpiredBehavior(
      campaign.timerSettings?.expiredBehavior,
    ),
  };
}

function buildFreeShippingViewModel(
  campaign: CampaignViewModelInput,
): FreeShippingViewModel | null {
  const settings = campaign.freeShippingSettings;

  if (!settings) return null;

  return {
    thresholdAmount: toNumber(settings.thresholdAmount),
    currencyCode: settings.currencyCode || "USD",
    includeDiscountedSubtotal:
      settings.includeDiscountedSubtotal === false ? false : true,
    emptyCartMessage: settings.emptyCartMessage ?? "",
    successMessage: settings.successMessage ?? "",
    progressStyle: settings.progressStyle ?? "BAR",
  };
}

function buildDeliveryCutoffViewModel(
  campaign: CampaignViewModelInput,
): DeliveryPromiseSettings | null {
  const settings = campaign.deliveryCutoffSettings;

  if (!settings) return null;

  return {
    afterCutoffBehavior: toAfterCutoffBehavior(settings.afterCutoffBehavior),
    cutoffHour: settings.cutoffHour,
    cutoffMinute: settings.cutoffMinute ?? 0,
    countryRules: settings.countryRules ?? {},
    holidays: settings.holidays ?? [],
    maxDeliveryDays: settings.maxDeliveryDays,
    minDeliveryDays: settings.minDeliveryDays,
    processingDays: settings.processingDays ?? 0,
    timezone: campaign.timezone || "UTC",
    workingDays: settings.workingDays ?? [1, 2, 3, 4, 5],
  };
}

function buildLowStockViewModel(
  campaign: CampaignViewModelInput,
): LowStockViewModel | null {
  const settings = campaign.lowStockSettings;

  if (!settings) return null;

  return {
    threshold: settings.threshold,
    showExactQuantity: settings.showExactQuantity,
    fallbackMessage: settings.fallbackMessage ?? "",
  };
}

function buildBadgeViewModel(
  campaign: CampaignViewModelInput,
): BadgeViewModel | null {
  const settings = campaign.badgeSettings;

  if (!settings) return null;

  return {
    badgeText:
      settings.badgeText ||
      getCampaignText(campaign, "en", "badgeText") ||
      campaign.name,
    badgeShape: toBadgeShape(settings.badgeShape),
    badgePosition: toBadgePosition(settings.badgePosition),
  };
}

function toNumber(value: { toString(): string } | string | number) {
  const number = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(number) ? number : 0;
}

function toTimerMode(value: string | null | undefined): TimerMode | null {
  if (
    value === "FIXED_DATE" ||
    value === "EVERGREEN_SESSION" ||
    value === "RECURRING_DAILY" ||
    value === "RECURRING_WEEKLY"
  ) {
    return value;
  }

  return null;
}

function toTimerResetBehavior(
  value: string | null | undefined,
): TimerResetBehavior {
  if (value === "ON_SESSION_END" || value === "DAILY" || value === "WEEKLY") {
    return value;
  }

  return "NEVER";
}

function toTimerExpiredBehavior(
  value: string | null | undefined,
): TimerExpiredBehavior {
  if (
    value === "HIDE_TIMER" ||
    value === "REPEAT_COUNTDOWN" ||
    value === "SHOW_CUSTOM_TITLE" ||
    value === "DO_NOTHING"
  ) {
    return value;
  }

  return "UNPUBLISH_TIMER";
}

function toAfterCutoffBehavior(
  value: string | null | undefined,
): AfterCutoffBehavior {
  if (
    value === "SHOW_NEXT_WINDOW" ||
    value === "SHOW_AFTER_CUTOFF_MESSAGE" ||
    value === "HIDE"
  ) {
    return value;
  }

  return "SHOW_NEXT_WINDOW";
}

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
