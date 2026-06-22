import type {
  CampaignGoalValue,
  CampaignTypeValue,
  EditableCampaignStatusValue,
  PlacementTypeValue,
} from "./campaign-options";
import {
  createEmptyTargetingRules,
  type CampaignTargetingRules,
} from "./campaign";
import {
  badgePositionOptions,
  badgeShapeOptions,
  defaultBadgeSettingsValues,
  type BadgePositionValue,
  type BadgeShapeValue,
} from "./badge";
import {
  defaultDeliveryCutoffSettingsValues,
  type AfterCutoffBehaviorValue,
} from "./delivery-cutoff";
import {
  defaultFreeShippingSettingsValues,
  type FreeShippingProgressStyleValue,
} from "./free-shipping";
import { defaultLowStockSettingsValues } from "./low-stock";

export const productSelectionOptions = [
  "ALL_PRODUCTS",
  "SPECIFIC_PRODUCTS",
  "COLLECTIONS",
  "TAGS",
  "CUSTOM_POSITION",
] as const;

export const countrySelectionOptions = [
  "ALL_WORLD",
  "SPECIFIC_COUNTRIES",
] as const;

export type ProductSelectionValue = (typeof productSelectionOptions)[number];
export type CountrySelectionValue = (typeof countrySelectionOptions)[number];
export type CampaignTimerModeValue =
  | "FIXED_DATE"
  | "EVERGREEN_SESSION"
  | "RECURRING_DAILY";
export type CampaignTimerResetBehaviorValue =
  | "NEVER"
  | "ON_SESSION_END"
  | "DAILY"
  | "WEEKLY";
export type CampaignTimerExpiredBehaviorValue =
  | "UNPUBLISH_TIMER"
  | "HIDE_TIMER"
  | "REPEAT_COUNTDOWN"
  | "SHOW_CUSTOM_TITLE"
  | "DO_NOTHING";

export type CampaignCountryOption = {
  code: string;
  name: string;
};

export type CampaignTargetingOptions = {
  countries: CampaignCountryOption[];
  productTags: string[];
};

export type CampaignFormValues = {
  goal: CampaignGoalValue;
  type: CampaignTypeValue;
  name: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: EditableCampaignStatusValue;
  placementType: PlacementTypeValue;
  placementTypes: PlacementTypeValue[];
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  expiredText: string;
  timerMode: CampaignTimerModeValue;
  timerDurationMinutes: string;
  timerResetBehavior: CampaignTimerResetBehaviorValue;
  timerExpiredBehavior: CampaignTimerExpiredBehaviorValue;
  timerRecurringHour: string;
  timerRecurringMinute: string;
  productSelection: ProductSelectionValue;
  productIds: string;
  excludeProductIds: string;
  collectionIds: string;
  productTags: string;
  customSelector: string;
  urlContains?: string;
  excludedUrlContains?: string;
  countrySelection: CountrySelectionValue;
  countries: string;
  freeShippingThresholdAmount: string;
  freeShippingCurrencyCode: string;
  freeShippingIncludeDiscountedSubtotal: boolean;
  freeShippingProgressStyle: FreeShippingProgressStyleValue;
  freeShippingEmptyCartMessage: string;
  freeShippingSuccessMessage: string;
  freeShippingAutoDiscount: boolean;
  freeShippingExistingDiscount: string;
  freeShippingDiscountCode: string;
  freeShippingDiscountTitle: string;
  freeShippingDiscountAppliesOncePerCustomer: boolean;
  freeShippingShowDiscountCode: boolean;
  cartTimerDurationMinutes: string;
  cartTimerResetBehavior: CampaignTimerResetBehaviorValue;
  deliveryCutoffHour: string;
  deliveryCutoffMinute: string;
  deliveryProcessingDays: string;
  deliveryMinDays: string;
  deliveryMaxDays: string;
  deliveryWorkingDays: string;
  deliveryAfterCutoffBehavior: AfterCutoffBehaviorValue;
  lowStockThreshold: string;
  lowStockShowExactQuantity: boolean;
  lowStockFallbackMessage: string;
  badgeText: string;
  badgeShape: BadgeShapeValue;
  badgePosition: BadgePositionValue;
};

export type CampaignFormErrors = Partial<
  Record<keyof CampaignFormValues, string>
> & {
  form?: string;
};

