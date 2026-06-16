import {
  badgePositionOptions,
  badgeShapeOptions,
  defaultBadgeSettingsValues,
  type BadgePositionValue,
  type BadgeSettingsErrors,
  type BadgeSettingsValues,
  type BadgeShapeValue,
} from "../types/badge";

const badgeShapes = new Set<string>(
  badgeShapeOptions.map((option) => option.value),
);
const badgePositions = new Set<string>(
  badgePositionOptions.map((option) => option.value),
);

export type ParsedBadgeSettingsForm = {
  values: BadgeSettingsValues;
  errors: BadgeSettingsErrors;
};

export function parseBadgeSettingsFormData(
  formData: FormData,
): ParsedBadgeSettingsForm {
  const values: BadgeSettingsValues = {
    badgeText: readString(formData, "badgeText"),
    badgeShape: readBadgeShape(formData),
    badgePosition: readBadgePosition(formData),
  };
  const errors: BadgeSettingsErrors = {};

  if (!values.badgeText) {
    errors.badgeText = "Badge text is required.";
  }

  if (values.badgeText.length > 48) {
    errors.badgeText = "Keep badge text under 48 characters.";
  }

  return { values, errors };
}

export function hasBadgeSettingsErrors(errors: BadgeSettingsErrors) {
  return Object.keys(errors).length > 0;
}

function readString(formData: FormData, key: keyof BadgeSettingsValues) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readBadgeShape(formData: FormData): BadgeShapeValue {
  const value = readString(formData, "badgeShape");

  return badgeShapes.has(value)
    ? (value as BadgeShapeValue)
    : defaultBadgeSettingsValues.badgeShape;
}

function readBadgePosition(formData: FormData): BadgePositionValue {
  const value = readString(formData, "badgePosition");

  return badgePositions.has(value)
    ? (value as BadgePositionValue)
    : defaultBadgeSettingsValues.badgePosition;
}
