import { validateActivationCandidate } from "./campaign-rules";
import {
  campaignGoalOptions,
  campaignEditableStatusOptions,
  campaignStatusOptions,
  campaignTypeOptions,
  getDefaultPlacementForCampaignType,
  placementTypeOptions,
  type CampaignGoalValue,
  type CampaignTypeValue,
  type EditableCampaignStatusValue,
  type PlacementTypeValue,
} from "../types/campaign-options";
import {
  countrySelectionOptions,
  productSelectionOptions,
  splitCampaignList,
  defaultCampaignFormValues,
  type CampaignTimerExpiredBehaviorValue,
  type CampaignTimerModeValue,
  type CampaignTimerResetBehaviorValue,
  type CampaignFormErrors,
  type CampaignFormValues,
  type CountrySelectionValue,
  type ProductSelectionValue,
} from "../types/campaign-form";
import { freeShippingProgressStyleOptions } from "../types/free-shipping";

export type ParsedCampaignForm = {
  values: CampaignFormValues;
  errors: CampaignFormErrors;
  startsAt: Date | null;
  endsAt: Date | null;
};

const campaignGoals = new Set(
  campaignGoalOptions.map((option) => option.value),
);
const campaignTypes = new Set(
  campaignTypeOptions.map((option) => option.value),
);
const campaignCreateStatuses = new Set(
  campaignStatusOptions.map((option) => option.value),
);
const campaignEditableStatuses = new Set(
  campaignEditableStatusOptions.map((option) => option.value),
);
const placementTypes = new Set(
  placementTypeOptions.map((option) => option.value),
);
const productSelections = new Set<string>(productSelectionOptions);
const countrySelections = new Set<string>(countrySelectionOptions);
const timerModes = new Set<string>([
  "FIXED_DATE",
  "EVERGREEN_SESSION",
  "RECURRING_DAILY",
]);
const timerResetBehaviors = new Set<string>([
  "NEVER",
  "ON_SESSION_END",
  "DAILY",
  "WEEKLY",
]);
const timerExpiredBehaviors = new Set<string>([
  "UNPUBLISH_TIMER",
  "HIDE_TIMER",
  "REPEAT_COUNTDOWN",
  "SHOW_CUSTOM_TITLE",
  "DO_NOTHING",
]);
const freeShippingProgressStyles = new Set<string>(
  freeShippingProgressStyleOptions.map((option) => option.value),
);

