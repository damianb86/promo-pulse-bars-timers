import {
  defaultDiscountSettingsValues,
  discountModeOptions,
  discountValueTypeOptions,
  type DiscountModeValue,
  type DiscountSettingsErrors,
  type DiscountSettingsValues,
  type DiscountValueTypeValue,
} from "../types/discount";
import { normalizeUniqueCodePrefix } from "./unique-discount-codes.server";

export type ParsedDiscountSettingsForm = {
  values: DiscountSettingsValues;
  errors: DiscountSettingsErrors;
  discountValue: number;
  minimumSubtotal: number | null;
  uniqueCodeExpiresMinutes: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

const discountModes = new Set<string>(
  discountModeOptions.map((option) => option.value),
);
const discountValueTypes = new Set<string>(
  discountValueTypeOptions.map((option) => option.value),
);

export function parseDiscountSettingsFormData(
  formData: FormData,
): ParsedDiscountSettingsForm {
  const values: DiscountSettingsValues = {
    mode: readDiscountMode(formData),
    existingCodeOrId: readString(formData, "existingCodeOrId"),
    discountCode: readString(formData, "discountCode").toUpperCase(),
    shopifyDiscountId: readString(formData, "shopifyDiscountId"),
    syncStartEnd: readBoolean(formData, "syncStartEnd"),
    title: readString(formData, "title"),
    valueType: readDiscountValueType(formData),
    value: readString(formData, "value"),
    startsAt: readString(formData, "startsAt"),
    endsAt: readString(formData, "endsAt"),
    minimumSubtotal: readString(formData, "minimumSubtotal"),
    appliesOncePerCustomer: readBoolean(formData, "appliesOncePerCustomer"),
    uniqueCodePrefix: normalizeUniqueCodePrefix(
      readString(formData, "uniqueCodePrefix"),
    ),
    uniqueCodeExpiresMinutes: readString(formData, "uniqueCodeExpiresMinutes"),
    uniqueCodeAutoApply: readBoolean(formData, "uniqueCodeAutoApply"),
  };
  const errors: DiscountSettingsErrors = {};
  const discountValue = Number(values.value);
  const minimumSubtotal = values.minimumSubtotal
    ? Number(values.minimumSubtotal)
    : null;
  const uniqueCodeExpiresMinutes = values.uniqueCodeExpiresMinutes
    ? Number(values.uniqueCodeExpiresMinutes)
    : null;
  const startsAt = parseOptionalDate(values.startsAt, "startsAt", errors);
  const endsAt = parseOptionalDate(values.endsAt, "endsAt", errors);

  if (values.mode === "LINK_EXISTING" && !values.existingCodeOrId) {
    errors.existingCodeOrId = "Enter or select a Shopify discount code or ID.";
  }

  if (values.mode === "CREATE_NEW") {
    if (!values.discountCode) {
      errors.discountCode = "Discount code is required.";
    } else if (!/^[A-Z0-9_-]{3,40}$/.test(values.discountCode)) {
      errors.discountCode =
        "Use 3-40 characters: letters, numbers, dashes, or underscores.";
    }

    if (!values.title) {
      errors.title = "Discount title is required.";
    }

    if (values.valueType !== "FREE_SHIPPING") {
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        errors.value = "Discount value must be greater than 0.";
      } else if (values.valueType === "PERCENTAGE" && discountValue > 100) {
        errors.value = "Percentage discount cannot exceed 100.";
      }
    }
  }

  if (values.mode === "UNIQUE_CODES") {
    if (!values.title) {
      errors.title = "Discount title is required.";
    }

    if (!values.uniqueCodePrefix) {
      errors.uniqueCodePrefix = "Unique code prefix is required.";
    } else if (!/^[A-Z0-9_-]{2,16}$/.test(values.uniqueCodePrefix)) {
      errors.uniqueCodePrefix =
        "Use 2-16 characters: letters, numbers, dashes, or underscores.";
    }

    if (values.valueType !== "FREE_SHIPPING") {
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        errors.value = "Discount value must be greater than 0.";
      } else if (values.valueType === "PERCENTAGE" && discountValue > 100) {
        errors.value = "Percentage discount cannot exceed 100.";
      }
    }
  }

  if (
    minimumSubtotal !== null &&
    (!Number.isFinite(minimumSubtotal) || minimumSubtotal < 0)
  ) {
    errors.minimumSubtotal = "Minimum subtotal must be 0 or greater.";
  }

  if (
    uniqueCodeExpiresMinutes !== null &&
    (!Number.isInteger(uniqueCodeExpiresMinutes) ||
      uniqueCodeExpiresMinutes < 5 ||
      uniqueCodeExpiresMinutes > 43200)
  ) {
    errors.uniqueCodeExpiresMinutes =
      "Unique code expiration must be between 5 minutes and 30 days.";
  }

  if (startsAt && endsAt && startsAt > endsAt) {
    errors.endsAt = "End date must be after start date.";
  }

  return {
    values,
    errors,
    discountValue: Number.isFinite(discountValue) ? discountValue : 0,
    minimumSubtotal:
      minimumSubtotal !== null && Number.isFinite(minimumSubtotal)
        ? minimumSubtotal
        : null,
    uniqueCodeExpiresMinutes:
      uniqueCodeExpiresMinutes !== null &&
      Number.isInteger(uniqueCodeExpiresMinutes)
        ? uniqueCodeExpiresMinutes
        : null,
    startsAt,
    endsAt,
  };
}

export function hasDiscountSettingsErrors(errors: DiscountSettingsErrors) {
  return Object.keys(errors).length > 0;
}

function readString(formData: FormData, key: keyof DiscountSettingsValues) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(formData: FormData, key: keyof DiscountSettingsValues) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readDiscountMode(formData: FormData): DiscountModeValue {
  const value = readString(formData, "mode");

  return discountModes.has(value)
    ? (value as DiscountModeValue)
    : defaultDiscountSettingsValues.mode;
}

function readDiscountValueType(formData: FormData): DiscountValueTypeValue {
  const value = readString(formData, "valueType");

  return discountValueTypes.has(value)
    ? (value as DiscountValueTypeValue)
    : defaultDiscountSettingsValues.valueType;
}

function parseOptionalDate(
  value: string,
  key: keyof DiscountSettingsValues,
  errors: DiscountSettingsErrors,
) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    errors[key] = "Enter a valid date and time.";
    return null;
  }

  return date;
}
