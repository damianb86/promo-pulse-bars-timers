import type { ShopPlan } from "@prisma/client";

import {
  defaultCampaignDesignValues,
  designLayoutOptions,
  type CampaignDesignErrors,
  type CampaignDesignValues,
  type DesignBackgroundTypeValue,
  type DesignBannerAnimationValue,
  type DesignPositionModeValue,
  type DesignFloatPositionValue,
  type DesignFontFamilyValue,
  type DesignLayoutValue,
  type DesignTimerTickAnimationValue,
  type DesignTimerFormatValue,
  type DesignTimerStyleValue,
  type CampaignDesignIconValue,
  type DesignAlignmentValue,
  type DesignDismissBehaviorValue,
  type DesignOfferApplyBehaviorValue,
  type DesignOfferCodeLayoutValue,
  type DesignOfferCopyBehaviorValue,
  type DesignTimerNumberLayoutValue,
} from "../types/campaign-design";
import {
  hasCampaignDesignErrors,
  sanitizeCustomCss,
  validateCampaignDesignValues,
} from "../utils/campaign-design";
import { deriveMobileDesignFromDesktop } from "../utils/responsive-design";
import {
  sanitizeStructureCss,
  sanitizeStructureHtml,
} from "../utils/structure-html";
import {
  parseCustomMessages,
  serializeCustomMessages,
} from "../utils/custom-messages";
import { canUseFeature } from "./planLimits.server";

export type ParsedCampaignDesignForm = {
  values: CampaignDesignValues;
  errors: CampaignDesignErrors;
};

export type ParsedResponsiveCampaignDesignForm = ParsedCampaignDesignForm & {
  mobileValues: CampaignDesignValues;
};

