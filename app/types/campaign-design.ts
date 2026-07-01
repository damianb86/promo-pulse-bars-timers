export type DesignAlignmentValue = "LEFT" | "CENTER" | "RIGHT";
export type DesignLayoutValue =
  | "STANDARD"
  | "BALANCED"
  | "BALANCED_REVERSE"
  | "INLINE"
  | "STACKED_WIDE"
  | "COMPACT_STACK"
  | "CTA_RIGHT"
  | "CTA_LEFT"
  | "CTA_TOP"
  | "HERO_TIMER"
  | "SIDE_RAIL"
  | "SPREAD"
  | "MOBILE_BANNER"
  | "MOBILE_CARD"
  | "MOBILE_SHEET"
  | "MOBILE_COMPACT_BAR"
  | "MOBILE_SPOTLIGHT";

export type DesignLayoutDeviceValue = "DESKTOP" | "MOBILE";
export type DesignBackgroundTypeValue = "SOLID" | "GRADIENT" | "IMAGE";
export type DesignFontFamilyValue =
  | "THEME"
  | "SYSTEM"
  | "SERIF"
  | "ROUNDED"
  | "MONO"
  | "GEOMETRIC"
  | "HUMANIST"
  | "CONDENSED"
  | "CASUAL";
export type DesignProgressTargetValue = "FREE_SHIPPING" | "TIMER";
export type DesignProgressBarStyleValue = "BAR" | "STEPS" | "CIRCLE";
export type DesignProgressEffectValue = "NONE" | "FILL" | "SHIMMER";
export type DesignTimerStyleValue = "PLAIN" | "GROUPED" | "BOXES";
export type DesignTimerFormatValue = "UNITS" | "COLON";
export type DesignTimerNumberLayoutValue = "INLINE" | "STACKED";
export type DesignPositionModeValue = "FLOW" | "OVERLAY";
export type DesignFloatPositionValue = "ABSOLUTE" | "FIXED";
export type DesignBannerAnimationValue = "NONE" | "FADE" | "SLIDE" | "POP";
export type DesignTimerTickAnimationValue = "NONE" | "FADE" | "FLIP" | "PULSE";
export type DesignDismissBehaviorValue = "SHOW_AGAIN" | "HIDE_PERMANENTLY";
export type DesignOfferCodeLayoutValue = "INLINE" | "STACKED" | "COMPACT";
export type DesignOfferCopyBehaviorValue =
  | "FEEDBACK"
  | "HIDE_OFFER"
  | "CLOSE_CAMPAIGN";
export type DesignOfferApplyBehaviorValue =
  | "SHOW_APPLIED"
  | "HIDE_OFFER"
  | "CLOSE_CAMPAIGN";
export type CampaignDesignIconValue =
  | "FIRE"
  | "CLOCK"
  | "TRUCK"
  | "GIFT"
  | "TAG"
  | "STAR"
  | "BOLT"
  | "HEART"
  | "CART"
  | "PERCENT"
  | "BELL"
  | "ROCKET"
  | "CHECK"
  | "CUSTOM"
  | "NONE";

