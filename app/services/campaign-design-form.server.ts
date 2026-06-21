import type { ShopPlan } from "@prisma/client";

import {
  defaultCampaignDesignValues,
  type CampaignDesignErrors,
  type CampaignDesignValues,
  type DesignBackgroundTypeValue,
  type DesignBannerAnimationValue,
  type DesignPositionModeValue,
  type DesignFontFamilyValue,
  type DesignLayoutValue,
  type DesignTimerTickAnimationValue,
  type DesignTimerFormatValue,
  type DesignTimerStyleValue,
  type CampaignDesignIconValue,
  type DesignAlignmentValue,
} from "../types/campaign-design";
import {
  hasCampaignDesignErrors,
  sanitizeCustomCss,
  validateCampaignDesignValues,
} from "../utils/campaign-design";
import { canUseFeature } from "./planLimits.server";

export type ParsedCampaignDesignForm = {
  values: CampaignDesignValues;
  errors: CampaignDesignErrors;
};

export function parseCampaignDesignFormData(
  formData: FormData,
  plan: ShopPlan,
): ParsedCampaignDesignForm {
  const customCssGate = canUseFeature({ plan }, "custom_css");
  const canUseCustomCss = customCssGate.allowed;
  const values: CampaignDesignValues = {
    templateKey: readString(formData, "templateKey") || "clean-minimal",
    layout: readLayout(formData),
    backgroundType: readBackgroundType(formData),
    backgroundColor:
      readString(formData, "backgroundColor") ||
      defaultCampaignDesignValues.backgroundColor,
    backgroundImageUrl: readString(formData, "backgroundImageUrl").slice(
      0,
      1000,
    ),
    gradientStartColor:
      readString(formData, "gradientStartColor") ||
      defaultCampaignDesignValues.gradientStartColor,
    gradientEndColor:
      readString(formData, "gradientEndColor") ||
      defaultCampaignDesignValues.gradientEndColor,
    gradientAngle: readInteger(
      formData,
      "gradientAngle",
      defaultCampaignDesignValues.gradientAngle,
    ),
    textColor:
      readString(formData, "textColor") ||
      defaultCampaignDesignValues.textColor,
    accentColor:
      readString(formData, "accentColor") ||
      defaultCampaignDesignValues.accentColor,
    buttonColor:
      readString(formData, "buttonColor") ||
      defaultCampaignDesignValues.buttonColor,
    buttonTextColor:
      readString(formData, "buttonTextColor") ||
      defaultCampaignDesignValues.buttonTextColor,
    closeButtonColor:
      readString(formData, "closeButtonColor") ||
      defaultCampaignDesignValues.closeButtonColor,
    fontSize: readInteger(
      formData,
      "fontSize",
      defaultCampaignDesignValues.fontSize,
    ),
    borderRadius: readInteger(
      formData,
      "borderRadius",
      defaultCampaignDesignValues.borderRadius,
    ),
    borderSize: readInteger(
      formData,
      "borderSize",
      defaultCampaignDesignValues.borderSize,
    ),
    borderColor:
      readString(formData, "borderColor") ||
      defaultCampaignDesignValues.borderColor,
    fontFamily: readFontFamily(formData),
    titleFontSize: readInteger(
      formData,
      "titleFontSize",
      defaultCampaignDesignValues.titleFontSize,
    ),
    titleColor:
      readString(formData, "titleColor") ||
      defaultCampaignDesignValues.titleColor,
    subheadingFontSize: readInteger(
      formData,
      "subheadingFontSize",
      defaultCampaignDesignValues.subheadingFontSize,
    ),
    subheadingColor:
      readString(formData, "subheadingColor") ||
      defaultCampaignDesignValues.subheadingColor,
    timerFontSize: readInteger(
      formData,
      "timerFontSize",
      defaultCampaignDesignValues.timerFontSize,
    ),
    timerColor:
      readString(formData, "timerColor") ||
      defaultCampaignDesignValues.timerColor,
    legendFontSize: readInteger(
      formData,
      "legendFontSize",
      defaultCampaignDesignValues.legendFontSize,
    ),
    legendColor:
      readString(formData, "legendColor") ||
      defaultCampaignDesignValues.legendColor,
    timerStyle: readTimerStyle(formData),
    timerFormat: readTimerFormat(formData),
    timerShowLabels: readBoolean(formData, "timerShowLabels"),
    timerShowSeconds: readBoolean(formData, "timerShowSeconds"),
    timerDaysLabel:
      readString(formData, "timerDaysLabel") ||
      defaultCampaignDesignValues.timerDaysLabel,
    timerHoursLabel:
      readString(formData, "timerHoursLabel") ||
      defaultCampaignDesignValues.timerHoursLabel,
    timerMinutesLabel:
      readString(formData, "timerMinutesLabel") ||
      defaultCampaignDesignValues.timerMinutesLabel,
    timerSecondsLabel:
      readString(formData, "timerSecondsLabel") ||
      defaultCampaignDesignValues.timerSecondsLabel,
    timerHideZeroDays: readBoolean(formData, "timerHideZeroDays"),
    timerSurfaceColor:
      readString(formData, "timerSurfaceColor") ||
      defaultCampaignDesignValues.timerSurfaceColor,
    timerSurfaceBorderColor:
      readString(formData, "timerSurfaceBorderColor") ||
      defaultCampaignDesignValues.timerSurfaceBorderColor,
    timerSurfaceBorderSize: readInteger(
      formData,
      "timerSurfaceBorderSize",
      defaultCampaignDesignValues.timerSurfaceBorderSize,
    ),
    timerSurfaceRadius: readInteger(
      formData,
      "timerSurfaceRadius",
      defaultCampaignDesignValues.timerSurfaceRadius,
    ),
    paddingBlock: readInteger(
      formData,
      "paddingBlock",
      defaultCampaignDesignValues.paddingBlock,
    ),
    paddingInline: readInteger(
      formData,
      "paddingInline",
      defaultCampaignDesignValues.paddingInline,
    ),
    contentGap: readInteger(
      formData,
      "contentGap",
      defaultCampaignDesignValues.contentGap,
    ),
    contentMaxWidth: readInteger(
      formData,
      "contentMaxWidth",
      defaultCampaignDesignValues.contentMaxWidth,
    ),
    fullWidth: readBoolean(formData, "fullWidth"),
    positionMode: readPositionMode(formData),
    positionSticky: readBoolean(formData, "positionSticky"),
    entranceAnimation: readBannerAnimation(formData, "entranceAnimation"),
    exitAnimation: readBannerAnimation(formData, "exitAnimation"),
    animationDurationMs: readInteger(
      formData,
      "animationDurationMs",
      defaultCampaignDesignValues.animationDurationMs,
    ),
    timerTickAnimation: readTimerTickAnimation(formData),
    mobileEnabled: readBoolean(formData, "mobileEnabled"),
    customCss: sanitizeCustomCss(
      readString(formData, "customCss"),
      canUseCustomCss,
    ),
    alignment: readAlignment(formData),
    showCloseButton: readBoolean(formData, "showCloseButton"),
    showButton: readBoolean(formData, "showButton"),
    showIcon: readBoolean(formData, "showIcon"),
    icon: readIcon(formData),
    iconSize: readInteger(
      formData,
      "iconSize",
      defaultCampaignDesignValues.iconSize,
    ),
    customIconUrl: readString(formData, "customIconUrl").slice(0, 150_000),
  };

  const errors = validateCampaignDesignValues(values);

  if (!canUseCustomCss && readString(formData, "customCss").length > 0) {
    errors.customCss = customCssGate.reason;
  }

  return { values, errors };
}