export function parseCampaignDesignFormData(
  formData: FormData,
  plan: ShopPlan,
): ParsedCampaignDesignForm {
  const customCssGate = canUseFeature({ plan }, "custom_css");
  const canUseCustomCss = customCssGate.allowed;
  const icon = readIcon(formData);
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
    backgroundImageSize: readBackgroundImageSize(formData),
    backgroundImagePosition: readBackgroundImagePosition(formData),
    backgroundImageRepeat: readBackgroundImageRepeat(formData),
    backgroundImageAttachment: readBackgroundImageAttachment(formData),
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
    buttonHoverColor:
      readString(formData, "buttonHoverColor") ||
      defaultCampaignDesignValues.buttonHoverColor,
    buttonTextHoverColor:
      readString(formData, "buttonTextHoverColor") ||
      defaultCampaignDesignValues.buttonTextHoverColor,
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
    timerNumberFontSize: readInteger(
      formData,
      "timerNumberFontSize",
      defaultCampaignDesignValues.timerNumberFontSize,
    ),
    timerLabelFontSize: readInteger(
      formData,
      "timerLabelFontSize",
      defaultCampaignDesignValues.timerLabelFontSize,
    ),
    timerGap: readInteger(
      formData,
      "timerGap",
      defaultCampaignDesignValues.timerGap,
    ),
    timerUnitGap: readInteger(
      formData,
      "timerUnitGap",
      defaultCampaignDesignValues.timerUnitGap,
    ),
    timerPaddingBlock: readInteger(
      formData,
      "timerPaddingBlock",
      defaultCampaignDesignValues.timerPaddingBlock,
    ),
    timerPaddingInline: readInteger(
      formData,
      "timerPaddingInline",
      defaultCampaignDesignValues.timerPaddingInline,
    ),
    timerStyle: readTimerStyle(formData),
    timerFormat: readTimerFormat(formData),
    timerNumberLayout: readTimerNumberLayout(formData),
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
    marginTop: readInteger(
      formData,
      "marginTop",
      defaultCampaignDesignValues.marginTop,
    ),
    marginBottom: readInteger(
      formData,
      "marginBottom",
      defaultCampaignDesignValues.marginBottom,
    ),
    marginLeft: readInteger(
      formData,
      "marginLeft",
      defaultCampaignDesignValues.marginLeft,
    ),
    marginRight: readInteger(
      formData,
      "marginRight",
      defaultCampaignDesignValues.marginRight,
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
    positionStickyZIndex: readInteger(
      formData,
      "positionStickyZIndex",
      defaultCampaignDesignValues.positionStickyZIndex,
    ),
    floatPosition: readFloatPosition(formData),
    floatOffsetTop: readOffset(formData, "floatOffsetTop", "0"),
    floatOffsetBottom: readOffset(formData, "floatOffsetBottom", "auto"),
    floatOffsetLeft: readOffset(formData, "floatOffsetLeft", "0"),
    floatOffsetRight: readOffset(formData, "floatOffsetRight", "0"),
    entranceAnimation: readBannerAnimation(formData, "entranceAnimation"),
    exitAnimation: readBannerAnimation(formData, "exitAnimation"),
    animationDurationMs: readInteger(
      formData,
      "animationDurationMs",
      defaultCampaignDesignValues.animationDurationMs,
    ),
    timerTickAnimation: readTimerTickAnimation(formData),
    timerTickDurationMs: readInteger(
      formData,
      "timerTickDurationMs",
      defaultCampaignDesignValues.timerTickDurationMs,
    ),
    separateMobileDesign: readBoolean(formData, "separateMobileDesign"),
    mobileEnabled: readBoolean(formData, "mobileEnabled"),
    customCss: sanitizeCustomCss(
      readString(formData, "customCss"),
      canUseCustomCss,
    ),
    alignment: readAlignment(formData),
    showCloseButton: readBoolean(formData, "showCloseButton"),
    closeButtonSize: readInteger(
      formData,
      "closeButtonSize",
      defaultCampaignDesignValues.closeButtonSize,
    ),
    dismissBehavior: readDismissBehavior(formData),
    showButton: readBoolean(formData, "showButton"),
    showProgressBar: readBoolean(formData, "showProgressBar"),
    progressTarget:
      readString(formData, "progressTarget") === "TIMER"
        ? "TIMER"
        : "FREE_SHIPPING",
    progressBarStyle: readProgressBarStyle(formData),
    progressSteps: readInteger(
      formData,
      "progressSteps",
      defaultCampaignDesignValues.progressSteps,
    ),
    progressHeight: readInteger(
      formData,
      "progressHeight",
      defaultCampaignDesignValues.progressHeight,
    ),
    progressRadius: readInteger(
      formData,
      "progressRadius",
      defaultCampaignDesignValues.progressRadius,
    ),
    progressTrackColor:
      readString(formData, "progressTrackColor") ||
      defaultCampaignDesignValues.progressTrackColor,
    progressFillColor:
      readString(formData, "progressFillColor") ||
      defaultCampaignDesignValues.progressFillColor,
    progressTextColor:
      readString(formData, "progressTextColor") ||
      defaultCampaignDesignValues.progressTextColor,
    progressEffect: readProgressEffect(formData),
    progressShowLabel: readBoolean(formData, "progressShowLabel"),
    showIcon: icon !== "NONE",
    icon,
    iconSize: readInteger(
      formData,
      "iconSize",
      defaultCampaignDesignValues.iconSize,
    ),
    customIconUrl: readString(formData, "customIconUrl").slice(0, 150_000),
    showDiscountCode: readBoolean(formData, "showDiscountCode"),
    showCopyCodeButton: readBoolean(formData, "showCopyCodeButton"),
    showApplyDiscountButton: readBoolean(formData, "showApplyDiscountButton"),
    offerCodeLayout: readOfferCodeLayout(formData),
    offerCodeLabel:
      readString(formData, "offerCodeLabel") ||
      defaultCampaignDesignValues.offerCodeLabel,
    copyCodeLabel:
      readString(formData, "copyCodeLabel") ||
      defaultCampaignDesignValues.copyCodeLabel,
    copiedCodeLabel:
      readString(formData, "copiedCodeLabel") ||
      defaultCampaignDesignValues.copiedCodeLabel,
    applyDiscountLabel:
      readString(formData, "applyDiscountLabel") ||
      defaultCampaignDesignValues.applyDiscountLabel,
    appliedDiscountMessage:
      readString(formData, "appliedDiscountMessage") ||
      defaultCampaignDesignValues.appliedDiscountMessage,
    offerCodeTextColor:
      readString(formData, "offerCodeTextColor") ||
      defaultCampaignDesignValues.offerCodeTextColor,
    offerCodeBackgroundColor:
      readString(formData, "offerCodeBackgroundColor") ||
      defaultCampaignDesignValues.offerCodeBackgroundColor,
    offerCodeBorderColor:
      readString(formData, "offerCodeBorderColor") ||
      defaultCampaignDesignValues.offerCodeBorderColor,
    offerCodeFontSize: readInteger(
      formData,
      "offerCodeFontSize",
      defaultCampaignDesignValues.offerCodeFontSize,
    ),
    offerCodeBorderRadius: readInteger(
      formData,
      "offerCodeBorderRadius",
      defaultCampaignDesignValues.offerCodeBorderRadius,
    ),
    offerCodePaddingBlock: readInteger(
      formData,
      "offerCodePaddingBlock",
      defaultCampaignDesignValues.offerCodePaddingBlock,
    ),
    offerCodePaddingInline: readInteger(
      formData,
      "offerCodePaddingInline",
      defaultCampaignDesignValues.offerCodePaddingInline,
    ),
    offerCodeGap: readInteger(
      formData,
      "offerCodeGap",
      defaultCampaignDesignValues.offerCodeGap,
    ),
    copyButtonBackgroundColor:
      readString(formData, "copyButtonBackgroundColor") ||
      defaultCampaignDesignValues.copyButtonBackgroundColor,
    copyButtonTextColor:
      readString(formData, "copyButtonTextColor") ||
      defaultCampaignDesignValues.copyButtonTextColor,
    copyButtonBorderColor:
      readString(formData, "copyButtonBorderColor") ||
      defaultCampaignDesignValues.copyButtonBorderColor,
    copyButtonFontSize: readInteger(
      formData,
      "copyButtonFontSize",
      defaultCampaignDesignValues.copyButtonFontSize,
    ),
    copyButtonBorderRadius: readInteger(
      formData,
      "copyButtonBorderRadius",
      defaultCampaignDesignValues.copyButtonBorderRadius,
    ),
    applyButtonBackgroundColor:
      readString(formData, "applyButtonBackgroundColor") ||
      defaultCampaignDesignValues.applyButtonBackgroundColor,
    applyButtonTextColor:
      readString(formData, "applyButtonTextColor") ||
      defaultCampaignDesignValues.applyButtonTextColor,
    applyButtonBorderColor:
      readString(formData, "applyButtonBorderColor") ||
      defaultCampaignDesignValues.applyButtonBorderColor,
    applyButtonFontSize: readInteger(
      formData,
      "applyButtonFontSize",
      defaultCampaignDesignValues.applyButtonFontSize,
    ),
    applyButtonBorderRadius: readInteger(
      formData,
      "applyButtonBorderRadius",
      defaultCampaignDesignValues.applyButtonBorderRadius,
    ),
    offerCopyBehavior: readOfferCopyBehavior(formData),
    offerApplyBehavior: readOfferApplyBehavior(formData),
  };

  const errors = validateCampaignDesignValues(values);

  if (!canUseCustomCss && readString(formData, "customCss").length > 0) {
    errors.customCss = customCssGate.reason;
  }

  return { values, errors };
}

