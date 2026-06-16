import type { Prisma } from "@prisma/client";

import {
  defaultFreeShippingSettingsValues,
  freeShippingProgressStyleOptions,
  type FreeShippingProgressStyleValue,
  type FreeShippingSettingsErrors,
  type FreeShippingSettingsValues,
} from "../types/free-shipping";

export type ParsedFreeShippingSettingsForm = {
  values: FreeShippingSettingsValues;
  errors: FreeShippingSettingsErrors;
  thresholdAmount: string;
  thresholdRules: Prisma.InputJsonValue | null;
};

const progressStyles = new Set<string>(
  freeShippingProgressStyleOptions.map((option) => option.value),
);

export function parseFreeShippingSettingsFormData(
  formData: FormData,
): ParsedFreeShippingSettingsForm {
  const values: FreeShippingSettingsValues = {
    thresholdAmount: readString(formData, "thresholdAmount"),
    currencyCode: readString(formData, "currencyCode").toUpperCase(),
    includeDiscountedSubtotal: readBoolean(
      formData,
      "includeDiscountedSubtotal",
    ),
    emptyCartMessage: readString(formData, "emptyCartMessage"),
    successMessage: readString(formData, "successMessage"),
    progressStyle: readProgressStyle(formData),
    thresholdRulesJson: readString(formData, "thresholdRulesJson"),
  };
  const errors: FreeShippingSettingsErrors = {};
  const threshold = Number(values.thresholdAmount);
  const thresholdRules = parseThresholdRules(values.thresholdRulesJson, errors);

  if (!Number.isFinite(threshold) || threshold <= 0) {
    errors.thresholdAmount = "Threshold amount must be greater than 0.";
  }

  if (!/^[A-Z]{3}$/.test(values.currencyCode)) {
    errors.currencyCode = "Currency code must use a 3-letter ISO code.";
  }

  if (values.emptyCartMessage.length > 500) {
    errors.emptyCartMessage = "Keep empty cart message under 500 characters.";
  }

  if (values.successMessage.length > 500) {
    errors.successMessage = "Keep success message under 500 characters.";
  }

  return {
    values,
    errors,
    thresholdAmount: Number.isFinite(threshold) ? threshold.toFixed(2) : "0.00",
    thresholdRules,
  };
}

export function hasFreeShippingSettingsErrors(
  errors: FreeShippingSettingsErrors,
) {
  return Object.keys(errors).length > 0;
}

function readString(formData: FormData, key: keyof FreeShippingSettingsValues) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(
  formData: FormData,
  key: keyof FreeShippingSettingsValues,
) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readProgressStyle(formData: FormData): FreeShippingProgressStyleValue {
  const value = readString(formData, "progressStyle");

  return progressStyles.has(value)
    ? (value as FreeShippingProgressStyleValue)
    : defaultFreeShippingSettingsValues.progressStyle;
}

function parseThresholdRules(
  value: string,
  errors: FreeShippingSettingsErrors,
): Prisma.InputJsonValue | null {
  if (!value) return null;

  try {
    const parsedValue = JSON.parse(value) as unknown;

    if (
      parsedValue &&
      typeof parsedValue === "object" &&
      !Array.isArray(parsedValue)
    ) {
      return parsedValue as Prisma.InputJsonObject;
    }
  } catch {
    errors.thresholdRulesJson = "Enter valid JSON for threshold rules.";
    return null;
  }

  errors.thresholdRulesJson = "Threshold rules must be a JSON object.";
  return null;
}