export type CampaignDesignValues = {
  templateKey: string;
  layout: DesignLayoutValue;
  backgroundType: DesignBackgroundTypeValue;
  backgroundColor: string;
  backgroundImageUrl: string;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientAngle: number;
  textColor: string;
  accentColor: string;
  buttonColor: string;
  buttonTextColor: string;
  closeButtonColor: string;
  fontSize: number;
  borderRadius: number;
  borderSize: number;
  borderColor: string;
  fontFamily: DesignFontFamilyValue;
  titleFontSize: number;
  titleColor: string;
  subheadingFontSize: number;
  subheadingColor: string;
  timerFontSize: number;
  timerColor: string;
  legendFontSize: number;
  legendColor: string;
  timerNumberFontSize: number;
  timerLabelFontSize: number;
  timerGap: number;
  timerUnitGap: number;
  timerPaddingBlock: number;
  timerPaddingInline: number;
  timerStyle: DesignTimerStyleValue;
  timerFormat: DesignTimerFormatValue;
  timerNumberLayout: DesignTimerNumberLayoutValue;
  timerShowLabels: boolean;
  timerShowSeconds: boolean;
  timerDaysLabel: string;
  timerHoursLabel: string;
  timerMinutesLabel: string;
  timerSecondsLabel: string;
  timerHideZeroDays: boolean;
  timerSurfaceColor: string;
  timerSurfaceBorderColor: string;
  timerSurfaceBorderSize: number;
  timerSurfaceRadius: number;
  paddingBlock: number;
  paddingInline: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  contentGap: number;
  contentMaxWidth: number;
  fullWidth: boolean;
  positionMode: DesignPositionModeValue;
  positionSticky: boolean;
  floatPosition: DesignFloatPositionValue;
  floatOffsetTop: string;
  floatOffsetBottom: string;
  floatOffsetLeft: string;
  floatOffsetRight: string;
  entranceAnimation: DesignBannerAnimationValue;
  exitAnimation: DesignBannerAnimationValue;
  animationDurationMs: number;
  timerTickAnimation: DesignTimerTickAnimationValue;
  separateMobileDesign: boolean;
  mobileEnabled: boolean;
  customCss: string;
  alignment: DesignAlignmentValue;
  showCloseButton: boolean;
  closeButtonSize: number;
  dismissBehavior: DesignDismissBehaviorValue;
  showButton: boolean;
  showProgressBar: boolean;
  // Stored as plain strings (DB columns); constrained to the option values by the
  // UI + parser. Keep as string to avoid Prisma-enum friction.
  progressTarget: string;
  progressBarStyle: string;
  progressSteps: number;
  progressHeight: number;
  progressRadius: number;
  progressTrackColor: string;
  progressFillColor: string;
  progressTextColor: string;
  progressEffect: string;
  progressShowLabel: boolean;
  showIcon: boolean;
  icon: CampaignDesignIconValue;
  iconSize: number;
  customIconUrl: string;
  showDiscountCode: boolean;
  showCopyCodeButton: boolean;
  showApplyDiscountButton: boolean;
  offerCodeLayout: DesignOfferCodeLayoutValue;
  offerCodeLabel: string;
  copyCodeLabel: string;
  copiedCodeLabel: string;
  applyDiscountLabel: string;
  appliedDiscountMessage: string;
  offerCodeTextColor: string;
  offerCodeBackgroundColor: string;
  offerCodeBorderColor: string;
  offerCodeFontSize: number;
  offerCodeBorderRadius: number;
  offerCodePaddingBlock: number;
  offerCodePaddingInline: number;
  offerCodeGap: number;
  offerCopyBehavior: DesignOfferCopyBehaviorValue;
  offerApplyBehavior: DesignOfferApplyBehaviorValue;
};

export type CampaignResponsiveDesignValues = {
  desktop: CampaignDesignValues;
  mobile: CampaignDesignValues;
};

export type CampaignDesignErrors = Partial<
  Record<keyof CampaignDesignValues, string>
> & {
  form?: string;
};

export type CampaignDesignTemplate = CampaignDesignValues & {
  label: string;
};

export type CampaignDesignImageOption = {
  id: string;
  label: string;
  url: string;
  previewUrl: string;
  alt?: string;
};

export type CampaignDesignMediaOptions = {
  images: CampaignDesignImageOption[];
};

export const emptyCampaignDesignMediaOptions: CampaignDesignMediaOptions = {
  images: [],
};

export const defaultCampaignDesignValues: CampaignDesignValues = {
  templateKey: "clean-minimal",
  layout: "STANDARD",
  backgroundType: "SOLID",
  backgroundColor: "#FFFFFF",
  backgroundImageUrl: "",
  gradientStartColor: "#252237",
  gradientEndColor: "#4C4861",
  gradientAngle: 90,
  textColor: "#111827",
  accentColor: "#2563EB",
  buttonColor: "#111827",
  buttonTextColor: "#FFFFFF",
  closeButtonColor: "#111827",
  fontSize: 14,
  borderRadius: 4,
  borderSize: 1,
  borderColor: "#E5E7EB",
  fontFamily: "THEME",
  titleFontSize: 22,
  titleColor: "#111827",
  subheadingFontSize: 14,
  subheadingColor: "#4B5563",
  timerFontSize: 38,
  timerColor: "#111827",
  legendFontSize: 12,
  legendColor: "#6B7280",
  timerNumberFontSize: 38,
  timerLabelFontSize: 12,
  timerGap: 10,
  timerUnitGap: 3,
  timerPaddingBlock: 8,
  timerPaddingInline: 12,
  timerStyle: "PLAIN",
  timerFormat: "UNITS",
  timerNumberLayout: "INLINE",
  timerShowLabels: true,
  timerShowSeconds: true,
  timerDaysLabel: "Days",
  timerHoursLabel: "Hrs",
  timerMinutesLabel: "Mins",
  timerSecondsLabel: "Secs",
  timerHideZeroDays: true,
  timerSurfaceColor: "#FFFFFF",
  timerSurfaceBorderColor: "#D1D5DB",
  timerSurfaceBorderSize: 0,
  timerSurfaceRadius: 8,
  paddingBlock: 20,
  paddingInline: 24,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  contentGap: 8,
  contentMaxWidth: 960,
  fullWidth: false,
  positionMode: "FLOW",
  positionSticky: false,
  floatPosition: "FIXED",
  floatOffsetTop: "0",
  floatOffsetBottom: "auto",
  floatOffsetLeft: "0",
  floatOffsetRight: "0",
  entranceAnimation: "FADE",
  exitAnimation: "FADE",
  animationDurationMs: 220,
  timerTickAnimation: "NONE",
  separateMobileDesign: false,
  mobileEnabled: true,
  customCss: "",
  alignment: "CENTER",
  showCloseButton: true,
  closeButtonSize: 20,
  dismissBehavior: "SHOW_AGAIN",
  showButton: true,
  showProgressBar: true,
  progressTarget: "FREE_SHIPPING",
  progressBarStyle: "BAR",
  progressSteps: 4,
  progressHeight: 8,
  progressRadius: 999,
  progressTrackColor: "#E5E7EB",
  progressFillColor: "#22C55E",
  progressTextColor: "#111827",
  progressEffect: "NONE",
  progressShowLabel: false,
  showIcon: false,
  icon: "NONE",
  iconSize: 20,
  customIconUrl: "",
  showDiscountCode: true,
  showCopyCodeButton: true,
  showApplyDiscountButton: true,
  offerCodeLayout: "INLINE",
  offerCodeLabel: "Discount code",
  copyCodeLabel: "Copy code",
  copiedCodeLabel: "Copied",
  applyDiscountLabel: "Apply discount",
  appliedDiscountMessage: "Discount applied successfully.",
  offerCodeTextColor: "#111827",
  offerCodeBackgroundColor: "#FFFFFF",
  offerCodeBorderColor: "#D1D5DB",
  offerCodeFontSize: 13,
  offerCodeBorderRadius: 4,
  offerCodePaddingBlock: 5,
  offerCodePaddingInline: 8,
  offerCodeGap: 6,
  offerCopyBehavior: "FEEDBACK",
  offerApplyBehavior: "SHOW_APPLIED",
};

