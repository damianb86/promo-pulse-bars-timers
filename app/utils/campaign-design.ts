import {
  campaignDesignTemplates,
  defaultCampaignDesignValues,
  designAlignmentOptions,
  designIconOptions,
  findCampaignDesignTemplate,
  type CampaignDesignErrors,
  type CampaignDesignValues,
} from "../types/campaign-design";

const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;

const colorFields: Array<keyof CampaignDesignValues> = [
  "backgroundColor",
  "textColor",
  "accentColor",
  "buttonColor",
  "buttonTextColor",
];

export function isValidHexColor(value: string) {
  return hexColorPattern.test(value);
}

export function getContrastRatio(firstColor: string, secondColor: string) {
  if (!isValidHexColor(firstColor) || !isValidHexColor(secondColor)) return 0;

  const firstLuminance = getRelativeLuminance(firstColor);
  const secondLuminance = getRelativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export function hasReadableContrast(
  foregroundColor: string,
  backgroundColor: string,
  minimumRatio = 4.5,
) {
  return getContrastRatio(foregroundColor, backgroundColor) >= minimumRatio;
}

export function applyCampaignDesignTemplate(
  templateKey: string,
  currentValues: CampaignDesignValues = defaultCampaignDesignValues,
): CampaignDesignValues {
  const template = findCampaignDesignTemplate(templateKey);

  return {
    ...currentValues,
    ...template,
    templateKey: template.templateKey,
    customCss: currentValues.customCss,
  };
}

export function validateCampaignDesignValues(values: CampaignDesignValues) {
  const errors: CampaignDesignErrors = {};

  if (
    !campaignDesignTemplates.some(
      (template) => template.templateKey === values.templateKey,
    )
  ) {
    errors.templateKey = "Choose a supported template.";
  }

  for (const field of colorFields) {
    if (!isValidHexColor(String(values[field]))) {
      errors[field] = "Enter a valid 6-digit hex color.";
    }
  }

  if (
    isValidHexColor(values.backgroundColor) &&
    isValidHexColor(values.textColor) &&
    !hasReadableContrast(values.textColor, values.backgroundColor)
  ) {
    errors.textColor = "Text color needs stronger contrast with background.";
  }

  if (
    isValidHexColor(values.buttonColor) &&
    isValidHexColor(values.buttonTextColor) &&
    !hasReadableContrast(values.buttonTextColor, values.buttonColor)
  ) {
    errors.buttonTextColor =
      "Button text color needs stronger contrast with button color.";
  }

  if (
    !Number.isInteger(values.fontSize) ||
    values.fontSize < 10 ||
    values.fontSize > 24
  ) {
    errors.fontSize = "Font size must be between 10 and 24.";
  }

  if (
    !Number.isInteger(values.borderRadius) ||
    values.borderRadius < 0 ||
    values.borderRadius > 24
  ) {
    errors.borderRadius = "Border radius must be between 0 and 24.";
  }

  if (
    !designAlignmentOptions.some((option) => option.value === values.alignment)
  ) {
    errors.alignment = "Choose a valid alignment.";
  }

  if (!designIconOptions.some((option) => option.value === values.icon)) {
    errors.icon = "Choose a valid icon.";
  }

  return errors;
}

export function hasCampaignDesignErrors(errors: CampaignDesignErrors) {
  return Object.keys(errors).length > 0;
}

export function sanitizeCustomCss(value: string, isProPlan: boolean) {
  if (!isProPlan) return "";

  return value
    .replace(/<\/?style[^>]*>/gi, "")
    .replace(/@import[^;]+;/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/url\s*\(\s*javascript:[^)]*\)/gi, "")
    .trim()
    .slice(0, 2000);
}

function getRelativeLuminance(hexColor: string) {
  const [red, green, blue] = hexToRgb(hexColor).map(toLinearRgb);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function hexToRgb(hexColor: string) {
  return [1, 3, 5].map((start) =>
    parseInt(hexColor.slice(start, start + 2), 16),
  );
}

function toLinearRgb(value: number) {
  const normalizedValue = value / 255;

  return normalizedValue <= 0.03928
    ? normalizedValue / 12.92
    : Math.pow((normalizedValue + 0.055) / 1.055, 2.4);
}
