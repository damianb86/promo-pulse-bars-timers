import type { Prisma } from "@prisma/client";

import {
  afterCutoffBehaviorOptions,
  defaultDeliveryCutoffSettingsValues,
  type AfterCutoffBehaviorValue,
  type DeliveryCutoffSettingsErrors,
  type DeliveryCutoffSettingsValues,
} from "../types/delivery-cutoff";

export type ParsedDeliveryCutoffSettingsForm = {
  values: DeliveryCutoffSettingsValues;
  errors: DeliveryCutoffSettingsErrors;
  cutoffHour: number;
  cutoffMinute: number;
  processingDays: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  workingDays: Prisma.InputJsonValue;
  holidays: Prisma.InputJsonValue;
  countryRules: Prisma.InputJsonValue;
};

const afterCutoffBehaviors = new Set<string>(
  afterCutoffBehaviorOptions.map((option) => option.value),
);

export function parseDeliveryCutoffSettingsFormData(
  formData: FormData,
): ParsedDeliveryCutoffSettingsForm {
  const values: DeliveryCutoffSettingsValues = {
    afterCutoffBehavior: readAfterCutoffBehavior(formData),
    countryRulesJson: readString(formData, "countryRulesJson"),
    cutoffHour: readString(formData, "cutoffHour"),
    cutoffMinute: readString(formData, "cutoffMinute"),
    holidaysJson: readString(formData, "holidaysJson"),
    maxDeliveryDays: readString(formData, "maxDeliveryDays"),
    minDeliveryDays: readString(formData, "minDeliveryDays"),
    processingDays: readString(formData, "processingDays"),
    timezone: readString(formData, "timezone") || "UTC",
    workingDaysJson: readString(formData, "workingDaysJson"),
  };
  const errors: DeliveryCutoffSettingsErrors = {};
  const cutoffHour = readIntegerValue(values.cutoffHour, 0);
  const cutoffMinute = readIntegerValue(values.cutoffMinute, 0);
  const processingDays = readIntegerValue(values.processingDays, 0);
  const minDeliveryDays = readIntegerValue(values.minDeliveryDays, 0);
  const maxDeliveryDays = readIntegerValue(values.maxDeliveryDays, 0);
  const workingDays = parseWorkingDays(values.workingDaysJson, errors);
  const holidays = parseHolidays(values.holidaysJson, errors);
  const countryRules = parseJsonObject(
    values.countryRulesJson,
    "countryRulesJson",
    "Country rules must be a JSON object.",
    errors,
  );

  if (!Number.isInteger(cutoffHour) || cutoffHour < 0 || cutoffHour > 23) {
    errors.cutoffHour = "Cutoff hour must be between 0 and 23.";
  }

  if (
    !Number.isInteger(cutoffMinute) ||
    cutoffMinute < 0 ||
    cutoffMinute > 59
  ) {
    errors.cutoffMinute = "Cutoff minute must be between 0 and 59.";
  }

  if (processingDays < 0) {
    errors.processingDays = "Processing days must be 0 or greater.";
  }

  if (minDeliveryDays < 0) {
    errors.minDeliveryDays = "Minimum delivery days must be 0 or greater.";
  }

  if (maxDeliveryDays < minDeliveryDays) {
    errors.maxDeliveryDays =
      "Maximum delivery days must be greater than or equal to minimum delivery days.";
  }

  if (!isValidTimezone(values.timezone)) {
    errors.timezone = "Enter a valid IANA timezone.";
  }

  return {
    countryRules: countryRules ?? {},
    cutoffHour,
    cutoffMinute,
    errors,
    holidays,
    maxDeliveryDays,
    minDeliveryDays,
    processingDays,
    values,
    workingDays,
  };
}

export function hasDeliveryCutoffSettingsErrors(
  errors: DeliveryCutoffSettingsErrors,
) {
  return Object.keys(errors).length > 0;
}

function readString(
  formData: FormData,
  key: keyof DeliveryCutoffSettingsValues,
) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readIntegerValue(value: string, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function readAfterCutoffBehavior(formData: FormData): AfterCutoffBehaviorValue {
  const value = readString(formData, "afterCutoffBehavior");

  return afterCutoffBehaviors.has(value)
    ? (value as AfterCutoffBehaviorValue)
    : defaultDeliveryCutoffSettingsValues.afterCutoffBehavior;
}

function parseWorkingDays(value: string, errors: DeliveryCutoffSettingsErrors) {
  const parsed = parseJsonArray(
    value,
    "workingDaysJson",
    "Working days must be a JSON array.",
    errors,
  );

  if (
    !parsed ||
    parsed.some((item) => {
      const day = Number(item);
      return !Number.isInteger(day) || day < 1 || day > 7;
    })
  ) {
    errors.workingDaysJson = "Working days must contain numbers from 1 to 7.";
    return [1, 2, 3, 4, 5];
  }

  return parsed as Prisma.InputJsonArray;
}

function parseHolidays(value: string, errors: DeliveryCutoffSettingsErrors) {
  const parsed = parseJsonArray(
    value,
    "holidaysJson",
    "Holidays must be a JSON array.",
    errors,
  );

  if (
    !parsed ||
    parsed.some(
      (item) => typeof item !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item),
    )
  ) {
    errors.holidaysJson = "Holidays must contain YYYY-MM-DD strings.";
    return [];
  }

  return parsed as Prisma.InputJsonArray;
}

function parseJsonArray(
  value: string,
  key: keyof DeliveryCutoffSettingsErrors,
  message: string,
  errors: DeliveryCutoffSettingsErrors,
) {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;

    if (Array.isArray(parsed)) return parsed;
  } catch {
    errors[key] = message;
    return null;
  }

  errors[key] = message;
  return null;
}

function parseJsonObject(
  value: string,
  key: keyof DeliveryCutoffSettingsErrors,
  message: string,
  errors: DeliveryCutoffSettingsErrors,
) {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Prisma.InputJsonObject;
    }
  } catch {
    errors[key] = "Enter valid JSON for country rules.";
    return null;
  }

  errors[key] = message;
  return null;
}

function isValidTimezone(timezone: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