export function parseResponsiveCampaignDesignFormData(
  formData: FormData,
  plan: ShopPlan,
): ParsedResponsiveCampaignDesignForm {
  const desktop = parseCampaignDesignFormData(formData, plan);

  if (!desktop.values.separateMobileDesign) {
    return {
      values: desktop.values,
      mobileValues: deriveMobileDesignFromDesktop(desktop.values),
      errors: desktop.errors,
    };
  }

  const mobile = parseMobileCampaignDesignFormData(
    formData,
    plan,
    desktop.values,
  );
  const errors: CampaignDesignErrors = {
    ...desktop.errors,
    ...(hasCampaignDesignErrors(mobile.errors)
      ? {
          form:
            mobile.errors.form ??
            "Mobile design has invalid settings. Switch the preview to Mobile and check the design fields.",
        }
      : {}),
  };

  return {
    values: desktop.values,
    mobileValues: mobile.values,
    errors,
  };
}

export { hasCampaignDesignErrors };

export type ParsedCampaignStructureForm = {
  // Sanitized hand-edited structural HTML, or null when the merchant has not
  // overridden the auto-generated structure (regenerate from settings).
  editedHtml: string | null;
  // Sanitized hand-edited CSS override, or null to regenerate CSS from settings.
  editedCss: string | null;
  // Mobile override (only when "Separate desktop and mobile" is on and the
  // mobile HTML was edited). null means the mobile surface reuses desktop.
  editedMobileHtml: string | null;
  editedMobileCss: string | null;
  // Custom reusable message snippets (JSON array of {id, text}), shared across
  // desktop + mobile, placed in the custom HTML via data-cp-slot="custom-<id>".
  // undefined when the form did not include the field (leave the stored value
  // unchanged instead of wiping it).
  messages: string | undefined;
};