export const campaignDesignTemplates: CampaignDesignTemplate[] = [
  {
    ...defaultCampaignDesignValues,
    templateKey: "dawn",
    label: "Dawn",
    backgroundType: "GRADIENT",
    backgroundColor: "#EAFBFF",
    gradientStartColor: "#45E4D9",
    gradientEndColor: "#B975F4",
    gradientAngle: 135,
    textColor: "#173A7A",
    closeButtonColor: "#173A7A",
    titleColor: "#173A7A",
    subheadingColor: "#173A7A",
    timerColor: "#FFFFFF",
    legendColor: "#EAFBFF",
    accentColor: "#FFFFFF",
    buttonColor: "#173A7A",
    buttonTextColor: "#FFFFFF",
    borderSize: 0,
    borderRadius: 8,
    titleFontSize: 22,
    subheadingFontSize: 14,
    timerFontSize: 42,
    legendFontSize: 12,
    timerSurfaceColor: "#173A7A",
    timerSurfaceBorderColor: "#FFFFFF",
    timerSurfaceRadius: 8,
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "fifty-shades",
    label: "50 Shades",
    layout: "BALANCED",
    backgroundColor: "#313E50",
    textColor: "#F8FAFC",
    closeButtonColor: "#F8FAFC",
    titleColor: "#F8FAFC",
    subheadingColor: "#C8D0DC",
    timerColor: "#FFFFFF",
    legendColor: "#B8C0CE",
    accentColor: "#94A3B8",
    buttonColor: "#F8FAFC",
    buttonTextColor: "#313E50",
    borderSize: 0,
    borderRadius: 8,
    titleFontSize: 18,
    subheadingFontSize: 12,
    timerFontSize: 22,
    legendFontSize: 11,
    paddingBlock: 14,
    paddingInline: 18,
    timerSurfaceColor: "#28323F",
    timerSurfaceBorderColor: "#55647B",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "love",
    label: "Love",
    layout: "INLINE",
    backgroundType: "GRADIENT",
    backgroundColor: "#991B1B",
    gradientStartColor: "#E63946",
    gradientEndColor: "#FF35A2",
    gradientAngle: 90,
    textColor: "#FFFFFF",
    closeButtonColor: "#FFFFFF",
    titleColor: "#172554",
    subheadingColor: "#FFFFFF",
    timerColor: "#FFFFFF",
    legendColor: "#FFE4F0",
    accentColor: "#172554",
    buttonColor: "#172554",
    buttonTextColor: "#FFFFFF",
    borderSize: 0,
    borderRadius: 8,
    fontSize: 13,
    titleFontSize: 14,
    subheadingFontSize: 12,
    timerFontSize: 14,
    legendFontSize: 11,
    timerFormat: "COLON",
    timerShowLabels: false,
    paddingBlock: 9,
    paddingInline: 18,
    contentGap: 6,
    timerSurfaceColor: "#172554",
    timerSurfaceBorderColor: "#FFFFFF",
    timerSurfaceRadius: 8,
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "black-friday",
    label: "Black Friday",
    backgroundColor: "#050505",
    textColor: "#FFFFFF",
    closeButtonColor: "#FFFFFF",
    accentColor: "#F59E0B",
    buttonColor: "#F59E0B",
    buttonTextColor: "#050505",
    fontSize: 15,
    borderRadius: 0,
    borderSize: 0,
    titleColor: "#FFFFFF",
    subheadingColor: "#D1D5DB",
    timerColor: "#F59E0B",
    legendColor: "#FDE68A",
    positionSticky: true,
    showIcon: true,
    icon: "TAG",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "flash-sale",
    label: "Flash Sale",
    backgroundColor: "#7F1D1D",
    textColor: "#FFFFFF",
    closeButtonColor: "#FFFFFF",
    accentColor: "#FDE047",
    buttonColor: "#FFFFFF",
    buttonTextColor: "#7F1D1D",
    fontSize: 15,
    backgroundType: "GRADIENT",
    gradientStartColor: "#7F1D1D",
    gradientEndColor: "#DC2626",
    gradientAngle: 135,
    titleColor: "#FFFFFF",
    subheadingColor: "#FEE2E2",
    timerColor: "#FDE047",
    legendColor: "#FECACA",
    borderSize: 0,
    borderRadius: 6,
    timerSurfaceColor: "#450A0A",
    timerSurfaceBorderColor: "#FDE047",
    timerSurfaceRadius: 8,
    positionSticky: true,
    showIcon: true,
    icon: "FIRE",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "free-shipping",
    label: "Free Shipping",
    backgroundColor: "#ECFDF5",
    textColor: "#064E3B",
    closeButtonColor: "#064E3B",
    accentColor: "#10B981",
    buttonColor: "#047857",
    buttonTextColor: "#FFFFFF",
    borderRadius: 8,
    titleColor: "#064E3B",
    subheadingColor: "#047857",
    timerColor: "#065F46",
    legendColor: "#047857",
    timerStyle: "BOXES",
    timerSurfaceColor: "#FFFFFF",
    timerSurfaceBorderColor: "#A7F3D0",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 8,
    showIcon: true,
    icon: "TRUCK",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "delivery-cutoff",
    label: "Delivery Cutoff",
    backgroundColor: "#EFF6FF",
    textColor: "#1E3A8A",
    closeButtonColor: "#1E3A8A",
    accentColor: "#2563EB",
    buttonColor: "#2563EB",
    buttonTextColor: "#FFFFFF",
    borderRadius: 6,
    titleColor: "#1E3A8A",
    subheadingColor: "#1D4ED8",
    timerColor: "#1E40AF",
    legendColor: "#3B82F6",
    timerStyle: "GROUPED",
    timerSurfaceColor: "#DBEAFE",
    timerSurfaceBorderColor: "#BFDBFE",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 10,
    showIcon: true,
    icon: "CLOCK",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "low-stock",
    label: "Low Stock",
    backgroundColor: "#FFF7ED",
    textColor: "#7C2D12",
    closeButtonColor: "#7C2D12",
    accentColor: "#EA580C",
    buttonColor: "#C2410C",
    buttonTextColor: "#FFFFFF",
    alignment: "LEFT",
    titleColor: "#7C2D12",
    subheadingColor: "#C2410C",
    timerColor: "#EA580C",
    legendColor: "#9A3412",
    showIcon: true,
    icon: "TAG",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "clean-minimal",
    label: "Clean Minimal",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "wide-clean",
    label: "Wide Clean",
    layout: "STACKED_WIDE",
    fullWidth: true,
    contentMaxWidth: 1040,
    backgroundColor: "#F8FAFC",
    textColor: "#0F172A",
    closeButtonColor: "#334155",
    accentColor: "#0F766E",
    buttonColor: "#0F766E",
    buttonTextColor: "#FFFFFF",
    borderColor: "#CBD5E1",
    borderRadius: 0,
    borderSize: 1,
    titleColor: "#0F172A",
    subheadingColor: "#475569",
    timerColor: "#0F766E",
    legendColor: "#64748B",
    timerStyle: "GROUPED",
    timerSurfaceColor: "#FFFFFF",
    timerSurfaceBorderColor: "#99F6E4",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 10,
    showIcon: true,
    icon: "TAG",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "cart-compact",
    label: "Cart Compact",
    layout: "COMPACT_STACK",
    contentMaxWidth: 420,
    backgroundColor: "#FFFFFF",
    textColor: "#111827",
    closeButtonColor: "#4B5563",
    accentColor: "#D97706",
    buttonColor: "#111827",
    buttonTextColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderSize: 1,
    titleColor: "#111827",
    subheadingColor: "#4B5563",
    timerColor: "#D97706",
    legendColor: "#6B7280",
    timerStyle: "BOXES",
    timerSurfaceColor: "#FFFBEB",
    timerSurfaceBorderColor: "#FCD34D",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 8,
    showIcon: true,
    icon: "CLOCK",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "premium-dark",
    label: "Premium Dark",
    backgroundColor: "#111827",
    textColor: "#F9FAFB",
    closeButtonColor: "#F9FAFB",
    accentColor: "#A78BFA",
    buttonColor: "#F9FAFB",
    buttonTextColor: "#111827",
    borderRadius: 8,
    backgroundType: "GRADIENT",
    gradientStartColor: "#111827",
    gradientEndColor: "#312E81",
    gradientAngle: 135,
    titleColor: "#F9FAFB",
    subheadingColor: "#C4B5FD",
    timerColor: "#FFFFFF",
    legendColor: "#DDD6FE",
    timerStyle: "GROUPED",
    timerSurfaceColor: "#1F2937",
    timerSurfaceBorderColor: "#6D28D9",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 12,
    borderSize: 0,
    showIcon: true,
    icon: "GIFT",
  },
  {
    ...defaultCampaignDesignValues,
    templateKey: "holiday",
    label: "Holiday",
    backgroundColor: "#F0FDF4",
    textColor: "#14532D",
    closeButtonColor: "#14532D",
    accentColor: "#DC2626",
    buttonColor: "#166534",
    buttonTextColor: "#FFFFFF",
    borderRadius: 10,
    titleColor: "#14532D",
    subheadingColor: "#166534",
    timerColor: "#DC2626",
    legendColor: "#15803D",
    showIcon: true,
    icon: "GIFT",
  },
];

