import type {} from "react-router";
import {
  AdvancedDiscountRuleStatus,
  AdvancedDiscountRuleType,
  EmailTimerExpiredBehavior,
  ExperimentPrimaryMetric,
  ExperimentVariantStatus,
  Prisma,
} from "@prisma/client";

import {
  type AdvancedDiscountRuleErrors,
  } from "../components/AdvancedDiscountRulesEditor";
import {
  type BehaviorTargetingErrors,
} from "../components/BehaviorTargetingEditor";
import {
  type EmailTimerErrors,
  } from "../components/EmailTimerEditor";
import {
  type MarketRuleErrors,
  } from "../components/CampaignMarketsEditor";
import {
  type ExperimentErrors,
  } from "../components/ExperimentsEditor";
import { authenticateAdmin } from "../services/admin-auth.server";
import {
  loadCampaignDesignMediaOptions,
} from "../services/campaign-design-media.server";
import { loadCampaignTargetingOptions } from "../services/campaign-targeting-options.server";
import {
  type AdvancedDiscountRuleInput,
} from "../services/discounts/advancedDiscounts.server";
import {
  type ExperimentVariantInput,
} from "../services/experiments";
import {
  type EmailTimerDesignInput,
  type EmailTimerFontFamily,
} from "../services/email-timers/emailTimers.server";
import {
  type MarketRuleInput,
  } from "../services/markets/markets.server";
import {
  behaviorTargetingBounds,
  defaultBehaviorTargetingRules,
  normalizeBehaviorTargetingRules,
  type BehaviorTargetingRules,
} from "../types/behavior-targeting";
import type {
  } from "../types/campaign-design";
import {
  emptyCampaignDesignMediaOptions,
} from "../types/campaign-design";
import {
  } from "../types/campaign-options";
import {
  emptyCampaignTargetingOptions,
  type CampaignFormValues,
  } from "../types/campaign-form";
import {
  defaultCartRescueSettingsValues,
  isSupportedCartRescueReason,
  isSupportedCartRescueTimerStart,
} from "../types/cart-rescue";
import type {
  } from "../types/localization";

export function shouldClearDiscountSyncForCampaignType(values: CampaignFormValues) {
  return (
    values.goal === "CART_RESCUE" ||
    values.goal === "ANNOUNCEMENT" ||
    values.goal === "DELIVERY_CUTOFF" ||
    values.goal === "LOW_STOCK_URGENCY" ||
    values.goal === "PRODUCT_BADGE" ||
    values.type === "DELIVERY_CUTOFF" ||
    values.type === "LOW_STOCK" ||
    values.type === "PRODUCT_BADGE"
  );
}

export function toDateTimeLocalValue(date: Date | string | null) {
  if (!date) return "";
  const parsedDate = typeof date === "string" ? new Date(date) : date;

  if (Number.isNaN(parsedDate.getTime())) return "";

  const localDate = new Date(
    parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000,
  );

  return localDate.toISOString().slice(0, 16);
}

export function toCampaignTimerFormValues(
  timerSettings: {
    durationMinutes?: number | null;
    expiredBehavior?: string | null;
    mode?: string | null;
    recurringDays?: unknown;
    resetBehavior?: string | null;
  } | null,
): Pick<
  CampaignFormValues,
  | "timerDurationMinutes"
  | "timerExpiredBehavior"
  | "timerMode"
  | "timerRecurringHour"
  | "timerRecurringMinute"
  | "timerResetBehavior"
> {
  const recurringCutoff = readRecurringCutoff(timerSettings?.recurringDays);

  return {
    timerMode:
      timerSettings?.mode === "EVERGREEN_SESSION" ||
      timerSettings?.mode === "RECURRING_DAILY"
        ? timerSettings.mode
        : "FIXED_DATE",
    timerDurationMinutes: String(timerSettings?.durationMinutes ?? 120),
    timerResetBehavior:
      timerSettings?.resetBehavior === "NEVER" ||
      timerSettings?.resetBehavior === "DAILY" ||
      timerSettings?.resetBehavior === "WEEKLY"
        ? timerSettings.resetBehavior
        : "ON_SESSION_END",
    timerExpiredBehavior:
      timerSettings?.expiredBehavior === "HIDE_TIMER" ||
      timerSettings?.expiredBehavior === "REPEAT_COUNTDOWN" ||
      timerSettings?.expiredBehavior === "SHOW_CUSTOM_TITLE" ||
      timerSettings?.expiredBehavior === "DO_NOTHING"
        ? timerSettings.expiredBehavior
        : "UNPUBLISH_TIMER",
    timerRecurringHour: String(recurringCutoff.hour),
    timerRecurringMinute: String(recurringCutoff.minute),
  };
}