export const defaultCampaignFormValues: CampaignFormValues = {
  goal: "FLASH_SALE",
  type: "COUNTDOWN_BAR",
  name: "",
  startsAt: "",
  endsAt: "",
  timezone: "UTC",
  status: "DRAFT",
  placementType: "TOP_BAR",
  placementTypes: ["TOP_BAR"],
  headline: "",
  subheadline: "",
  ctaText: "",
  ctaUrl: "",
  expiredText: "This offer has ended.",
  timerMode: "FIXED_DATE",
  timerDurationMinutes: "120",
  timerResetBehavior: "ON_SESSION_END",
  timerExpiredBehavior: "UNPUBLISH_TIMER",
  timerRecurringHour: "23",
  timerRecurringMinute: "59",
  productSelection: "ALL_PRODUCTS",
  productIds: "",
  excludeProductIds: "",
  collectionIds: "",
  productTags: "",
  customSelector: "",
  urlContains: "",
  excludedUrlContains: "",
  countrySelection: "ALL_WORLD",
  countries: "",
  freeShippingThresholdAmount:
    defaultFreeShippingSettingsValues.thresholdAmount,
  freeShippingCurrencyCode: defaultFreeShippingSettingsValues.currencyCode,
  freeShippingIncludeDiscountedSubtotal:
    defaultFreeShippingSettingsValues.includeDiscountedSubtotal,
  freeShippingProgressStyle: defaultFreeShippingSettingsValues.progressStyle,
  freeShippingEmptyCartMessage:
    defaultFreeShippingSettingsValues.emptyCartMessage,
  freeShippingSuccessMessage: defaultFreeShippingSettingsValues.successMessage,
  freeShippingAutoDiscount: false,
  freeShippingExistingDiscount: "",
  freeShippingDiscountCode: "",
  freeShippingDiscountTitle: "Promo Pulse free shipping",
  freeShippingDiscountAppliesOncePerCustomer: false,
  freeShippingShowDiscountCode: false,
  cartTimerDurationMinutes: "120",
  cartTimerResetBehavior: "ON_SESSION_END",
  deliveryCutoffHour: defaultDeliveryCutoffSettingsValues.cutoffHour,
  deliveryCutoffMinute: defaultDeliveryCutoffSettingsValues.cutoffMinute,
  deliveryProcessingDays: defaultDeliveryCutoffSettingsValues.processingDays,
  deliveryMinDays: defaultDeliveryCutoffSettingsValues.minDeliveryDays,
  deliveryMaxDays: defaultDeliveryCutoffSettingsValues.maxDeliveryDays,
  deliveryWorkingDays: "1,2,3,4,5",
  deliveryAfterCutoffBehavior:
    defaultDeliveryCutoffSettingsValues.afterCutoffBehavior,
  lowStockThreshold: defaultLowStockSettingsValues.threshold,
  lowStockShowExactQuantity: defaultLowStockSettingsValues.showExactQuantity,
  lowStockFallbackMessage: defaultLowStockSettingsValues.fallbackMessage,
  badgeText: defaultBadgeSettingsValues.badgeText,
  badgeShape: defaultBadgeSettingsValues.badgeShape,
  badgePosition: defaultBadgeSettingsValues.badgePosition,
};

export function buildCampaignTimerSettingsValues(values: CampaignFormValues) {
  const mode = values.timerMode;
  const durationSource =
    values.type === "CART_TIMER" || values.goal === "CART_RESCUE"
      ? values.cartTimerDurationMinutes
      : values.timerDurationMinutes;
  const resetBehaviorSource =
    values.type === "CART_TIMER" || values.goal === "CART_RESCUE"
      ? values.cartTimerResetBehavior
      : values.timerResetBehavior;
  const durationMinutes =
    mode === "EVERGREEN_SESSION"
      ? clampInteger(Number(durationSource), 1, 10080, 120)
      : null;
  const recurringHour = clampInteger(
    Number(values.timerRecurringHour),
    0,
    23,
    23,
  );
  const recurringMinute = clampInteger(
    Number(values.timerRecurringMinute),
    0,
    59,
    59,
  );

  return {
    mode,
    durationMinutes,
    recurringDays:
      mode === "RECURRING_DAILY"
        ? [{ cutoffHour: recurringHour, cutoffMinute: recurringMinute }]
        : [],
    resetBehavior:
      values.timerExpiredBehavior === "REPEAT_COUNTDOWN"
        ? "ON_SESSION_END"
        : resetBehaviorSource,
    expiredBehavior: values.timerExpiredBehavior,
  };
}