export const designLayoutOptions: Array<{
  value: DesignLayoutValue;
  label: string;
  description: string;
}> = [
  {
    value: "STANDARD",
    label: "Stacked",
    description:
      "Centered stack: message, timer, and action read from top to bottom.",
  },
  {
    value: "BALANCED",
    label: "Split",
    description:
      "Two-column composition with copy on the left and timer/action on the right.",
  },
  {
    value: "BALANCED_REVERSE",
    label: "Split reversed",
    description:
      "Mirror of Split: timer/action on the left and copy on the right.",
  },
  {
    value: "INLINE",
    label: "Inline",
    description: "Compact single-line message and timer for slim bars.",
  },
  {
    value: "STACKED_WIDE",
    label: "Wide stacked",
    description:
      "Full-width friendly stack that keeps the message, timer, and action grouped vertically.",
  },
  {
    value: "COMPACT_STACK",
    label: "Compact stack",
    description:
      "Dense vertical composition for cart drawers, cards, and tighter placements.",
  },
  {
    value: "CTA_RIGHT",
    label: "Action right",
    description: "Main action sits on the right rail beside the message.",
  },
  {
    value: "CTA_LEFT",
    label: "Action left",
    description: "Main action is emphasized first on the left rail.",
  },
  {
    value: "CTA_TOP",
    label: "Action top",
    description: "Main action is placed above the message for priority offers.",
  },
  {
    value: "HERO_TIMER",
    label: "Timer hero",
    description:
      "Puts the countdown first as a large centered hero, with the message below it and a full-width action last — makes the timer the focal point.",
  },
  {
    value: "SIDE_RAIL",
    label: "Side rail",
    description:
      "A distinct left rail holds the icon and timer stacked and vertically centered; the message sits top-right with the action beneath it. A card-like composition you cannot build with alignment alone.",
  },
  {
    value: "SPREAD",
    label: "Spread row",
    description:
      "One justified row that pins the message to the far left, centers the timer, and pushes the action to the far right edge — maximum horizontal separation for wide bars.",
  },
  {
    value: "MOBILE_BANNER",
    label: "Mobile banner",
    description:
      "Slim full-width banner: centered message, timer, and a full-width tap target. The reliable mobile default.",
  },
  {
    value: "MOBILE_CARD",
    label: "Mobile card",
    description:
      "Rounded card with generous padding, centered content, and a large full-width touch button.",
  },
  {
    value: "MOBILE_SHEET",
    label: "Bottom sheet",
    description:
      "Stacked sheet with rounded top corners and a pinned full-width action — pairs well with Float over page (bottom).",
  },
  {
    value: "MOBILE_COMPACT_BAR",
    label: "Compact bar",
    description:
      "Single dense row: message and a compact timer with a small inline action. Great for sticky bars.",
  },
  {
    value: "MOBILE_SPOTLIGHT",
    label: "Spotlight",
    description:
      "Big centered countdown hero with the message underneath and a full-width action below.",
  },
];