export function parseCampaignFormData(
  formData: FormData,
  options: { allowInactiveStatuses?: boolean } = {},
): ParsedCampaignForm {
  const type = readOption(
    formData,
    "type",
    campaignTypes,
    defaultCampaignFormValues.type,
  ) as CampaignTypeValue;
  const productSelection = readOption(
    formData,
    "productSelection",
    productSelections,
    defaultCampaignFormValues.productSelection,
  ) as ProductSelectionValue;
  const placementTypesValue = readPlacementTypes(formData, type);
  const placementType = placementTypesValue[0];

  const values: CampaignFormValues = {
    goal: readOption(
      formData,
      "goal",
      campaignGoals,
      defaultCampaignFormValues.goal,
    ) as CampaignGoalValue,
    type,
    name: readString(formData, "name"),
    startsAt: readString(formData, "startsAt"),
    endsAt: readString(formData, "endsAt"),
    timezone: readString(formData, "timezone") || "UTC",
    status: readOption(
      formData,
      "status",
      options.allowInactiveStatuses
        ? campaignEditableStatuses
        : campaignCreateStatuses,
      defaultCampaignFormValues.status,
    ) as EditableCampaignStatusValue,
    placementType,
    placementTypes: placementTypesValue,
    headline: readString(formData, "headline"),
    subheadline: readString(formData, "subheadline"),
    ctaText: readString(formData, "ctaText"),
    ctaUrl: readString(formData, "ctaUrl"),
    expiredText: readString(formData, "expiredText"),
    timerMode: readOption(
      formData,
      "timerMode",
      timerModes,
      defaultCampaignFormValues.timerMode,
    ) as CampaignTimerModeValue,
    timerDurationMinutes:
      readString(formData, "timerDurationMinutes") ||
      defaultCampaignFormValues.timerDurationMinutes,
    timerResetBehavior: readOption(
      formData,
      "timerResetBehavior",
      timerResetBehaviors,
      defaultCampaignFormValues.timerResetBehavior,
    ) as CampaignTimerResetBehaviorValue,
    timerExpiredBehavior: readOption(
      formData,
      "timerExpiredBehavior",
      timerExpiredBehaviors,
      defaultCampaignFormValues.timerExpiredBehavior,
    ) as CampaignTimerExpiredBehaviorValue,
    timerRecurringHour:
      readString(formData, "timerRecurringHour") ||
      defaultCampaignFormValues.timerRecurringHour,
    timerRecurringMinute:
      readString(formData, "timerRecurringMinute") ||
      defaultCampaignFormValues.timerRecurringMinute,
    productSelection,
    productIds: readString(formData, "productIds"),
    excludeProductIds: readString(formData, "excludeProductIds"),
    collectionIds: readString(formData, "collectionIds"),
    productTags: readString(formData, "productTags"),
    customSelector: readString(formData, "customSelector"),
    countrySelection: readOption(
      formData,
      "countrySelection",
      countrySelections,
      defaultCampaignFormValues.countrySelection,
    ) as CountrySelectionValue,
    countries: readString(formData, "countries"),
    freeShippingThresholdAmount:
      readString(formData, "freeShippingThresholdAmount") ||
      defaultCampaignFormValues.freeShippingThresholdAmount,
    freeShippingCurrencyCode:
      readString(formData, "freeShippingCurrencyCode").toUpperCase() ||
      defaultCampaignFormValues.freeShippingCurrencyCode,
    freeShippingIncludeDiscountedSubtotal: readBoolean(
      formData,
      "freeShippingIncludeDiscountedSubtotal",
    ),
    freeShippingProgressStyle: readOption(
      formData,
      "freeShippingProgressStyle",
      freeShippingProgressStyles,
      defaultCampaignFormValues.freeShippingProgressStyle,
    ) as CampaignFormValues["freeShippingProgressStyle"],
    freeShippingEmptyCartMessage:
      readString(formData, "freeShippingEmptyCartMessage") ||
      defaultCampaignFormValues.freeShippingEmptyCartMessage,
    freeShippingSuccessMessage:
      readString(formData, "freeShippingSuccessMessage") ||
      defaultCampaignFormValues.freeShippingSuccessMessage,
    freeShippingAutoDiscount: readBoolean(
      formData,
      "freeShippingAutoDiscount",
    ),
    freeShippingDiscountCode:
      readString(formData, "freeShippingDiscountCode").toUpperCase() ||
      defaultCampaignFormValues.freeShippingDiscountCode,
    freeShippingDiscountTitle:
      readString(formData, "freeShippingDiscountTitle") ||
      defaultCampaignFormValues.freeShippingDiscountTitle,
    freeShippingDiscountAppliesOncePerCustomer: readBoolean(
      formData,
      "freeShippingDiscountAppliesOncePerCustomer",
    ),
  };

  const errors: CampaignFormErrors = {};
  const startsAt = parseOptionalDate(values.startsAt, "startsAt", errors);
  const endsAt = parseOptionalDate(values.endsAt, "endsAt", errors);

  if (values.name.trim().length === 0) {
    errors.name = "Campaign name is required.";
  }

  if (values.timezone.trim().length === 0) {
    errors.timezone = "Timezone is required.";
  }

  if (startsAt && endsAt && startsAt > endsAt) {
    errors.endsAt = "End date must be after start date.";
  }

  if (values.ctaUrl && !isValidCtaUrl(values.ctaUrl)) {
    errors.ctaUrl = "CTA URL must be a valid absolute URL or storefront path.";
  }

  if (
    values.timerMode === "EVERGREEN_SESSION" &&
    !isIntegerInRange(values.timerDurationMinutes, 1, 10080)
  ) {
    errors.timerDurationMinutes = "Enter minutes between 1 and 10080.";
  }

  if (
    values.timerMode === "RECURRING_DAILY" &&
    (!isIntegerInRange(values.timerRecurringHour, 0, 23) ||
      !isIntegerInRange(values.timerRecurringMinute, 0, 59))
  ) {
    errors.timerRecurringHour = "Enter a valid recurring time.";
  }

  if (
    values.timerExpiredBehavior === "SHOW_CUSTOM_TITLE" &&
    values.expiredText.trim().length === 0
  ) {
    errors.expiredText = "Add the title shown after the timer ends.";
  }

  if (
    values.productSelection === "SPECIFIC_PRODUCTS" &&
    splitCampaignList(values.productIds).length === 0
  ) {
    errors.productIds = "Add at least one product ID.";
  }

  if (
    values.productSelection === "COLLECTIONS" &&
    splitCampaignList(values.collectionIds).length === 0
  ) {
    errors.collectionIds = "Add at least one collection ID.";
  }

  if (
    values.productSelection === "TAGS" &&
    splitCampaignList(values.productTags).length === 0
  ) {
    errors.productTags = "Add at least one product tag.";
  }

  if (
    values.countrySelection === "SPECIFIC_COUNTRIES" &&
    splitCampaignList(values.countries).length === 0
  ) {
    errors.countries = "Add at least one country code.";
  }

  if (
    values.placementTypes.includes("CUSTOM_SELECTOR") &&
    values.customSelector.length > 120
  ) {
    errors.customSelector = "Keep the selector under 120 characters.";
  }

  if (values.type === "FREE_SHIPPING_GOAL" || values.goal === "FREE_SHIPPING") {
    const freeShippingThreshold = Number(values.freeShippingThresholdAmount);

    if (
      !Number.isFinite(freeShippingThreshold) ||
      freeShippingThreshold <= 0
    ) {
      errors.freeShippingThresholdAmount =
        "Enter a free shipping threshold greater than 0.";
    }

    if (!/^[A-Z]{3}$/.test(values.freeShippingCurrencyCode)) {
      errors.freeShippingCurrencyCode =
        "Currency code must use a 3-letter ISO code.";
    }

    if (values.freeShippingEmptyCartMessage.length > 500) {
      errors.freeShippingEmptyCartMessage =
        "Keep the empty cart message under 500 characters.";
    }

    if (values.freeShippingSuccessMessage.length > 500) {
      errors.freeShippingSuccessMessage =
        "Keep the success message under 500 characters.";
    }

    if (values.freeShippingAutoDiscount) {
      if (!/^[A-Z0-9_-]{3,40}$/.test(values.freeShippingDiscountCode)) {
        errors.freeShippingDiscountCode =
          "Use 3-40 characters: letters, numbers, dashes, or underscores.";
      }

      if (!values.freeShippingDiscountTitle.trim()) {
        errors.freeShippingDiscountTitle =
          "Add a Shopify discount title.";
      }
    }
  }

  if (values.status === "ACTIVE") {
    for (const error of validateActivationCandidate({
      placements: values.placementTypes.map(() => ({ enabled: true })),
      translations: [{ headline: values.headline }],
    })) {
      if (error.includes("headline")) {
        errors.headline = error;
      } else {
        errors.placementType = error;
      }
    }
  }

  return {
    values,
    errors,
    startsAt,
    endsAt,
  };
}

