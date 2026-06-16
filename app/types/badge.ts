export const badgeShapeOptions = [
  { value: "PILL", label: "Pill" },
  { value: "ROUNDED", label: "Rounded" },
  { value: "SQUARE", label: "Square" },
] as const;

export const badgePositionOptions = [
  { value: "TOP_LEFT", label: "Top left" },
  { value: "TOP_RIGHT", label: "Top right" },
  { value: "BOTTOM_LEFT", label: "Bottom left" },
  { value: "BOTTOM_RIGHT", label: "Bottom right" },
] as const;

export const badgeTextPresets = [
  "Sale ends today",
  "Low stock",
  "New drop",
  "Free shipping",
  "Pre-order",
  "Limited offer",
] as const;

export type BadgeShapeValue = (typeof badgeShapeOptions)[number]["value"];
export type BadgePositionValue = (typeof badgePositionOptions)[number]["value"];

export type BadgeSettingsValues = {
  badgeText: string;
  badgeShape: BadgeShapeValue;
  badgePosition: BadgePositionValue;
};

export type BadgeSettingsErrors = Partial<
  Record<keyof BadgeSettingsValues | "form", string>
>;

export const defaultBadgeSettingsValues: BadgeSettingsValues = {
  badgeText: "Limited offer",
  badgeShape: "PILL",
  badgePosition: "TOP_RIGHT",
};

export function toBadgeShape(
  value: string | null | undefined,
): BadgeShapeValue {
  return badgeShapeOptions.some((option) => option.value === value)
    ? (value as BadgeShapeValue)
    : defaultBadgeSettingsValues.badgeShape;
}

export function toBadgePosition(
  value: string | null | undefined,
): BadgePositionValue {
  return badgePositionOptions.some((option) => option.value === value)
    ? (value as BadgePositionValue)
    : defaultBadgeSettingsValues.badgePosition;
}