// Layouts that are tuned for the mobile design surface. Desktop editing shows
// the rest; the mobile design surface shows these. Both render responsively.
export const mobileDesignLayoutValues: DesignLayoutValue[] = [
  "MOBILE_BANNER",
  "MOBILE_CARD",
  "MOBILE_SHEET",
  "MOBILE_COMPACT_BAR",
  "MOBILE_SPOTLIGHT",
];

export function isMobileDesignLayout(value: DesignLayoutValue) {
  return mobileDesignLayoutValues.includes(value);
}

// Human-readable layout catalog for the AI generators so the model can pick the
// right structure per case. Desktop layouts go on `design.layout`; mobile
// layouts only belong on the mobile design (separateMobileDesign + mobileDesign).
export function describeDesignLayoutsForAi() {
  const format = (option: (typeof designLayoutOptions)[number]) =>
    `- ${option.value} (${option.label}): ${option.description}`;
  const desktop = designLayoutOptions.filter(
    (option) => !isMobileDesignLayout(option.value),
  );
  const mobile = designLayoutOptions.filter((option) =>
    isMobileDesignLayout(option.value),
  );

  return [
    "Layout catalog — choose the structure that best fits the message and placement:",
    "Desktop layouts (use one of these for the top-level design.layout):",
    ...desktop.map(format),
    "Mobile layouts (these change WHERE elements sit and cannot be reproduced with other settings; only valid on the mobile design — to use one, set separateMobileDesign true and place it in mobileDesign.layout, never in the top-level design.layout):",
    ...mobile.map(format),
    "Guidance: pick MOBILE_COMPACT_BAR or MOBILE_BANNER for slim/top-bar style urgency; MOBILE_CARD or MOBILE_SHEET for product-page/cart blocks that need a clear tappable action; MOBILE_SPOTLIGHT when the countdown itself is the hook.",
  ].join("\n");
}

