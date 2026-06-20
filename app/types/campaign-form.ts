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
  countrySelection: CountrySelectionValue;
  countries: string;
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
  countrySelection: "ALL_WORLD",
  countries: "",
};

export function buildCampaignTimerSettingsValues(values: CampaignFormValues) {
  const mode = values.timerMode;
  const durationMinutes =
    mode === "EVERGREEN_SESSION"
      ? clampInteger(Number(values.timerDurationMinutes), 1, 10080, 120)
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
        : values.timerResetBehavior,
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

  return targeting;
}

export function splitCampaignList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