function clampInteger(
  value: number,
  min: number,
  max: number,
  fallback: number,
) {
  if (!Number.isFinite(value)) return fallback;

  return Math.min(max, Math.max(min, Math.round(value)));
}

export const emptyCampaignTargetingOptions: CampaignTargetingOptions = {
  countries: [],
  productTags: [],
};

export function buildCampaignTargetingValues(
  values: CampaignFormValues,
): CampaignTargetingRules {
  const targeting = createEmptyTargetingRules();

  if (values.productSelection === "SPECIFIC_PRODUCTS") {
    targeting.productIds = splitCampaignList(values.productIds);
  }

  if (values.productSelection === "COLLECTIONS") {
    targeting.collectionIds = splitCampaignList(values.collectionIds);
  }

  if (values.productSelection === "TAGS") {
    targeting.productTags = splitCampaignList(values.productTags);
  }

  if (values.productSelection === "ALL_PRODUCTS") {
    targeting.excludeProductIds = splitCampaignList(values.excludeProductIds);
  }

  if (values.countrySelection === "SPECIFIC_COUNTRIES") {
    targeting.countries = splitCampaignList(values.countries).map((country) =>
      country.toUpperCase(),
    );
  }

  targeting.urlContains = splitCampaignList(values.urlContains ?? "");
  targeting.excludedUrlContains = splitCampaignList(
    values.excludedUrlContains ?? "",
  );

  return targeting;
}

export function buildCampaignFreeShippingSettingsValues(
  values: CampaignFormValues,
) {
  return {
    thresholdAmount:
      values.freeShippingThresholdAmount ||
      defaultFreeShippingSettingsValues.thresholdAmount,
    currencyCode:
      values.freeShippingCurrencyCode ||
      defaultFreeShippingSettingsValues.currencyCode,
    includeDiscountedSubtotal: values.freeShippingIncludeDiscountedSubtotal,
    emptyCartMessage:
      values.freeShippingEmptyCartMessage ||
      defaultFreeShippingSettingsValues.emptyCartMessage,
    successMessage:
      values.freeShippingSuccessMessage ||
      defaultFreeShippingSettingsValues.successMessage,
    progressStyle:
      values.freeShippingProgressStyle ||
      defaultFreeShippingSettingsValues.progressStyle,
    thresholdRulesJson: "",
  };
}

export function buildCampaignDeliveryCutoffSettingsValues(
  values: CampaignFormValues,
) {
  const minDeliveryDays = clampInteger(
    Number(values.deliveryMinDays),
    0,
    60,
    2,
  );
  const maxDeliveryDays = clampInteger(
    Number(values.deliveryMaxDays),
    minDeliveryDays,
    90,
    Math.max(minDeliveryDays, 5),
  );

  return {
    cutoffHour: clampInteger(Number(values.deliveryCutoffHour), 0, 23, 14),
    cutoffMinute: clampInteger(Number(values.deliveryCutoffMinute), 0, 59, 0),
    processingDays: clampInteger(
      Number(values.deliveryProcessingDays),
      0,
      60,
      0,
    ),
    minDeliveryDays,
    maxDeliveryDays,
    workingDays: parseDeliveryWorkingDays(values.deliveryWorkingDays),
    holidays: [],
    countryRules: {},
    afterCutoffBehavior: values.deliveryAfterCutoffBehavior,
  };
}

export function buildCampaignLowStockSettingsValues(
  values: CampaignFormValues,
) {
  return {
    threshold: clampInteger(Number(values.lowStockThreshold), 1, 9999, 5),
    showExactQuantity: values.lowStockShowExactQuantity,
    fallbackMessage:
      values.lowStockFallbackMessage ||
      defaultLowStockSettingsValues.fallbackMessage,
  };
}

export function buildCampaignBadgeSettingsValues(values: CampaignFormValues) {
  return {
    badgeText: values.badgeText || defaultBadgeSettingsValues.badgeText,
    badgeShape: badgeShapeOptions.some(
      (option) => option.value === values.badgeShape,
    )
      ? values.badgeShape
      : defaultBadgeSettingsValues.badgeShape,
    badgePosition: badgePositionOptions.some(
      (option) => option.value === values.badgePosition,
    )
      ? values.badgePosition
      : defaultBadgeSettingsValues.badgePosition,
  };
}

export function parseDeliveryWorkingDays(value: string) {
  const days = value
    .split(/[\s,]+/)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7);

  return Array.from(new Set(days)).sort((a, b) => a - b);
}

export function splitCampaignList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