export function toCampaignCartRescueFormValues(
  settings: {
    rescueReason?: string | null;
    showButton?: boolean | null;
    showTimer?: boolean | null;
    timerStart?: string | null;
    armBeforeStart?: boolean | null;
  } | null,
): Pick<
  CampaignFormValues,
  | "cartRescueReason"
  | "cartRescueShowButton"
  | "cartRescueShowTimer"
  | "cartRescueTimerStart"
  | "cartRescueArmBeforeStart"
> {
  const reason = settings?.rescueReason ?? "";
  const timerStart = settings?.timerStart ?? "";

  return {
    cartRescueReason: isSupportedCartRescueReason(reason)
      ? reason
      : defaultCartRescueSettingsValues.rescueReason,
    cartRescueShowButton:
      settings?.showButton ?? defaultCartRescueSettingsValues.showButton,
    cartRescueShowTimer:
      settings?.showTimer ?? defaultCartRescueSettingsValues.showTimer,
    cartRescueTimerStart: isSupportedCartRescueTimerStart(timerStart)
      ? timerStart
      : defaultCartRescueSettingsValues.timerStart,
    cartRescueArmBeforeStart:
      settings?.armBeforeStart ??
      defaultCartRescueSettingsValues.armBeforeStart,
  };
}

export function readRecurringCutoff(value: unknown) {
  const firstRule = Array.isArray(value) ? value[0] : value;

  if (!firstRule || typeof firstRule !== "object") {
    return { hour: 23, minute: 59 };
  }

  const rule = firstRule as {
    cutoffHour?: unknown;
    cutoffMinute?: unknown;
    hour?: unknown;
    minute?: unknown;
  };
  const hour = Number(rule.cutoffHour ?? rule.hour);
  const minute = Number(rule.cutoffMinute ?? rule.minute);

  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 23,
    minute:
      Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 59,
  };
}

export function parseTotalCodesToGenerate(
  formData: FormData,
): { ok: true; value: number } | { ok: false; error: string } {
  const value = Number(formData.get("totalCodesToGenerate"));

  if (!Number.isInteger(value) || value < 1 || value > 500) {
    return {
      ok: false,
      error: "Generate between 1 and 500 codes at a time.",
    };
  }

  return { ok: true, value };
}

export function parseBehaviorTargetingFormData(formData: FormData): {
  values: BehaviorTargetingRules;
  errors: BehaviorTargetingErrors;
} {
  const errors: BehaviorTargetingErrors = {};
  const d = defaultBehaviorTargetingRules;
  const b = behaviorTargetingBounds;
  const readInt = (
    key: string,
    field: keyof typeof b & keyof BehaviorTargetingErrors,
  ) =>
    readBehaviorInteger(
      formData,
      key,
      d[field] as number,
      b[field].min,
      b[field].max,
      field,
      errors,
    );

  const segments = formData.getAll("behaviorSegments").map(String);

  const rawValues = {
    enabled: isFormCheckboxChecked(formData, "behaviorEnabled"),
    segments,
    lookbackDays: readInt("behaviorLookbackDays", "lookbackDays"),

    returningMinPriorSessions: readInt(
      "behaviorReturningMinPriorSessions",
      "returningMinPriorSessions",
    ),
    returningMinDaysSinceFirstSeen: readInt(
      "behaviorReturningMinDaysSinceFirstSeen",
      "returningMinDaysSinceFirstSeen",
    ),

    viewedProductMinViews: readInt(
      "behaviorViewedProductMinViews",
      "viewedProductMinViews",
    ),
    viewedProductDelayMinutes: readInt(
      "behaviorViewedProductDelayMinutes",
      "viewedProductDelayMinutes",
    ),
    addedToCartDelayMinutes: readInt(
      "behaviorAddedToCartDelayMinutes",
      "addedToCartDelayMinutes",
    ),
    checkoutStartedDelayMinutes: readInt(
      "behaviorCheckoutStartedDelayMinutes",
      "checkoutStartedDelayMinutes",
    ),
    // The checkbox only renders when CHECKOUT_STARTED is selected, so an
    // absent value when the segment is not in play must keep the default
    // rather than be read as an explicit "false".
    checkoutStartedExcludePurchasers: segments.includes("CHECKOUT_STARTED")
      ? isFormCheckboxChecked(
          formData,
          "behaviorCheckoutStartedExcludePurchasers",
        )
      : d.checkoutStartedExcludePurchasers,
    inactiveCartMinutes: readInt(
      "behaviorInactiveCartMinutes",
      "inactiveCartMinutes",
    ),

    sawCampaignIds: parseMultilineIds(formData.get("behaviorSawCampaignIds")),
    clickedCampaignIds: parseMultilineIds(
      formData.get("behaviorClickedCampaignIds"),
    ),
    usedUniqueCodeIncludeAssigned: isFormCheckboxChecked(
      formData,
      "behaviorUsedUniqueCodeIncludeAssigned",
    ),
    highIntentMinEvents: readInt(
      "behaviorHighIntentMinEvents",
      "highIntentMinEvents",
    ),
    highIntentWindowMinutes: readInt(
      "behaviorHighIntentWindowMinutes",
      "highIntentWindowMinutes",
    ),
  };
  const values = normalizeBehaviorTargetingRules(rawValues);

  if (values.enabled && values.segments.length === 0) {
    errors.form =
      "Choose at least one behavior segment or disable behavior targeting.";
  }

  return { values, errors };
}

