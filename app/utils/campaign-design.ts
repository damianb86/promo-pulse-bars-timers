import {
  campaignDesignTemplates,
  defaultCampaignDesignValues,
  designAlignmentOptions,
  designBackgroundTypeOptions,
  designBannerAnimationOptions,
  designFontFamilyOptions,
  designIconOptions,
  designLayoutOptions,
  designPositionModeOptions,
  designTimerFormatOptions,
  designTimerTickAnimationOptions,
  designTimerStyleOptions,
  findCampaignDesignTemplate,
  type CampaignDesignErrors,
  type CampaignDesignValues,
} from "../types/campaign-design";

const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;

const colorFields: Array<keyof CampaignDesignValues> = [
  "backgroundColor",
  "gradientStartColor",
  "gradientEndColor",
  "textColor",
  "accentColor",
  "buttonColor",
  "buttonTextColor",
  "closeButtonColor",
  "borderColor",
  "titleColor",
  "subheadingColor",
  "timerColor",
  "legendColor",
  "timerSurfaceColor",
  "timerSurfaceBorderColor",
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
    layout: currentValues.layout,
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
    values.backgroundType === "SOLID" &&
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

  if (!designLayoutOptions.some((option) => option.value === values.layout)) {
    errors.layout = "Choose a valid layout.";
  }

  if (
    !designBackgroundTypeOptions.some(
      (option) => option.value === values.backgroundType,
    )
  ) {
    errors.backgroundType = "Choose a valid background type.";
  }

  if (values.backgroundType === "IMAGE" && !values.backgroundImageUrl.trim()) {
    errors.backgroundImageUrl = "Choose a Shopify image or paste an image URL.";
  } else if (
    values.backgroundImageUrl &&
    !isSafeBackgroundImageUrl(values.backgroundImageUrl)
  ) {
    errors.backgroundImageUrl = "Use a valid image URL.";
  }

  if (
    !Number.isInteger(values.gradientAngle) ||
    values.gradientAngle < 0 ||
    values.gradientAngle > 360
  ) {
    errors.gradientAngle = "Gradient angle must be between 0 and 360.";
  }

  if (
    !Number.isInteger(values.fontSize) ||
    values.fontSize < 10 ||
    values.fontSize > 24
  ) {
    errors.fontSize = "Font size must be between 10 and 24.";
  }

  if (!Number.isInteger(values.borderRadius) || values.borderRadius < 0) {
    errors.borderRadius = "Border radius must be 0 or greater.";
  }

  if (
    !Number.isInteger(values.borderSize) ||
    values.borderSize < 0 ||
    values.borderSize > 8
  ) {
    errors.borderSize = "Border size must be between 0 and 8.";
  }

  if (
    !designFontFamilyOptions.some(
      (option) => option.value === values.fontFamily,
    )
  ) {
    errors.fontFamily = "Choose a valid font.";
  }

  validateIntegerRange(values, errors, "titleFontSize", 12, 48, "Title size");
  validateIntegerRange(
    values,
    errors,
    "subheadingFontSize",
    10,
    32,
    "Subheading size",
  );
  validateIntegerRange(values, errors, "timerFontSize", 12, 72, "Timer size");
  validateIntegerRange(values, errors, "legendFontSize", 10, 24, "Legend size");

  if (
    !designTimerStyleOptions.some(
      (option) => option.value === values.timerStyle,
    )
  ) {
    errors.timerStyle = "Choose a valid timer style.";
  }

  if (
    !designTimerFormatOptions.some(
      (option) => option.value === values.timerFormat,
    )
  ) {
    errors.timerFormat = "Choose a valid timer format.";
  }

  validateLabel(values, errors, "timerDaysLabel", "Days label");
  validateLabel(values, errors, "timerHoursLabel", "Hours label");
  validateLabel(values, errors, "timerMinutesLabel", "Minutes label");
  validateLabel(values, errors, "timerSecondsLabel", "Seconds label");

  validateIntegerRange(
    values,
    errors,
    "timerSurfaceBorderSize",
    0,
    6,
    "Timer border size",
  );
  validateIntegerRange(
    values,
    errors,
    "timerSurfaceRadius",
    0,
    40,
    "Timer radius",
  );
  validateIntegerRange(
    values,
    errors,
    "paddingBlock",
    4,
    48,
    "Vertical padding",
  );
  validateIntegerRange(
    values,
    errors,
    "paddingInline",
    8,
    64,
    "Horizontal padding",
  );
  validateIntegerRange(values, errors, "contentGap", 0, 32, "Content gap");
  validateIntegerRange(
    values,
    errors,
    "contentMaxWidth",
    280,
    1440,
    "Content max width",
  );

  if (
    !designPositionModeOptions.some(
      (option) => option.value === values.positionMode,
    )
  ) {
    errors.positionMode = "Choose a valid position mode.";
  }

  if (
    !designBannerAnimationOptions.some(
      (option) => option.value === values.entranceAnimation,
    )
  ) {
    errors.entranceAnimation = "Choose a valid entrance effect.";
  }

  if (
    !designBannerAnimationOptions.some(
      (option) => option.value === values.exitAnimation,
    )
  ) {
    errors.exitAnimation = "Choose a valid close effect.";
  }

  validateIntegerRange(
    values,
    errors,
    "animationDurationMs",
    0,
    1500,
    "Animation duration",
  );

  if (
    !designTimerTickAnimationOptions.some(
      (option) => option.value === values.timerTickAnimation,
    )
  ) {
    errors.timerTickAnimation = "Choose a valid timer change effect.";
  }

  if (
    !designAlignmentOptions.some((option) => option.value === values.alignment)
  ) {
    errors.alignment = "Choose a valid alignment.";
  }

  if (!designIconOptions.some((option) => option.value === values.icon)) {
    errors.icon = "Choose a valid icon.";
  }

  validateIntegerRange(values, errors, "iconSize", 12, 64, "Icon size");

  if (values.icon === "CUSTOM" && !values.customIconUrl) {
    errors.customIconUrl = "Upload an SVG, PNG, JPG, or JPEG icon.";
  } else if (
    values.customIconUrl &&
    (values.customIconUrl.length > 150_000 ||
      !isSafeCustomIconUrl(values.customIconUrl))
  ) {
    errors.customIconUrl = "Upload a valid image icon.";
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

function validateIntegerRange(
  values: CampaignDesignValues,
  errors: CampaignDesignErrors,
  field: keyof CampaignDesignValues,
  min: number,
  max: number,
  label: string,
) {
  const value = values[field];

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    errors[field] = `${label} must be between ${min} and ${max}.`;
  }
}

function validateLabel(
  values: CampaignDesignValues,
  errors: CampaignDesignErrors,
  field: keyof CampaignDesignValues,
  label: string,
) {
  const value = values[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    errors[field] = `${label} is required.`;
    return;
  }

  if (value.length > 12) {
    errors[field] = `${label} must be 12 characters or fewer.`;
  }
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

function isSafeCustomIconUrl(value: string) {
  return (
    value.startsWith("/") ||
    /^https?:\/\//i.test(value) ||
    /^data:image\/(?:svg\+xml|png|jpe?g);base64,/i.test(value)
  );
}

function isSafeBackgroundImageUrl(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}