export const designFloatPositionOptions: Array<{
  value: DesignFloatPositionValue;
  label: string;
  description: string;
}> = [
  {
    value: "FIXED",
    label: "Fixed (pinned to screen)",
    description:
      "Stays in place as the page scrolls, positioned against the viewport.",
  },
  {
    value: "ABSOLUTE",
    label: "Absolute (within the page)",
    description:
      "Positioned against the nearest container and scrolls away with the page.",
  },
];

export const designBackgroundTypeOptions: Array<{
  value: DesignBackgroundTypeValue;
  label: string;
}> = [
  { value: "SOLID", label: "Single color background" },
  { value: "GRADIENT", label: "Gradient background" },
  { value: "IMAGE", label: "Image background" },
];

export const designBannerAnimationOptions: Array<{
  value: DesignBannerAnimationValue;
  label: string;
}> = [
  { value: "NONE", label: "None" },
  { value: "FADE", label: "Fade" },
  { value: "SLIDE", label: "Slide" },
  { value: "POP", label: "Pop" },
];

export const designTimerTickAnimationOptions: Array<{
  value: DesignTimerTickAnimationValue;
  label: string;
}> = [
  { value: "NONE", label: "None" },
  { value: "FADE", label: "Fade" },
  { value: "FLIP", label: "Flip" },
  { value: "PULSE", label: "Pulse" },
];

export const designFontFamilyOptions: Array<{
  value: DesignFontFamilyValue;
  label: string;
}> = [
  { value: "THEME", label: "Use your theme fonts" },
  { value: "SYSTEM", label: "Modern system" },
  { value: "SERIF", label: "Editorial serif" },
  { value: "ROUNDED", label: "Rounded" },
  { value: "MONO", label: "Mono timer" },
  { value: "GEOMETRIC", label: "Geometric" },
  { value: "HUMANIST", label: "Humanist" },
  { value: "CONDENSED", label: "Condensed" },
  { value: "CASUAL", label: "Soft sans" },
];

export const designTimerFormatOptions: Array<{
  value: DesignTimerFormatValue;
  label: string;
  description: string;
}> = [
  {
    value: "UNITS",
    label: "Units",
    description: "Each unit is shown separately.",
  },
  {
    value: "COLON",
    label: "Colon",
    description: "Time is shown as HH:MM:SS.",
  },
];

export const designTimerNumberLayoutOptions: Array<{
  value: DesignTimerNumberLayoutValue;
  label: string;
  description: string;
}> = [
  {
    value: "INLINE",
    label: "Side by side digits",
    description: "Each timer number keeps its digits on one line.",
  },
  {
    value: "STACKED",
    label: "Stack digits",
    description: "Digits inside each timer number are stacked vertically.",
  },
];

export const designTimerStyleOptions: Array<{
  value: DesignTimerStyleValue;
  label: string;
  description: string;
}> = [
  {
    value: "PLAIN",
    label: "Plain",
    description: "Timer text is shown without an extra container.",
  },
  {
    value: "GROUPED",
    label: "Grouped",
    description: "The full timer sits inside one styled container.",
  },
  {
    value: "BOXES",
    label: "Boxes",
    description: "Each time unit is shown in its own styled box.",
  },
];