export function readBehaviorInteger(
  formData: FormData,
  key: string,
  fallback: number,
  min: number,
  max: number,
  field: keyof BehaviorTargetingErrors,
  errors: BehaviorTargetingErrors,
) {
  const rawValue = readFormString(formData, key);
  const parsed = Number(rawValue);

  if (!rawValue) return fallback;

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    errors[field] = `Enter a whole number from ${min} to ${max}.`;
    return fallback;
  }

  return parsed;
}

export function parseEmailTimerFormData(formData: FormData): {
  errors: EmailTimerErrors;
  design: EmailTimerDesignInput;
  expiredBehavior: EmailTimerExpiredBehavior;
} {
  const errors: EmailTimerErrors = {};
  const width = Number(formData.get("emailTimerWidth"));
  const height = Number(formData.get("emailTimerHeight"));
  const cornerRadius = Number(formData.get("emailTimerCornerRadius"));
  const borderWidth = Number(formData.get("emailTimerBorderWidth"));
  const paddingX = Number(formData.get("emailTimerPaddingX"));
  const paddingY = Number(formData.get("emailTimerPaddingY"));
  const presetKey = readEmailTimerPresetKey(
    String(formData.get("emailTimerPresetKey") ?? ""),
  );
  const fontFamily = readEmailTimerFontFamily(
    String(formData.get("emailTimerFontFamily") ?? ""),
  );
  const backgroundColor = readEmailTimerHexColor(
    formData.get("emailTimerBackgroundColor"),
    "#111827",
    "backgroundColor",
    errors,
  );
  const textColor = readEmailTimerHexColor(
    formData.get("emailTimerTextColor"),
    "#FFFFFF",
    "textColor",
    errors,
  );
  const accentColor = readEmailTimerHexColor(
    formData.get("emailTimerAccentColor"),
    "#F97316",
    "accentColor",
    errors,
  );
  const labelColor = readEmailTimerHexColor(
    formData.get("emailTimerLabelColor"),
    "#FDBA74",
    "labelColor",
    errors,
  );
  const borderColor = readEmailTimerHexColor(
    formData.get("emailTimerBorderColor"),
    "#111827",
    "borderColor",
    errors,
  );
  const headingText = String(
    formData.get("emailTimerHeadingText") ?? "ENDS IN",
  ).trim();
  const daysLabel = readEmailTimerLabel(
    formData.get("emailTimerDaysLabel"),
    "Days",
    "daysLabel",
    errors,
  );
  const hoursLabel = readEmailTimerLabel(
    formData.get("emailTimerHoursLabel"),
    "Hrs",
    "hoursLabel",
    errors,
  );
  const minutesLabel = readEmailTimerLabel(
    formData.get("emailTimerMinutesLabel"),
    "Mins",
    "minutesLabel",
    errors,
  );
  const secondsLabel = readEmailTimerLabel(
    formData.get("emailTimerSecondsLabel"),
    "Secs",
    "secondsLabel",
    errors,
  );
  const expiredBehavior = readEmailTimerExpiredBehavior(
    String(formData.get("emailTimerExpiredBehavior") ?? ""),
  );
  const showDays = formData.getAll("emailTimerShowDays").includes("true");
  const showHours = formData.getAll("emailTimerShowHours").includes("true");
  const showMinutes = formData.getAll("emailTimerShowMinutes").includes("true");
  const showSeconds = formData.getAll("emailTimerShowSeconds").includes("true");
  const hasVisibleUnit = showDays || showHours || showMinutes || showSeconds;

  if (!Number.isInteger(width) || width < 240 || width > 1200) {
    errors.width = "Enter a width from 240 to 1200 pixels.";
  }

  if (!Number.isInteger(height) || height < 80 || height > 400) {
    errors.height = "Enter a height from 80 to 400 pixels.";
  }

  if (
    !Number.isInteger(cornerRadius) ||
    cornerRadius < 0 ||
    cornerRadius > 40
  ) {
    errors.cornerRadius = "Enter a corner radius from 0 to 40 pixels.";
  }

  if (!Number.isInteger(borderWidth) || borderWidth < 0 || borderWidth > 16) {
    errors.borderWidth = "Enter a border width from 0 to 16 pixels.";
  }

  if (!Number.isInteger(paddingX) || paddingX < 0 || paddingX > 160) {
    errors.paddingX = "Enter horizontal padding from 0 to 160 pixels.";
  }

  if (!Number.isInteger(paddingY) || paddingY < 0 || paddingY > 120) {
    errors.paddingY = "Enter vertical padding from 0 to 120 pixels.";
  }

  if (!hasVisibleUnit) {
    errors.form = "Show at least one timer unit.";
  }

  if (!fontFamily) {
    errors.form = "Email timer font is invalid.";
  }

  if (headingText.length > 24) {
    errors.headingText = "Heading text can be up to 24 characters.";
  }

  if (!expiredBehavior) {
    errors.form = "Expired behavior is invalid.";
  }

  return {
    errors,
    design: {
      presetKey,
      width: Number.isInteger(width) ? width : 600,
      height: Number.isInteger(height) ? height : 180,
      backgroundColor,
      textColor,
      accentColor,
      labelColor,
      borderColor,
      fontFamily: fontFamily ?? "BLOCK",
      cornerRadius: Number.isInteger(cornerRadius) ? cornerRadius : 0,
      borderWidth: Number.isInteger(borderWidth) ? borderWidth : 0,
      paddingX: Number.isInteger(paddingX) ? paddingX : 34,
      paddingY: Number.isInteger(paddingY) ? paddingY : 24,
      showHeading: formData.getAll("emailTimerShowHeading").includes("true"),
      headingText: headingText || "ENDS IN",
      showLabels: formData.getAll("emailTimerShowLabels").includes("true"),
      showDays: hasVisibleUnit ? showDays : true,
      showHours,
      showMinutes,
      showSeconds,
      daysLabel,
      hoursLabel,
      minutesLabel,
      secondsLabel,
    },
    expiredBehavior: expiredBehavior ?? EmailTimerExpiredBehavior.SHOW_EXPIRED,
  };
}