export { hasCampaignDesignErrors };

function readString(formData: FormData, key: keyof CampaignDesignValues) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readInteger(
  formData: FormData,
  key: keyof CampaignDesignValues,
  fallback: number,
) {
  const value = Number(readString(formData, key));

  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function readBoolean(formData: FormData, key: keyof CampaignDesignValues) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readLayout(formData: FormData): DesignLayoutValue {
  const value = readString(formData, "layout");

  if (
    [
      "STANDARD",
      "BALANCED",
      "INLINE",
      "CTA_RIGHT",
      "CTA_LEFT",
      "CTA_TOP",
    ].includes(value)
  ) {
    return value as DesignLayoutValue;
  }

  return defaultCampaignDesignValues.layout;
}

function readBackgroundType(formData: FormData): DesignBackgroundTypeValue {
  const value = readString(formData, "backgroundType");

  if (["SOLID", "GRADIENT", "IMAGE"].includes(value)) {
    return value as DesignBackgroundTypeValue;
  }

  return defaultCampaignDesignValues.backgroundType;
}

function readFontFamily(formData: FormData): DesignFontFamilyValue {
  const value = readString(formData, "fontFamily");

  if (
    [
      "THEME",
      "SYSTEM",
      "SERIF",
      "ROUNDED",
      "MONO",
      "GEOMETRIC",
      "HUMANIST",
      "CONDENSED",
      "CASUAL",
    ].includes(value)
  ) {
    return value as DesignFontFamilyValue;
  }

  return defaultCampaignDesignValues.fontFamily;
}

function readTimerFormat(formData: FormData): DesignTimerFormatValue {
  const value = readString(formData, "timerFormat");

  if (["UNITS", "COLON"].includes(value)) {
    return value as DesignTimerFormatValue;
  }

  return defaultCampaignDesignValues.timerFormat;
}

function readTimerStyle(formData: FormData): DesignTimerStyleValue {
  const value = readString(formData, "timerStyle");

  if (["PLAIN", "GROUPED", "BOXES"].includes(value)) {
    return value as DesignTimerStyleValue;
  }

  return defaultCampaignDesignValues.timerStyle;
}

function readPositionMode(formData: FormData): DesignPositionModeValue {
  const value = readString(formData, "positionMode");

  if (["FLOW", "OVERLAY"].includes(value)) {
    return value as DesignPositionModeValue;
  }

  return defaultCampaignDesignValues.positionMode;
}

function readBannerAnimation(
  formData: FormData,
  key: "entranceAnimation" | "exitAnimation",
): DesignBannerAnimationValue {
  const value = readString(formData, key);

  if (["NONE", "FADE", "SLIDE", "POP"].includes(value)) {
    return value as DesignBannerAnimationValue;
  }

  return defaultCampaignDesignValues[key];
}

function readTimerTickAnimation(
  formData: FormData,
): DesignTimerTickAnimationValue {
  const value = readString(formData, "timerTickAnimation");

  if (["NONE", "FADE", "FLIP", "PULSE"].includes(value)) {
    return value as DesignTimerTickAnimationValue;
  }

  return defaultCampaignDesignValues.timerTickAnimation;
}

function readAlignment(formData: FormData): DesignAlignmentValue {
  const value = readString(formData, "alignment");

  if (["LEFT", "CENTER", "RIGHT"].includes(value)) {
    return value as DesignAlignmentValue;
  }

  return defaultCampaignDesignValues.alignment;
}

function readIcon(formData: FormData): CampaignDesignIconValue {
  const value = readString(formData, "icon");

  if (
    ["FIRE", "CLOCK", "TRUCK", "GIFT", "TAG", "CUSTOM", "NONE"].includes(value)
  ) {
    return value as CampaignDesignIconValue;
  }

  return defaultCampaignDesignValues.icon;
}