export function hasCampaignFormErrors(errors: CampaignFormErrors) {
  return Object.keys(errors).length > 0;
}

function readString(formData: FormData, key: keyof CampaignFormValues) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(formData: FormData, key: keyof CampaignFormValues) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readOption(
  formData: FormData,
  key: keyof CampaignFormValues,
  allowedValues: Set<string>,
  fallback: string,
) {
  const value = readString(formData, key);
  return allowedValues.has(value) ? value : fallback;
}

function readPlacementTypes(
  formData: FormData,
  type: CampaignTypeValue,
): PlacementTypeValue[] {
  const values = formData
    .getAll("placementTypes")
    .filter((value): value is string => typeof value === "string")
    .filter(isPlacementTypeValue);

  const rawLegacyPlacement = formData.get("placementType");
  const legacyPlacement =
    typeof rawLegacyPlacement === "string" &&
    isPlacementTypeValue(rawLegacyPlacement)
      ? rawLegacyPlacement
      : null;

  if (values.length > 0) {
    const uniqueValues = Array.from(new Set(values));

    return legacyPlacement && legacyPlacement !== uniqueValues[0]
      ? [legacyPlacement]
      : uniqueValues;
  }

  const productSelection = readOption(
    formData,
    "productSelection",
    productSelections,
    defaultCampaignFormValues.productSelection,
  );

  if (productSelection === "CUSTOM_POSITION") return ["CUSTOM_SELECTOR"];

  return [legacyPlacement ?? getDefaultPlacementForCampaignType(type)];
}

function isPlacementTypeValue(value: string): value is PlacementTypeValue {
  return placementTypes.has(value as PlacementTypeValue);
}

function parseOptionalDate(
  value: string,
  key: keyof CampaignFormValues,
  errors: CampaignFormErrors,
) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    errors[key] = "Enter a valid date and time.";
    return null;
  }

  return date;
}

function isValidCtaUrl(value: string) {
  if (value.startsWith("/")) return true;

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isIntegerInRange(value: string, min: number, max: number) {
  const number = Number(value);

  return Number.isInteger(number) && number >= min && number <= max;
}