export function readEmailTimerPresetKey(value: string) {
  return /^[a-z0-9-]{1,40}$/.test(value) ? value : "custom";
}

export function readEmailTimerFontFamily(value: string): EmailTimerFontFamily | null {
  if (
    value === "BLOCK" ||
    value === "DIGITAL" ||
    value === "WIDE" ||
    value === "COMPACT"
  ) {
    return value;
  }

  return null;
}

export function readEmailTimerHexColor(
  value: FormDataEntryValue | null,
  fallback: string,
  field:
    | "backgroundColor"
    | "textColor"
    | "accentColor"
    | "labelColor"
    | "borderColor",
  errors: EmailTimerErrors,
) {
  const candidate = typeof value === "string" ? value.trim() : "";

  if (/^#[0-9a-f]{6}$/i.test(candidate)) {
    return candidate.toUpperCase();
  }

  errors[field] = "Enter a valid hex color.";
  return fallback;
}

export function readEmailTimerLabel(
  value: FormDataEntryValue | null,
  fallback: string,
  field: "daysLabel" | "hoursLabel" | "minutesLabel" | "secondsLabel",
  errors: EmailTimerErrors,
) {
  const candidate = typeof value === "string" ? value.trim() : "";

  if (candidate.length > 10) {
    errors[field] = "Use 10 characters or fewer.";
    return fallback;
  }

  return candidate || fallback;
}

