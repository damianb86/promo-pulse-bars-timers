import {
  campaignDesignTemplates,
  defaultCampaignDesignValues,
  designAlignmentOptions,
  designBackgroundImageAttachmentOptions,
  designBackgroundImagePositionOptions,
  designBackgroundImageRepeatOptions,
  designBackgroundImageSizeOptions,
  designBackgroundTypeOptions,
  designBannerAnimationOptions,
  designDismissBehaviorOptions,
  designFontFamilyOptions,
  designIconOptions,
  designLayoutOptions,
  designOfferApplyBehaviorOptions,
  designOfferCodeLayoutOptions,
  designOfferCopyBehaviorOptions,
  designPositionModeOptions,
  designTimerFormatOptions,
  designTimerNumberLayoutOptions,
  designTimerTickAnimationOptions,
  designTimerStyleOptions,
  findCampaignDesignTemplate,
  type CampaignDesignErrors,
  type CampaignDesignTemplate,
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
  "buttonHoverColor",
  "buttonTextHoverColor",
  "closeButtonColor",
  "borderColor",
  "titleColor",
  "subheadingColor",
  "timerColor",
  "legendColor",
  "timerSurfaceColor",
  "timerSurfaceBorderColor",
  "offerCodeTextColor",
  "offerCodeBackgroundColor",
  "offerCodeBorderColor",
  "copyButtonBackgroundColor",
  "copyButtonTextColor",
  "copyButtonBorderColor",
  "applyButtonBackgroundColor",
  "applyButtonTextColor",
  "applyButtonBorderColor",
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

export function getBackgroundImageSizeCssValue(value: string | undefined) {
  if (value === "CONTAIN") return "contain";
  if (value === "AUTO") return "auto";
  if (value === "STRETCH") return "100% 100%";
  return "cover";
}

export function getBackgroundImagePositionCssValue(value: string | undefined) {
  if (value === "TOP") return "top";
  if (value === "BOTTOM") return "bottom";
  if (value === "LEFT") return "left";
  if (value === "RIGHT") return "right";
  if (value === "TOP_LEFT") return "top left";
  if (value === "TOP_RIGHT") return "top right";
  if (value === "BOTTOM_LEFT") return "bottom left";
  if (value === "BOTTOM_RIGHT") return "bottom right";
  return "center";
}

export function getBackgroundImageRepeatCssValue(value: string | undefined) {
  if (value === "REPEAT") return "repeat";
  if (value === "REPEAT_X") return "repeat-x";
  if (value === "REPEAT_Y") return "repeat-y";
  return "no-repeat";
}

export function getBackgroundImageAttachmentCssValue(
  value: string | undefined,
) {
  if (value === "FIXED") return "fixed";
  if (value === "LOCAL") return "local";
  return "scroll";
}

export function applyCampaignDesignTemplate(
  templateKey: string,
  currentValues: CampaignDesignValues = defaultCampaignDesignValues,
): CampaignDesignValues {
  const template = findCampaignDesignTemplate(templateKey);
  const templateValues = toTemplateDesignValues(template);
  const layout = currentValues.layout;

  return {
    ...currentValues,
    ...templateValues,
    templateKey: template.templateKey,
    customCss: currentValues.customCss,
    layout,
    separateMobileDesign: currentValues.separateMobileDesign,
  };
}

function toTemplateDesignValues(
  template: CampaignDesignTemplate,
): CampaignDesignValues {
  const values: Partial<CampaignDesignTemplate> = { ...template };
  delete values.label;
  delete values.description;
  delete values.bestFor;
  delete values.visualCode;
  delete values.emphasizes;
  delete values.avoids;
  return values as CampaignDesignValues;
}

export function applyCampaignLayoutDefaults(
  values: CampaignDesignValues,
): CampaignDesignValues {
  const layoutDefaults = campaignLayoutDefaultValues[values.layout];
  return {
    ...values,
    ...layoutDefaults,
    timerNumberFontSize:
      layoutDefaults.timerNumberFontSize ??
      layoutDefaults.timerFontSize ??
      values.timerNumberFontSize,
    timerLabelFontSize:
      layoutDefaults.timerLabelFontSize ??
      layoutDefaults.legendFontSize ??
      values.timerLabelFontSize,
  };
}

export const campaignLayoutDefaultValues: Record<
  CampaignDesignValues["layout"],
  Partial<CampaignDesignValues>
> = {
  STANDARD: {
    showButton: true,
    alignment: "CENTER",
    timerStyle: "PLAIN",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 14,
    titleFontSize: 22,
    subheadingFontSize: 14,
    timerFontSize: 38,
    legendFontSize: 12,
    paddingBlock: 20,
    paddingInline: 24,
    contentGap: 8,
  },
  BALANCED: {
    showButton: true,
    alignment: "LEFT",
    timerStyle: "BOXES",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 14,
    titleFontSize: 22,
    subheadingFontSize: 14,
    timerFontSize: 34,
    legendFontSize: 11,
    paddingBlock: 18,
    paddingInline: 22,
    contentGap: 16,
  },
  BALANCED_REVERSE: {
    showButton: true,
    alignment: "LEFT",
    timerStyle: "BOXES",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 14,
    titleFontSize: 22,
    subheadingFontSize: 14,
    timerFontSize: 34,
    legendFontSize: 11,
    paddingBlock: 18,
    paddingInline: 22,
    contentGap: 16,
  },
  INLINE: {
    showButton: false,
    alignment: "CENTER",
    timerStyle: "PLAIN",
    timerFormat: "COLON",
    timerShowLabels: false,
    fontSize: 13,
    titleFontSize: 16,
    subheadingFontSize: 12,
    timerFontSize: 16,
    legendFontSize: 11,
    paddingBlock: 10,
    paddingInline: 18,
    contentGap: 8,
  },
  STACKED_WIDE: {
    showButton: true,
    alignment: "CENTER",
    timerStyle: "GROUPED",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 15,
    titleFontSize: 24,
    subheadingFontSize: 15,
    timerFontSize: 36,
    legendFontSize: 12,
    paddingBlock: 18,
    paddingInline: 32,
    contentGap: 12,
    contentMaxWidth: 1040,
  },
  COMPACT_STACK: {
    showButton: true,
    alignment: "CENTER",
    timerStyle: "BOXES",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 13,
    titleFontSize: 18,
    subheadingFontSize: 12,
    timerFontSize: 24,
    legendFontSize: 10,
    paddingBlock: 12,
    paddingInline: 14,
    contentGap: 7,
    contentMaxWidth: 420,
  },
  CTA_RIGHT: {
    showButton: true,
    alignment: "LEFT",
    timerStyle: "GROUPED",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 14,
    titleFontSize: 22,
    subheadingFontSize: 14,
    timerFontSize: 32,
    legendFontSize: 12,
    paddingBlock: 16,
    paddingInline: 20,
    contentGap: 12,
  },
  CTA_LEFT: {
    showButton: true,
    alignment: "RIGHT",
    timerStyle: "GROUPED",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 14,
    titleFontSize: 22,
    subheadingFontSize: 14,
    timerFontSize: 32,
    legendFontSize: 12,
    paddingBlock: 16,
    paddingInline: 20,
    contentGap: 12,
  },
  CTA_TOP: {
    showButton: true,
    alignment: "CENTER",
    timerStyle: "PLAIN",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 14,
    titleFontSize: 20,
    subheadingFontSize: 13,
    timerFontSize: 32,
    legendFontSize: 11,
    paddingBlock: 16,
    paddingInline: 20,
    contentGap: 12,
  },
  HERO_TIMER: {
    showButton: true,
    alignment: "CENTER",
    timerStyle: "BOXES",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 15,
    titleFontSize: 22,
    subheadingFontSize: 14,
    timerFontSize: 52,
    legendFontSize: 12,
    paddingBlock: 24,
    paddingInline: 28,
    contentGap: 14,
    contentMaxWidth: 720,
  },
  SIDE_RAIL: {
    showButton: true,
    alignment: "LEFT",
    timerStyle: "BOXES",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 14,
    titleFontSize: 22,
    subheadingFontSize: 14,
    timerFontSize: 30,
    legendFontSize: 11,
    paddingBlock: 18,
    paddingInline: 22,
    contentGap: 16,
    contentMaxWidth: 640,
  },
  SPREAD: {
    showButton: true,
    alignment: "CENTER",
    timerStyle: "GROUPED",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 14,
    titleFontSize: 20,
    subheadingFontSize: 13,
    timerFontSize: 30,
    legendFontSize: 11,
    paddingBlock: 16,
    paddingInline: 28,
    contentGap: 16,
    contentMaxWidth: 1100,
  },
  MOBILE_BANNER: {
    showButton: true,
    alignment: "CENTER",
    timerStyle: "PLAIN",
    timerFormat: "COLON",
    timerShowLabels: false,
    fontSize: 13,
    titleFontSize: 17,
    subheadingFontSize: 12,
    timerFontSize: 22,
    legendFontSize: 10,
    paddingBlock: 12,
    paddingInline: 16,
    contentGap: 8,
    contentMaxWidth: 520,
  },
  MOBILE_CARD: {
    showButton: true,
    alignment: "CENTER",
    timerStyle: "BOXES",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 14,
    titleFontSize: 19,
    subheadingFontSize: 13,
    timerFontSize: 26,
    legendFontSize: 10,
    paddingBlock: 18,
    paddingInline: 18,
    contentGap: 12,
    borderRadius: 16,
    contentMaxWidth: 440,
  },
  MOBILE_SHEET: {
    showButton: true,
    alignment: "CENTER",
    timerStyle: "GROUPED",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 14,
    titleFontSize: 18,
    subheadingFontSize: 13,
    timerFontSize: 28,
    legendFontSize: 11,
    paddingBlock: 18,
    paddingInline: 20,
    contentGap: 12,
    borderRadius: 20,
    contentMaxWidth: 560,
  },
  MOBILE_COMPACT_BAR: {
    showButton: true,
    alignment: "LEFT",
    timerStyle: "PLAIN",
    timerFormat: "COLON",
    timerShowLabels: false,
    fontSize: 12,
    titleFontSize: 14,
    subheadingFontSize: 11,
    timerFontSize: 16,
    legendFontSize: 9,
    paddingBlock: 8,
    paddingInline: 12,
    contentGap: 8,
    contentMaxWidth: 600,
  },
  MOBILE_SPOTLIGHT: {
    showButton: true,
    alignment: "CENTER",
    timerStyle: "BOXES",
    timerFormat: "UNITS",
    timerShowLabels: true,
    fontSize: 14,
    titleFontSize: 18,
    subheadingFontSize: 13,
    timerFontSize: 40,
    legendFontSize: 11,
    paddingBlock: 22,
    paddingInline: 18,
    contentGap: 14,
    contentMaxWidth: 420,
  },
};

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

  if (
    isValidHexColor(values.buttonHoverColor) &&
    isValidHexColor(values.buttonTextHoverColor) &&
    !hasReadableContrast(values.buttonTextHoverColor, values.buttonHoverColor)
  ) {
    errors.buttonTextHoverColor =
      "Button hover text color needs stronger contrast with button hover color.";
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
    !designBackgroundImageSizeOptions.some(
      (option) => option.value === values.backgroundImageSize,
    )
  ) {
    errors.backgroundImageSize = "Choose a valid image size mode.";
  }

  if (
    !designBackgroundImagePositionOptions.some(
      (option) => option.value === values.backgroundImagePosition,
    )
  ) {
    errors.backgroundImagePosition = "Choose a valid image position.";
  }

  if (
    !designBackgroundImageRepeatOptions.some(
      (option) => option.value === values.backgroundImageRepeat,
    )
  ) {
    errors.backgroundImageRepeat = "Choose a valid image repeat mode.";
  }

  if (
    !designBackgroundImageAttachmentOptions.some(
      (option) => option.value === values.backgroundImageAttachment,
    )
  ) {
    errors.backgroundImageAttachment = "Choose a valid image attachment mode.";
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
  validateIntegerRange(
    values,
    errors,
    "timerNumberFontSize",
    12,
    72,
    "Timer number size",
  );
  validateIntegerRange(
    values,
    errors,
    "timerLabelFontSize",
    8,
    28,
    "Timer label size",
  );
  validateIntegerRange(values, errors, "timerGap", 0, 32, "Timer gap");
  validateIntegerRange(
    values,
    errors,
    "timerUnitGap",
    0,
    18,
    "Timer number-label gap",
  );
  validateIntegerRange(
    values,
    errors,
    "timerPaddingBlock",
    0,
    32,
    "Timer vertical padding",
  );
  validateIntegerRange(
    values,
    errors,
    "timerPaddingInline",
    0,
    40,
    "Timer horizontal padding",
  );
  validateIntegerRange(
    values,
    errors,
    "closeButtonSize",
    12,
    44,
    "Close icon size",
  );

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

  if (
    !designTimerNumberLayoutOptions.some(
      (option) => option.value === values.timerNumberLayout,
    )
  ) {
    errors.timerNumberLayout = "Choose a valid timer number layout.";
  }

  if (
    !designDismissBehaviorOptions.some(
      (option) => option.value === values.dismissBehavior,
    )
  ) {
    errors.dismissBehavior = "Choose a valid close behavior.";
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
  validateIntegerRange(
    values,
    errors,
    "positionStickyZIndex",
    0,
    2147483647,
    "Sticky z-index",
  );

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

  validateIntegerRange(
    values,
    errors,
    "timerTickDurationMs",
    0,
    1500,
    "Timer change duration",
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

  if (
    !designOfferCodeLayoutOptions.some(
      (option) => option.value === values.offerCodeLayout,
    )
  ) {
    errors.offerCodeLayout = "Choose a valid offer layout.";
  }

  if (
    !designOfferCopyBehaviorOptions.some(
      (option) => option.value === values.offerCopyBehavior,
    )
  ) {
    errors.offerCopyBehavior = "Choose a valid copy behavior.";
  }

  if (
    !designOfferApplyBehaviorOptions.some(
      (option) => option.value === values.offerApplyBehavior,
    )
  ) {
    errors.offerApplyBehavior = "Choose a valid apply behavior.";
  }

  validateTextField(values, errors, "offerCodeLabel", "Code label", 32);
  validateTextField(values, errors, "copyCodeLabel", "Copy label", 24);
  validateTextField(values, errors, "copiedCodeLabel", "Copied label", 24);
  validateTextField(values, errors, "applyDiscountLabel", "Apply label", 28);
  validateTextField(
    values,
    errors,
    "appliedDiscountMessage",
    "Applied message",
    80,
  );
  validateIntegerRange(
    values,
    errors,
    "offerCodeFontSize",
    10,
    24,
    "Offer code font size",
  );
  validateIntegerRange(
    values,
    errors,
    "offerCodeBorderRadius",
    0,
    40,
    "Offer code radius",
  );
  validateIntegerRange(
    values,
    errors,
    "offerCodePaddingBlock",
    2,
    24,
    "Offer vertical padding",
  );
  validateIntegerRange(
    values,
    errors,
    "offerCodePaddingInline",
    4,
    32,
    "Offer horizontal padding",
  );
  validateIntegerRange(values, errors, "offerCodeGap", 0, 24, "Offer gap");
  validateIntegerRange(
    values,
    errors,
    "copyButtonFontSize",
    10,
    24,
    "Copy button font size",
  );
  validateIntegerRange(
    values,
    errors,
    "copyButtonBorderRadius",
    0,
    40,
    "Copy button radius",
  );
  validateIntegerRange(
    values,
    errors,
    "applyButtonFontSize",
    10,
    24,
    "Apply button font size",
  );
  validateIntegerRange(
    values,
    errors,
    "applyButtonBorderRadius",
    0,
    40,
    "Apply button radius",
  );

  if (
    isValidHexColor(values.offerCodeTextColor) &&
    isValidHexColor(values.offerCodeBackgroundColor) &&
    !hasReadableContrast(
      values.offerCodeTextColor,
      values.offerCodeBackgroundColor,
      3,
    )
  ) {
    errors.offerCodeTextColor =
      "Offer code text needs stronger contrast with its background.";
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

function validateTextField(
  values: CampaignDesignValues,
  errors: CampaignDesignErrors,
  field: keyof CampaignDesignValues,
  label: string,
  maxLength: number,
) {
  const value = values[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    errors[field] = `${label} is required.`;
    return;
  }

  if (value.length > maxLength) {
    errors[field] = `${label} must be ${maxLength} characters or fewer.`;
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