export const designDismissBehaviorOptions: Array<{
  value: DesignDismissBehaviorValue;
  label: string;
  description: string;
}> = [
  {
    value: "SHOW_AGAIN",
    label: "Show again",
    description: "Closing hides only the current on-page instance.",
  },
  {
    value: "HIDE_PERMANENTLY",
    label: "Remember close",
    description:
      "Closing hides this campaign on this browser until the campaign is republished or local storage is cleared.",
  },
];

export const designProgressTargetOptions: Array<{
  value: DesignProgressTargetValue;
  label: string;
  description: string;
}> = [
  {
    value: "FREE_SHIPPING",
    label: "Free shipping goal",
    description: "Fills as the cart approaches the free-shipping threshold.",
  },
  {
    value: "TIMER",
    label: "Countdown timer",
    description:
      "Fills as time elapses. Requires a fixed start and end date so the percentage can be calculated.",
  },
];

export const designProgressBarStyleOptions: Array<{
  value: DesignProgressBarStyleValue;
  label: string;
}> = [
  { value: "BAR", label: "Bar" },
  { value: "STEPS", label: "Steps" },
  { value: "CIRCLE", label: "Circle" },
];

export const designProgressEffectOptions: Array<{
  value: DesignProgressEffectValue;
  label: string;
}> = [
  { value: "NONE", label: "None" },
  { value: "FILL", label: "Animated fill" },
  { value: "SHIMMER", label: "Shimmer" },
];

export const designAlignmentOptions: Array<{
  value: DesignAlignmentValue;
  label: string;
}> = [
  { value: "LEFT", label: "Left" },
  { value: "CENTER", label: "Center" },
  { value: "RIGHT", label: "Right" },
];

export const designPositionModeOptions: Array<{
  value: DesignPositionModeValue;
  label: string;
}> = [
  { value: "FLOW", label: "Occupies space" },
  { value: "OVERLAY", label: "Overlay page" },
];

export const designIconOptions: Array<{
  value: CampaignDesignIconValue;
  label: string;
}> = [
  { value: "FIRE", label: "Fire" },
  { value: "CLOCK", label: "Clock" },
  { value: "TRUCK", label: "Truck" },
  { value: "GIFT", label: "Gift" },
  { value: "TAG", label: "Tag" },
  { value: "STAR", label: "Star" },
  { value: "BOLT", label: "Lightning bolt" },
  { value: "HEART", label: "Heart" },
  { value: "CART", label: "Cart" },
  { value: "PERCENT", label: "Percent" },
  { value: "BELL", label: "Bell" },
  { value: "ROCKET", label: "Rocket" },
  { value: "CHECK", label: "Checkmark" },
  { value: "CUSTOM", label: "Custom" },
  { value: "NONE", label: "None" },
];

export const designOfferCodeLayoutOptions: Array<{
  value: DesignOfferCodeLayoutValue;
  label: string;
}> = [
  { value: "INLINE", label: "Inline" },
  { value: "STACKED", label: "Stacked" },
  { value: "COMPACT", label: "Compact" },
];

export const designOfferCopyBehaviorOptions: Array<{
  value: DesignOfferCopyBehaviorValue;
  label: string;
}> = [
  { value: "FEEDBACK", label: "Show copied state" },
  { value: "HIDE_OFFER", label: "Hide offer after copy" },
  { value: "CLOSE_CAMPAIGN", label: "Close campaign after copy" },
];

export const designOfferApplyBehaviorOptions: Array<{
  value: DesignOfferApplyBehaviorValue;
  label: string;
}> = [
  { value: "SHOW_APPLIED", label: "Show applied message" },
  { value: "HIDE_OFFER", label: "Hide offer after apply" },
  { value: "CLOSE_CAMPAIGN", label: "Close campaign after apply" },
];

export function findCampaignDesignTemplate(templateKey: string) {
  return (
    campaignDesignTemplates.find(
      (template) => template.templateKey === templateKey,
    ) ??
    campaignDesignTemplates.find(
      (template) => template.templateKey === "clean-minimal",
    )!
  );
}