// Reads the optional structural-HTML + CSS override coming from the design
// editor's HTML/CSS modals. Both are sanitized here before reaching the model.
export function parseCampaignStructureForm(
  formData: FormData,
): ParsedCampaignStructureForm {
  const edited = readFormString(formData, "structureEdited") === "true";
  const mobileEdited =
    readFormString(formData, "mobileStructureEdited") === "true";

  return {
    editedHtml: edited
      ? sanitizeStructureHtml(readFormString(formData, "structureHtml")) || null
      : null,
    editedCss: edited
      ? sanitizeStructureCss(readFormString(formData, "structureCss")) || null
      : null,
    editedMobileHtml: mobileEdited
      ? sanitizeStructureHtml(
          readFormString(formData, "mobileStructureHtml"),
        ) || null
      : null,
    editedMobileCss: mobileEdited
      ? sanitizeStructureCss(readFormString(formData, "mobileStructureCss")) ||
        null
      : null,
    messages: formData.has("structureMessages")
      ? serializeCustomMessages(
          parseCustomMessages(readFormString(formData, "structureMessages")),
        )
      : undefined,
  };
}

function readString(formData: FormData, key: keyof CampaignDesignValues) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseMobileCampaignDesignFormData(
  formData: FormData,
  plan: ShopPlan,
  desktopValues: CampaignDesignValues,
) {
  const mobileDesignJson = readFormString(formData, "mobileDesignJson");

  if (!mobileDesignJson) {
    return {
      values: desktopValues,
      errors: {},
    };
  }

  try {
    const parsed = JSON.parse(mobileDesignJson) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid mobile design payload.");
    }

    return parseCampaignDesignFormData(
      createCampaignDesignFormData({
        ...desktopValues,
        ...(parsed as Partial<CampaignDesignValues>),
      }),
      plan,
    );
  } catch {
    return {
      values: desktopValues,
      errors: {
        form: "Mobile design could not be read. Refresh the page and try again.",
      },
    };
  }
}

function createCampaignDesignFormData(values: CampaignDesignValues) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(
      key,
      typeof value === "boolean" ? String(value) : String(value),
    );
  }

  return formData;
}