export function readEmailTimerExpiredBehavior(value: string) {
  if (
    value === EmailTimerExpiredBehavior.SHOW_EXPIRED ||
    value === EmailTimerExpiredBehavior.SHOW_ZERO ||
    value === EmailTimerExpiredBehavior.HIDE
  ) {
    return value;
  }

  return null;
}

export async function loadTargetingOptions(
  admin: Awaited<ReturnType<typeof authenticateAdmin>>["admin"],
) {
  try {
    return await loadCampaignTargetingOptions(admin);
  } catch (error) {
    console.error("Failed to load campaign targeting options", error);
    return emptyCampaignTargetingOptions;
  }
}

export async function loadDesignMediaOptions(
  admin: Awaited<ReturnType<typeof authenticateAdmin>>["admin"],
) {
  try {
    return await loadCampaignDesignMediaOptions(admin);
  } catch (error) {
    console.error("Failed to load campaign design media options", error);
    return emptyCampaignDesignMediaOptions;
  }
}

export function parseMarketRuleFormData(formData: FormData): {
  errors: MarketRuleErrors;
  input: MarketRuleInput;
} {
  const errors: MarketRuleErrors = {};
  const marketId = readFormString(formData, "marketRuleMarketId");
  const countryCode = readFormString(
    formData,
    "marketRuleCountryCode",
  ).toUpperCase();
  const locale = normalizeMarketLocale(
    readFormString(formData, "marketRuleLocale"),
  );
  const currencyCode = readFormString(
    formData,
    "marketRuleCurrencyCode",
  ).toUpperCase();
  const thresholdAmount = parseMarketThreshold(
    readFormString(formData, "marketRuleThresholdAmount"),
    errors,
  );
  const deliverySettings = parseMarketJsonObject(
    readFormString(formData, "marketRuleDeliverySettingsJson"),
    "Delivery cutoff JSON must be a JSON object.",
    errors,
  );

  if (!marketId && !countryCode && !locale && !currencyCode) {
    errors.form = "Choose at least one market, country, locale, or currency.";
  }

  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    errors.countryCode = "Country must be a 2-letter ISO code.";
    errors.form = errors.countryCode;
  }

  if (locale && !/^[a-z]{2}(-[a-z0-9]{2,8})?$/i.test(locale)) {
    errors.locale = "Locale must look like en or es-ES.";
    errors.form = errors.locale;
  }

  if (currencyCode && !/^[A-Z]{3}$/.test(currencyCode)) {
    errors.currencyCode = "Currency must be a 3-letter ISO code.";
    errors.form = errors.currencyCode;
  }

  return {
    errors,
    input: {
      enabled: isFormCheckboxChecked(formData, "marketRuleEnabled"),
      marketId: marketId || null,
      countryCode: countryCode || null,
      locale: locale || null,
      currencyCode: currencyCode || null,
      thresholdAmount,
      deliverySettings,
    },
  };
}

export function parseMarketThreshold(value: string, errors: MarketRuleErrors) {
  if (!value) return null;

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    errors.thresholdAmount = "Enter a zero or positive threshold amount.";
    errors.form = errors.thresholdAmount;
    return null;
  }

  return number.toFixed(2);
}

export function parseMarketJsonObject(
  value: string,
  message: string,
  errors: MarketRuleErrors,
): Prisma.InputJsonObject {
  if (!value.trim()) return {};

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.deliverySettingsJson = message;
      errors.form = message;
      return {};
    }

    return parsed as Prisma.InputJsonObject;
  } catch {
    errors.deliverySettingsJson = `${message.replace(/\.$/, "")} and valid JSON.`;
    errors.form = errors.deliverySettingsJson;
    return {};
  }
}

export function readFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function hasTranslationInputs(formData: FormData) {
  return Array.from(formData.keys()).some((key) =>
    key.startsWith("translation."),
  );
}

