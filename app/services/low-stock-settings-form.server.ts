import {
  defaultLowStockSettingsValues,
  type LowStockSettingsErrors,
  type LowStockSettingsValues,
} from "../types/low-stock";

export type ParsedLowStockSettingsForm = {
  values: LowStockSettingsValues;
  errors: LowStockSettingsErrors;
  threshold: number;
};

export function parseLowStockSettingsFormData(
  formData: FormData,
): ParsedLowStockSettingsForm {
  const values: LowStockSettingsValues = {
    threshold: readString(formData, "threshold"),
    showExactQuantity: readBoolean(formData, "showExactQuantity"),
    fallbackMessage: readString(formData, "fallbackMessage"),
  };
  const errors: LowStockSettingsErrors = {};
  const threshold = Number(values.threshold);

  if (!Number.isInteger(threshold) || threshold < 1) {
    errors.threshold = "Threshold must be a whole number greater than 0.";
  }

  if (values.fallbackMessage.length > 180) {
    errors.fallbackMessage = "Keep fallback message under 180 characters.";
  }

  return {
    values: {
      ...values,
      threshold: Number.isInteger(threshold)
        ? String(threshold)
        : defaultLowStockSettingsValues.threshold,
    },
    errors,
    threshold: Number.isInteger(threshold) && threshold > 0 ? threshold : 1,
  };
}

export function hasLowStockSettingsErrors(errors: LowStockSettingsErrors) {
  return Object.keys(errors).length > 0;
}

function readString(formData: FormData, key: keyof LowStockSettingsValues) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(formData: FormData, key: keyof LowStockSettingsValues) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}