function readInteger(
  formData: FormData,
  key: keyof CampaignDesignValues,
  fallback: number,
) {
  const raw = readString(formData, key);

  // An absent field reads as "" and Number("") === 0, which would silently
  // override sensible defaults (e.g. closeButtonSize) with 0; fall back instead.
  if (!raw) return fallback;

  const value = Number(raw);

  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function readBoolean(formData: FormData, key: keyof CampaignDesignValues) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readLayout(formData: FormData): DesignLayoutValue {
  const value = readString(formData, "layout");

  if (designLayoutOptions.some((option) => option.value === value)) {
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

function readBackgroundImageSize(formData: FormData) {
  const value = readString(formData, "backgroundImageSize");

  if (["COVER", "CONTAIN", "AUTO", "STRETCH"].includes(value)) {
    return value;
  }

  return defaultCampaignDesignValues.backgroundImageSize;
}

function readBackgroundImagePosition(formData: FormData) {
  const value = readString(formData, "backgroundImagePosition");

  if (
    [
      "CENTER",
      "TOP",
      "BOTTOM",
      "LEFT",
      "RIGHT",
      "TOP_LEFT",
      "TOP_RIGHT",
      "BOTTOM_LEFT",
      "BOTTOM_RIGHT",
    ].includes(value)
  ) {
    return value;
  }

  return defaultCampaignDesignValues.backgroundImagePosition;
}

function readBackgroundImageRepeat(formData: FormData) {
  const value = readString(formData, "backgroundImageRepeat");

  if (["NO_REPEAT", "REPEAT", "REPEAT_X", "REPEAT_Y"].includes(value)) {
    return value;
  }

  return defaultCampaignDesignValues.backgroundImageRepeat;
}

function readBackgroundImageAttachment(formData: FormData) {
  const value = readString(formData, "backgroundImageAttachment");

  if (["SCROLL", "FIXED", "LOCAL"].includes(value)) {
    return value;
  }

  return defaultCampaignDesignValues.backgroundImageAttachment;
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

function readProgressBarStyle(
  formData: FormData,
): CampaignDesignValues["progressBarStyle"] {
  const value = readString(formData, "progressBarStyle");
  if (["BAR", "STEPS", "CIRCLE"].includes(value)) {
    return value as CampaignDesignValues["progressBarStyle"];
  }
  return defaultCampaignDesignValues.progressBarStyle;
}

function readProgressEffect(
  formData: FormData,
): CampaignDesignValues["progressEffect"] {
  const value = readString(formData, "progressEffect");
  if (["NONE", "FILL", "SHIMMER"].includes(value)) {
    return value as CampaignDesignValues["progressEffect"];
  }
  return defaultCampaignDesignValues.progressEffect;
}

function readTimerStyle(formData: FormData): DesignTimerStyleValue {
  const value = readString(formData, "timerStyle");

  if (["PLAIN", "GROUPED", "BOXES"].includes(value)) {
    return value as DesignTimerStyleValue;
  }

  return defaultCampaignDesignValues.timerStyle;
}

function readTimerNumberLayout(
  formData: FormData,
): DesignTimerNumberLayoutValue {
  const value = readString(formData, "timerNumberLayout");

  if (value === "INLINE" || value === "STACKED") {
    return value;
  }

  return defaultCampaignDesignValues.timerNumberLayout;
}

function readPositionMode(formData: FormData): DesignPositionModeValue {
  const value = readString(formData, "positionMode");

  if (["FLOW", "OVERLAY"].includes(value)) {
    return value as DesignPositionModeValue;
  }

  return defaultCampaignDesignValues.positionMode;
}

function readFloatPosition(formData: FormData): DesignFloatPositionValue {
  const value = readString(formData, "floatPosition").toUpperCase();

  if (["ABSOLUTE", "FIXED"].includes(value)) {
    return value as DesignFloatPositionValue;
  }

  return defaultCampaignDesignValues.floatPosition;
}

// Float offsets accept a CSS length ("0", "20px", "10%", "1rem") or "auto".
// We keep them as sanitized strings so merchants can pin a banner precisely
// while the defaults (top/left/right 0, bottom auto) keep it full-width.
function readOffset(
  formData: FormData,
  key: keyof CampaignDesignValues,
  fallback: string,
): string {
  const raw = readString(formData, key).trim().toLowerCase();

  if (!raw) return fallback;
  if (raw === "auto") return "auto";

  // Bare number -> pixels.
  if (/^-?\d+(\.\d+)?$/.test(raw)) return `${raw}px`;

  // Allow a single CSS length/percentage token; otherwise fall back.
  if (/^-?\d+(\.\d+)?(px|rem|em|vh|vw|%)$/.test(raw)) return raw;

  return fallback;
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

function readDismissBehavior(formData: FormData): DesignDismissBehaviorValue {
  const value = readString(formData, "dismissBehavior");

  if (value === "SHOW_AGAIN" || value === "HIDE_PERMANENTLY") {
    return value;
  }

  return defaultCampaignDesignValues.dismissBehavior;
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

function readOfferCodeLayout(formData: FormData): DesignOfferCodeLayoutValue {
  const value = readString(formData, "offerCodeLayout");

  if (value === "INLINE" || value === "STACKED" || value === "COMPACT") {
    return value;
  }

  return defaultCampaignDesignValues.offerCodeLayout;
}

function readOfferCopyBehavior(
  formData: FormData,
): DesignOfferCopyBehaviorValue {
  const value = readString(formData, "offerCopyBehavior");

  if (
    value === "FEEDBACK" ||
    value === "HIDE_OFFER" ||
    value === "CLOSE_CAMPAIGN"
  ) {
    return value;
  }

  return defaultCampaignDesignValues.offerCopyBehavior;
}

function readOfferApplyBehavior(
  formData: FormData,
): DesignOfferApplyBehaviorValue {
  const value = readString(formData, "offerApplyBehavior");

  if (
    value === "SHOW_APPLIED" ||
    value === "HIDE_OFFER" ||
    value === "CLOSE_CAMPAIGN"
  ) {
    return value;
  }

  return defaultCampaignDesignValues.offerApplyBehavior;
}