export function normalizeMarketLocale(value: string) {
  return value.replace("_", "-").toLowerCase();
}

export function isFormCheckboxChecked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export function parseAdvancedDiscountRuleFormData(formData: FormData): {
  errors: AdvancedDiscountRuleErrors;
  input: AdvancedDiscountRuleInput;
} {
  const errors: AdvancedDiscountRuleErrors = {};
  const title = String(formData.get("title") ?? "").trim();
  const ruleType = readAdvancedDiscountRuleType(
    String(formData.get("ruleType") ?? ""),
  );
  const status = readAdvancedDiscountRuleStatus(
    String(formData.get("ruleStatus") ?? ""),
  );
  const thresholds = parseAdvancedDiscountThresholds(
    String(formData.get("thresholdsJson") ?? ""),
    errors,
  );
  const discountValue = parseOptionalPercentage(
    formData.get("discountValue"),
    "discountValue",
    errors,
  );
  const shippingDiscountValue = parseOptionalPercentage(
    formData.get("shippingDiscountValue"),
    "shippingDiscountValue",
    errors,
  );

  if (!title) {
    errors.form = "Rule title is required.";
  }

  if (!ruleType) {
    errors.form = "Rule type is invalid.";
  }

  if (!status) {
    errors.form = "Rule status is invalid.";
  }

  return {
    errors,
    input: {
      title,
      ruleType: ruleType ?? AdvancedDiscountRuleType.TIERED_DISCOUNT,
      status: status ?? AdvancedDiscountRuleStatus.DRAFT,
      thresholds,
      productIds: parseMultilineIds(formData.get("productIds")),
      collectionIds: parseMultilineIds(formData.get("collectionIds")),
      discountValue,
      shippingDiscountValue,
      startsAt: String(formData.get("startsAt") ?? "").trim() || null,
      endsAt: String(formData.get("endsAt") ?? "").trim() || null,
    },
  };
}

export function parseAdvancedDiscountThresholds(
  value: string,
  errors: AdvancedDiscountRuleErrors,
) {
  const rawValue = value.trim();

  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      errors.thresholdsJson = "Thresholds must be a JSON array.";
      errors.form = errors.thresholdsJson;
      return [];
    }

    return parsed;
  } catch {
    errors.thresholdsJson = "Thresholds JSON is invalid.";
    errors.form = errors.thresholdsJson;
    return [];
  }
}

export function parseOptionalPercentage(
  value: FormDataEntryValue | null,
  key: "discountValue" | "shippingDiscountValue",
  errors: AdvancedDiscountRuleErrors,
) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) return null;

  const number = Number(rawValue);

  if (!Number.isFinite(number) || number <= 0 || number > 100) {
    errors[key] = "Enter a percentage between 0.01 and 100.";
    errors.form = errors[key];
    return null;
  }

  return number;
}