// Human-readable catalog of the design.* settings the AI can return, used by the
// image-analysis prompt so the model knows every supported field, the values it
// accepts, and how each one changes the campaign visually. Generated from the
// real option arrays + numeric ranges so it never drifts from the schema.
export function describeDesignSettingsForAi() {
  const enumValues = <Value extends string>(
    options: ReadonlyArray<{ value: Value; label: string }>,
  ) => options.map((option) => `${option.value} (${option.label})`).join(", ");

  const templateExamples = campaignDesignTemplates
    .map((template) => `${template.templateKey} (${template.label})`)
    .join(", ");

  return [
    "Design settings catalog — every supported design.* field, its accepted values, and its visual impact. Use ONLY these fields. Never invent new ones. All colors must be 6-digit hex like #1A2B3C.",
    "",
    "Structure & placement:",
    `- layout: ${enumValues(
      designLayoutOptions.filter(
        (option) => !isMobileDesignLayout(option.value),
      ),
    )}. Controls how message, timer, and action are arranged. Match the reading order seen in the image.`,
    "- fullWidth (boolean): true for edge-to-edge bars; false for a centered, contained card.",
    "- contentMaxWidth (number, 280-1440 px): max width of the inner content when not full width.",
    `- alignment: ${enumValues(designAlignmentOptions)}. Horizontal alignment of the content.`,
    "",
    "Background & surface:",
    `- backgroundType: ${enumValues(designBackgroundTypeOptions)}. Use IMAGE when a generated/uploaded background should be applied through backgroundImageUrl, GRADIENT when the visual is a color transition, and SOLID for a single fill.`,
    "- backgroundColor (hex): the solid fill color of the bar/banner background.",
    '- backgroundImageUrl (URL or "{{asset:key}}" placeholder): the campaign surface background image. For generated campaign backgrounds, prefer backgroundType IMAGE + backgroundImageUrl over CSS background rules.',
    "- gradientStartColor / gradientEndColor (hex) and gradientAngle (number, 0-360 deg): used when backgroundType is GRADIENT.",
    "- borderColor (hex), borderSize (number, 0-8 px), borderRadius (number, 0-999 px): outer border and corner rounding. Use borderRadius 0 for flush full-width bars, higher for pill/rounded cards.",
    "",
    "Spacing:",
    "- paddingBlock (number, 4-48 px): vertical inner padding (taller vs slimmer bar).",
    "- paddingInline (number, 8-64 px): horizontal inner padding.",
    "- contentGap (number, 0-32 px): gap between message, timer, and action.",
    "",
    "Typography & text colors:",
    `- fontFamily: ${enumValues(designFontFamilyOptions)}.`,
    "- titleFontSize (number, 12-48 px) + titleColor (hex): the headline.",
    "- subheadingFontSize (number, 10-32 px) + subheadingColor (hex): the supporting line.",
    "- fontSize (number, 11-22 px) + textColor (hex): base body text.",
    "- accentColor (hex): emphasis/links/highlight color.",
    "",
    "Timer:",
    `- timerStyle: ${enumValues(designTimerStyleOptions)}. PLAIN for bare digits, GROUPED for one container, BOXES for separate digit tiles.`,
    `- timerFormat: ${enumValues(designTimerFormatOptions)}. COLON for HH:MM:SS, UNITS for separated labeled units.`,
    `- timerNumberLayout: ${enumValues(designTimerNumberLayoutOptions)}.`,
    "- timerFontSize (number, 12-72 px) + timerColor (hex): countdown digits.",
    "- legendFontSize (number, 10-24 px) + legendColor (hex): the unit labels under the digits.",
    "- timerNumberFontSize (number, 12-72 px): digit size, independent from the timer container.",
    "- timerLabelFontSize (number, 8-28 px): unit label size, independent from the digits.",
    "- timerGap (number, 0-32 px): spacing between timer units / boxes.",
    "- timerUnitGap (number, 0-18 px): spacing between each number and its label.",
    "- timerPaddingBlock (number, 0-32 px) + timerPaddingInline (number, 0-40 px): padding inside GROUPED containers and BOXES tiles.",
    "- timerShowLabels / timerShowSeconds (boolean).",
    "- timerSurfaceColor / timerSurfaceBorderColor (hex), timerSurfaceBorderSize (number, 0-6 px), timerSurfaceRadius (number, 0-40 px): the box behind digits (visible with GROUPED/BOXES).",
    "",
    "Button & icon:",
    "- showButton (boolean): whether a CTA button is visible. Turn off for badges or label-only bars.",
    "- buttonColor (hex) + buttonTextColor (hex): the CTA button fill and its label.",
    `- showIcon (boolean) and icon: ${enumValues(designIconOptions)}. Only set an icon you can actually see in the image.`,
    '- customIconUrl (URL or "{{asset:key}}" placeholder): used only with icon CUSTOM. Prefer this setting for generated icon assets instead of placing an <img> in structureHtml.',
    "- showCloseButton (boolean) + closeButtonColor (hex): the dismiss control.",
    "- showProgressBar (boolean): for free-shipping progress style bars.",
    "- progressTarget (FREE_SHIPPING|TIMER): what the progress bar tracks. TIMER needs a fixed start+end date.",
    "- progressBarStyle (BAR|STEPS|CIRCLE), progressSteps (number, for STEPS).",
    "- progressHeight (px), progressRadius (px), progressEffect (NONE|FILL|SHIMMER), progressShowLabel (boolean).",
    "- progressTrackColor, progressFillColor, progressTextColor (6-digit hex).",
    "",
    `Built-in design presets (templateKey) you can start from, then override the visual fields above to match the image: ${templateExamples}.`,
  ].join("\n");
}