export function parseMultilineIds(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readAdvancedDiscountRuleType(value: string) {
  if (
    value === AdvancedDiscountRuleType.SPEND_X_GET_Y ||
    value === AdvancedDiscountRuleType.TIERED_DISCOUNT ||
    value === AdvancedDiscountRuleType.FREE_GIFT ||
    value === AdvancedDiscountRuleType.PRODUCT_SHIPPING_COMBO ||
    value === AdvancedDiscountRuleType.CART_CONTENTS
  ) {
    return value;
  }

  return null;
}

export function readAdvancedDiscountRuleStatus(value: string) {
  if (
    value === AdvancedDiscountRuleStatus.DRAFT ||
    value === AdvancedDiscountRuleStatus.ACTIVE ||
    value === AdvancedDiscountRuleStatus.PAUSED ||
    value === AdvancedDiscountRuleStatus.ARCHIVED
  ) {
    return value;
  }

  return null;
}

export function parseExperimentFormData(
  formData: FormData,
  options: { requireTwoWeightedVariants?: boolean } = {},
): {
  errors: ExperimentErrors;
  name: string;
  primaryMetric: ExperimentPrimaryMetric;
  variants: ExperimentVariantInput[];
} {
  const errors: ExperimentErrors = {};
  const requireTwoWeightedVariants = options.requireTwoWeightedVariants ?? true;
  const name = String(formData.get("name") ?? "").trim();
  const primaryMetric = readExperimentPrimaryMetric(
    String(formData.get("primaryMetric") ?? ""),
  );
  const ids = formData.getAll("variantId").map((value) => String(value));
  const names = formData.getAll("variantName").map((value) => String(value));
  const weights = formData
    .getAll("variantWeight")
    .map((value) => Number(value));
  const statuses = formData
    .getAll("variantStatus")
    .map((value) => String(value));
  const textOverrides = formData.getAll("textOverride");
  const designOverrides = formData.getAll("designOverride");
  const placementOverrides = formData.getAll("placementOverride");
  const variantCount = Math.max(names.length, weights.length);

  if (!name) {
    errors.form = "Experiment name is required.";
  }

  if (!primaryMetric) {
    errors.form = "Primary metric is required.";
  }

  const variants: ExperimentVariantInput[] = [];

  for (let index = 0; index < variantCount; index += 1) {
    const variantName = (names[index] ?? "").trim();
    const status = readExperimentVariantStatus(statuses[index] ?? "");

    if (!variantName) {
      errors.form = "Each variant needs a name.";
    }

    if (!Number.isFinite(weights[index]) || weights[index] < 0) {
      errors.form = "Variant weights must be zero or greater.";
    }

    if (!status) {
      errors.form = "Variant status is invalid.";
    }

    variants.push({
      id: ids[index]?.trim() || undefined,
      name: variantName,
      weight: Number.isFinite(weights[index]) ? weights[index] : 0,
      status: status ?? ExperimentVariantStatus.DRAFT,
      textOverride: parseJsonOverride(
        textOverrides[index],
        "Text override",
        errors,
      ),
      designOverride: parseJsonOverride(
        designOverrides[index],
        "Design override",
        errors,
      ),
      discountOverride: null,
      placementOverride: parseJsonOverride(
        placementOverrides[index],
        "Placement override",
        errors,
      ),
    });
  }

  if (variants.length < 1) {
    errors.form = "Create at least one variant.";
  }

  if (requireTwoWeightedVariants && variants.length < 2) {
    errors.form = "Create at least two variants.";
  }

  if (
    requireTwoWeightedVariants &&
    variants.filter(
      (variant) =>
        variant.status !== ExperimentVariantStatus.ARCHIVED &&
        variant.weight > 0,
    ).length < 2
  ) {
    errors.form = "At least two variants need positive weights.";
  }

  return {
    errors,
    name,
    primaryMetric: primaryMetric ?? ExperimentPrimaryMetric.CLICK_RATE,
    variants,
  };
}

export function parseAutoWinnerSettingsFormData(formData: FormData) {
  return {
    enabled: isFormCheckboxChecked(formData, "autoWinnerEnabled"),
    minSampleSize: Number(formData.get("autoWinnerMinSampleSize")),
    minRuntimeHours: Number(formData.get("autoWinnerMinRuntimeHours")),
    confidenceThreshold: Number(formData.get("autoWinnerConfidenceThreshold")),
  };
}

export function parseJsonOverride(
  value: FormDataEntryValue | undefined,
  label: string,
  errors: ExperimentErrors,
) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.form = `${label} must be a JSON object.`;
      return null;
    }

    return parsed;
  } catch {
    errors.form = `${label} is not valid JSON.`;
    return null;
  }
}

export function readExperimentPrimaryMetric(value: string) {
  if (value === "CTR" || value === ExperimentPrimaryMetric.CLICK_RATE) {
    return ExperimentPrimaryMetric.CLICK_RATE;
  }

  if (
    value === ExperimentPrimaryMetric.ADD_TO_CART_RATE ||
    value === ExperimentPrimaryMetric.CHECKOUT_RATE ||
    value === ExperimentPrimaryMetric.REVENUE_PER_VISITOR
  ) {
    return value;
  }

  return null;
}

export function readExperimentVariantStatus(value: string) {
  if (
    value === ExperimentVariantStatus.DRAFT ||
    value === ExperimentVariantStatus.ACTIVE ||
    value === ExperimentVariantStatus.PAUSED ||
    value === ExperimentVariantStatus.WINNER ||
    value === ExperimentVariantStatus.LOSER ||
    value === ExperimentVariantStatus.ARCHIVED
  ) {
    return value;
  }

  return null;
}

