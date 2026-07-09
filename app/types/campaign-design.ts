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
export type DesignBackgroundImageSizeValue =
  | "COVER"
  | "CONTAIN"
  | "AUTO"
  | "STRETCH";
export type DesignBackgroundImagePositionValue =
  | "CENTER"
  | "TOP"
  | "BOTTOM"
  | "LEFT"
  | "RIGHT"
  | "TOP_LEFT"
  | "TOP_RIGHT"
  | "BOTTOM_LEFT"
  | "BOTTOM_RIGHT";
export type DesignBackgroundImageRepeatValue =
  | "NO_REPEAT"
  | "REPEAT"
  | "REPEAT_X"
  | "REPEAT_Y";
export type DesignBackgroundImageAttachmentValue = "SCROLL" | "FIXED" | "LOCAL";
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
export type DesignIconBadgeModeValue = "ICON" | "BADGE";

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
  backgroundImageSize: string;
  backgroundImagePosition: string;
  backgroundImageRepeat: string;
  backgroundImageAttachment: string;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientAngle: number;
  textColor: string;
  accentColor: string;
  buttonColor: string;
  buttonTextColor: string;
  buttonHoverColor: string;
  buttonTextHoverColor: string;
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
  positionStickyZIndex: number;
  floatPosition: DesignFloatPositionValue;
  floatOffsetTop: string;
  floatOffsetBottom: string;
  floatOffsetLeft: string;
  floatOffsetRight: string;
  entranceAnimation: DesignBannerAnimationValue;
  exitAnimation: DesignBannerAnimationValue;
  animationDurationMs: number;
  timerTickAnimation: DesignTimerTickAnimationValue;
  timerTickDurationMs: number;
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
  iconBadgeMode: DesignIconBadgeModeValue;
  iconBadgeText: string;
  iconBadgeShowGlyph: boolean;
  iconBadgeBackgroundColor: string;
  iconBadgeTextColor: string;
  iconBadgeFontSize: number;
  iconBadgeBorderRadius: number;
  splitDividerEnabled: boolean;
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
  copyButtonBackgroundColor: string;
  copyButtonTextColor: string;
  copyButtonBorderColor: string;
  copyButtonFontSize: number;
  copyButtonBorderRadius: number;
  applyButtonBackgroundColor: string;
  applyButtonTextColor: string;
  applyButtonBorderColor: string;
  applyButtonFontSize: number;
  applyButtonBorderRadius: number;
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

export type CampaignDesignTemplateMeta = {
  label: string;
  description: string;
  bestFor: string;
  visualCode: string;
  emphasizes: string;
  avoids: string;
};

export type CampaignDesignTemplate = CampaignDesignValues &
  CampaignDesignTemplateMeta;

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
  backgroundImageSize: "COVER",
  backgroundImagePosition: "CENTER",
  backgroundImageRepeat: "NO_REPEAT",
  backgroundImageAttachment: "SCROLL",
  gradientStartColor: "#252237",
  gradientEndColor: "#4C4861",
  gradientAngle: 90,
  textColor: "#111827",
  accentColor: "#2563EB",
  buttonColor: "#111827",
  buttonTextColor: "#FFFFFF",
  // Hover colors default to the base fill/label, so there is no visible hover
  // change until the merchant sets them.
  buttonHoverColor: "#111827",
  buttonTextHoverColor: "#FFFFFF",
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
  positionStickyZIndex: 50,
  floatPosition: "FIXED",
  floatOffsetTop: "0",
  floatOffsetBottom: "auto",
  floatOffsetLeft: "0",
  floatOffsetRight: "0",
  entranceAnimation: "FADE",
  exitAnimation: "FADE",
  animationDurationMs: 220,
  timerTickAnimation: "NONE",
  timerTickDurationMs: 220,
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
  iconBadgeMode: "ICON",
  iconBadgeText: "FLASH SALE",
  iconBadgeShowGlyph: true,
  iconBadgeBackgroundColor: "#FCE7F3",
  iconBadgeTextColor: "#BE185D",
  iconBadgeFontSize: 13,
  iconBadgeBorderRadius: 999,
  splitDividerEnabled: true,
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
  copyButtonBackgroundColor: "#111827",
  copyButtonTextColor: "#FFFFFF",
  copyButtonBorderColor: "#111827",
  copyButtonFontSize: 13,
  copyButtonBorderRadius: 4,
  applyButtonBackgroundColor: "#111827",
  applyButtonTextColor: "#FFFFFF",
  applyButtonBorderColor: "#111827",
  applyButtonFontSize: 13,
  applyButtonBorderRadius: 4,
  offerCopyBehavior: "FEEDBACK",
  offerApplyBehavior: "SHOW_APPLIED",
};

const campaignDesignTemplateMeta = {
  dawn: {
    label: "Dawn",
    description:
      "Dark dawn countdown preset with a red timer hero and matching CTA.",
    bestFor:
      "Timer-led sale bars, urgent hero countdowns, and clean storefront promos that need high contrast without a noisy retail palette.",
    visualCode:
      "Deep indigo-to-smoke surface, pale lavender copy, oversized red-orange colon timer, soft rounded card, and matching red CTA.",
    emphasizes:
      "Countdown visibility, premium dark contrast, and one clear red action.",
    avoids:
      "Long dense copy, delivery notices, or cheerful pastel launches.",
  },
  "electric-horizon": {
    label: "Electric Horizon",
    description:
      "Bright aqua-violet gradient preset for upbeat launches and fresh offers.",
    bestFor:
      "Optimistic sale bars, product launches, seasonal refreshes, and campaigns that should feel energetic without being aggressive.",
    visualCode:
      "Aqua-to-violet gradient, dark blue copy, white accents, and a dark timer surface. It reads as modern, friendly, and high-energy.",
    emphasizes:
      "Color, freshness, and a clear timer/CTA contrast against a cheerful surface.",
    avoids:
      "Very serious operational notices, luxury dark campaigns, or long dense copy.",
  },
  "neon-pulse": {
    label: "Neon Pulse",
    description:
      "Electric neon preset with a black surface, cyan-magenta glow, and sharp CTA contrast.",
    bestFor:
      "Night drops, gaming or tech launches, high-energy flash sales, and campaigns that should feel futuristic.",
    visualCode:
      "Near-black background, cyan and pink accents, bright timer, luminous CTA, and high-contrast modern sale energy.",
    emphasizes: "Glow, speed, urgency, and a digital premium feel.",
    avoids:
      "Quiet luxury, operational notices, conservative B2B stores, or soft seasonal messaging.",
  },
  "vivid-burst": {
    label: "Vivid Burst",
    description:
      "Bold vibrant preset with saturated blue, orange, and yellow accents.",
    bestFor:
      "Big sitewide promos, colorful brands, energetic launches, and broad announcements that should feel optimistic.",
    visualCode:
      "Vivid blue-to-purple gradient, orange CTA, warm timer accent, and bright approachable contrast.",
    emphasizes:
      "Momentum, color, approachability, and a strong action without going dark.",
    avoids:
      "Luxury dark offers, minimal stores, serious delivery notices, or tiny product badges.",
  },
  "bubble-pop": {
    label: "Bubble Pop",
    description:
      "Playful bubble-gum preset with pink gradients, soft corners, and sweet contrast.",
    bestFor:
      "Beauty, fashion, gifts, creator drops, Valentine-like promos, and friendly short copy.",
    visualCode:
      "Pink-to-lilac gradient, berry CTA, white card-like timer treatment, rounded bubble feel.",
    emphasizes: "Playfulness, softness, and a clear cheerful conversion path.",
    avoids:
      "Serious urgency, B2B operational copy, black-friday severity, or long technical details.",
  },
  "black-volt": {
    label: "Black Volt",
    description:
      "Black and yellow impact preset for high-visibility sale bars.",
    bestFor:
      "Discount events, limited stock pushes, strong retail campaigns, and moments that need instant attention.",
    visualCode:
      "Matte black surface, electric yellow timer and CTA, crisp white copy, and hard retail contrast.",
    emphasizes: "Visibility, urgency, discount energy, and strong scanning.",
    avoids:
      "Soft lifestyle brands, subtle announcements, pastel campaigns, or calm operational messaging.",
  },
  "ocean-depth": {
    label: "Ocean Depth",
    description:
      "Dark ocean preset with deep blue gradients and aqua highlights.",
    bestFor:
      "Premium tech, wellness, travel, marine, and calm-but-urgent countdowns.",
    visualCode:
      "Deep navy-to-teal surface, aqua timer/accent, cool light text, and a composed dark mood.",
    emphasizes:
      "Depth, calm urgency, contrast, and a more mature premium feel.",
    avoids:
      "Playful pastel promos, loud red flash sales, holiday gifting, or casual cartoon brands.",
  },
  "crimson-moon": {
    label: "Crimson Moon",
    description:
      "Red moon preset with dark burgundy gradients and a hot crimson timer.",
    bestFor:
      "Late-night offers, dramatic launches, limited drops, and campaigns that need serious urgency.",
    visualCode:
      "Burgundy-to-black gradient, crimson timer/CTA, pale rose copy, and dramatic rounded card contrast.",
    emphasizes: "Drama, scarcity, deadline pressure, and dark event energy.",
    avoids:
      "Free-shipping reassurance, delivery cutoff messages, playful bubble-gum brands, or calm support notices.",
  },
  "fifty-shades": {
    label: "50 Shades",
    description:
      "Muted dark split preset for professional urgency with copy balanced against timer/action.",
    bestFor:
      "Premium neutral sales, B2B-style announcements, and countdowns that need contrast without loud red sale language.",
    visualCode:
      "Slate background, light text, restrained gray accents, BALANCED layout with copy on one side and timer/action on the other.",
    emphasizes:
      "A composed two-column hierarchy, readable contrast, and understated timer/action prominence.",
    avoids:
      "Playful events, bright holiday campaigns, tiny badges, or mobile-only compact bars.",
  },
  love: {
    label: "Love",
    description:
      "Compact red-pink inline preset for slim bars with a playful emotional hook.",
    bestFor:
      "Valentine-style offers, beauty/fashion promos, social launches, and short copy that should fit in one punchy row.",
    visualCode:
      "Hot gradient, navy CTA/timer treatment, INLINE layout, colon timer, low vertical padding.",
    emphasizes:
      "Speed, emotion, compactness, and a high-contrast CTA inside a slim surface.",
    avoids:
      "Long explanations, cart drawers, conservative B2B messaging, or multi-line operational details.",
  },
  "black-friday": {
    label: "Black Friday",
    description:
      "Stark black-and-gold preset for high-impact sale events and clear discounts.",
    bestFor:
      "Black Friday, Cyber Monday, limited drops, and campaigns where a concrete discount must dominate.",
    visualCode:
      "Black surface, gold accent, sticky behavior, tag icon, sharp high-contrast retail-event language.",
    emphasizes:
      "Discount, urgency, event energy, and a premium sale feel with minimal decoration.",
    avoids:
      "Soft announcements, free-shipping progress, delivery promises, or campaigns with no real offer.",
  },
  "flash-sale": {
    label: "Flash Sale",
    description:
      "Urgent red gradient preset for timer-led offers with a clear CTA.",
    bestFor:
      "Short flash sales, countdown bars, timed discount pushes, and offers where urgency is real and central.",
    visualCode:
      "Red gradient, fire icon, yellow timer contrast, dark timer surface, sticky sale treatment.",
    emphasizes:
      "Deadline pressure, timer visibility, and a bold call to action.",
    avoids:
      "Evergreen announcements, calm brand messages, or scarcity/discount claims the merchant did not provide.",
  },
  "free-shipping": {
    label: "Free Shipping",
    description:
      "Mint green value preset for shipping thresholds, cart progress, and reassurance.",
    bestFor:
      "Free-shipping goals, cart progress nudges, threshold messaging, and value-driven offers.",
    visualCode:
      "Soft green surface, truck icon, trustworthy dark green copy, boxed/grouped timer styling if urgency is added.",
    emphasizes:
      "Savings, reassurance, cart value, and progress toward a clear threshold.",
    avoids:
      "Hard scarcity, luxury dark mood, aggressive flash-sale language, or product badges.",
  },
  "delivery-cutoff": {
    label: "Delivery Cutoff",
    description:
      "Blue operational preset for order-by deadlines and delivery confidence.",
    bestFor:
      "Daily delivery cutoffs, shipping windows, fulfillment notices, and practical time-sensitive promises.",
    visualCode:
      "Blue information palette, clock icon, grouped timer surface, clear but calm deadline hierarchy.",
    emphasizes:
      "Reliability, time remaining, and the action needed before a fulfillment cutoff.",
    avoids:
      "Emotional sales, vague urgency, product merchandising badges, or unsupported delivery guarantees.",
  },
  "low-stock": {
    label: "Low Stock",
    description:
      "Warm orange product-urgency preset for real inventory pressure and quick action.",
    bestFor:
      "Low-stock product-page messages, collection nudges, and urgency based on real inventory rules.",
    visualCode:
      "Warm orange surface, tag icon, left alignment, compact copy, and attention without a loud countdown by default.",
    emphasizes:
      "Product demand, urgency, and clarity near the buying decision.",
    avoids:
      "Fake exact quantities, broad sitewide announcements, free-shipping thresholds, or long explanatory copy.",
  },
  "clean-minimal": {
    label: "Clean Minimal",
    description:
      "Neutral white preset that lets copy and CTA lead without strong styling assumptions.",
    bestFor:
      "Unknown categories, premium/simple stores, announcements, and safe drafts when the input does not imply a strong theme.",
    visualCode:
      "White card, neutral border, black CTA, standard stacked hierarchy, theme-friendly typography.",
    emphasizes:
      "Legibility, brand safety, and compatibility with most storefronts.",
    avoids:
      "High-energy sale moments that need stronger color, or campaigns where the timer must be the visual hero.",
  },
  "wide-clean": {
    label: "Wide Clean",
    description:
      "Full-width light preset for polished sitewide messages that need more breathing room.",
    bestFor:
      "Top/bottom bars, broad announcements, free-shipping reminders, and copy that benefits from a wide readable row/stack.",
    visualCode:
      "Full-width light gray surface, teal CTA/accent, zero radius, broad content max-width, grouped timer.",
    emphasizes:
      "Scanning across a wide bar, clear hierarchy, and a professional storefront-native feel.",
    avoids: "Tiny badges, narrow cart drawers, or image-led hero compositions.",
  },
  "cart-compact": {
    label: "Cart Compact",
    description:
      "Dense card preset for cart drawers/pages where action and timer must fit tightly.",
    bestFor:
      "Cart rescue, checkout urgency, compact cart reminders, and small surfaces with a strong CTA.",
    visualCode:
      "White compact card, dark CTA, amber timer, boxed timer surface, COMPACT_STACK layout.",
    emphasizes:
      "Checkout action, timer clarity, and efficient use of narrow drawer space.",
    avoids: "Wide top bars, decorative launches, or long brand storytelling.",
  },
  "premium-dark": {
    label: "Premium Dark",
    description:
      "Dark luxury preset for elevated limited offers and sophisticated campaigns.",
    bestFor:
      "Premium products, luxury drops, VIP offers, gifting campaigns, and high-value promotions.",
    visualCode:
      "Deep navy-to-purple gradient, white CTA, violet accent, grouped timer, gift icon.",
    emphasizes:
      "Exclusivity, contrast, and an upscale mood rather than loud retail urgency.",
    avoids:
      "Operational delivery notices, cheerful spring launches, low-stock warnings, or dense cart UI.",
  },
  holiday: {
    label: "Holiday",
    description:
      "Festive green/red preset for seasonal gifting, holiday events, and cheerful promotions.",
    bestFor:
      "Christmas/holiday sales, gift campaigns, seasonal launches, and event-led announcements.",
    visualCode:
      "Soft green background, red accent, gift icon, rounded friendly card treatment.",
    emphasizes:
      "Seasonality, gifting, approachability, and a clear festive CTA.",
    avoids:
      "Evergreen premium offers, operational messages, or subdued brand systems.",
  },
} satisfies Record<string, CampaignDesignTemplateMeta>;

export const campaignDesignTemplates: CampaignDesignTemplate[] = [
  {
    ...defaultCampaignDesignValues,
    ...campaignDesignTemplateMeta.dawn,
    templateKey: "dawn",
    copyButtonBackgroundColor: "#2A263D",
    copyButtonTextColor: "#FF3B26",
    copyButtonBorderColor: "#FF3B26",
    applyButtonBackgroundColor: "#D93420",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#D93420",
    backgroundType: "GRADIENT",
    backgroundColor: "#2A263D",
    gradientStartColor: "#27233A",
    gradientEndColor: "#4B4863",
    gradientAngle: 115,
    textColor: "#DAD7E8",
    closeButtonColor: "#DAD7E8",
    titleColor: "#E4E1EF",
    subheadingColor: "#B9B5C8",
    timerColor: "#FF3B26",
    legendColor: "#B9B5C8",
    accentColor: "#FF3B26",
    buttonColor: "#D93420",
    buttonTextColor: "#FFFFFF",
    borderSize: 0,
    borderRadius: 14,
    fontSize: 16,
    titleFontSize: 34,
    subheadingFontSize: 22,
    timerFontSize: 58,
    legendFontSize: 17,
    timerFormat: "COLON",
    timerStyle: "PLAIN",
    timerShowLabels: true,
    timerShowSeconds: true,
    timerHideZeroDays: true,
    paddingBlock: 42,
    paddingInline: 34,
    contentGap: 16,
    timerSurfaceColor: "#2A263D",
    timerSurfaceBorderColor: "#2A263D",
    timerSurfaceBorderSize: 0,
  },
  {
    ...defaultCampaignDesignValues,
    ...campaignDesignTemplateMeta["electric-horizon"],
    templateKey: "electric-horizon",
    copyButtonBackgroundColor: "#FFFFFF",
    copyButtonTextColor: "#173A7A",
    copyButtonBorderColor: "#173A7A",
    applyButtonBackgroundColor: "#173A7A",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#173A7A",
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
    ...campaignDesignTemplateMeta["neon-pulse"],
    templateKey: "neon-pulse",
    copyButtonBackgroundColor: "#111827",
    copyButtonTextColor: "#22D3EE",
    copyButtonBorderColor: "#22D3EE",
    applyButtonBackgroundColor: "#BE185D",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#BE185D",
    backgroundType: "GRADIENT",
    backgroundColor: "#080A1F",
    gradientStartColor: "#070A1A",
    gradientEndColor: "#3B0764",
    gradientAngle: 135,
    textColor: "#F8FAFC",
    closeButtonColor: "#F8FAFC",
    titleColor: "#F8FAFC",
    subheadingColor: "#A5F3FC",
    timerColor: "#22D3EE",
    legendColor: "#F0ABFC",
    accentColor: "#F0ABFC",
    buttonColor: "#BE185D",
    buttonTextColor: "#FFFFFF",
    borderColor: "#22D3EE",
    borderSize: 1,
    borderRadius: 10,
    timerStyle: "GROUPED",
    timerSurfaceColor: "#111827",
    timerSurfaceBorderColor: "#22D3EE",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 12,
  },
  {
    ...defaultCampaignDesignValues,
    ...campaignDesignTemplateMeta["vivid-burst"],
    templateKey: "vivid-burst",
    copyButtonBackgroundColor: "#1E1B4B",
    copyButtonTextColor: "#FDE047",
    copyButtonBorderColor: "#FDE047",
    applyButtonBackgroundColor: "#C2410C",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#C2410C",
    backgroundType: "GRADIENT",
    backgroundColor: "#2563EB",
    gradientStartColor: "#2563EB",
    gradientEndColor: "#7C3AED",
    gradientAngle: 120,
    textColor: "#FFFFFF",
    closeButtonColor: "#FFFFFF",
    titleColor: "#FFFFFF",
    subheadingColor: "#DBEAFE",
    timerColor: "#FDE047",
    legendColor: "#DBEAFE",
    accentColor: "#F97316",
    buttonColor: "#C2410C",
    buttonTextColor: "#FFFFFF",
    borderSize: 0,
    borderRadius: 12,
    timerStyle: "BOXES",
    timerSurfaceColor: "#1E1B4B",
    timerSurfaceBorderColor: "#FDE047",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 10,
  },
  {
    ...defaultCampaignDesignValues,
    ...campaignDesignTemplateMeta["bubble-pop"],
    templateKey: "bubble-pop",
    copyButtonBackgroundColor: "#FFFFFF",
    copyButtonTextColor: "#BE185D",
    copyButtonBorderColor: "#DB2777",
    applyButtonBackgroundColor: "#BE185D",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#BE185D",
    backgroundType: "GRADIENT",
    backgroundColor: "#FCE7F3",
    gradientStartColor: "#F9A8D4",
    gradientEndColor: "#C4B5FD",
    gradientAngle: 135,
    textColor: "#831843",
    closeButtonColor: "#831843",
    titleColor: "#831843",
    subheadingColor: "#9D174D",
    timerColor: "#BE185D",
    legendColor: "#831843",
    accentColor: "#DB2777",
    buttonColor: "#BE185D",
    buttonTextColor: "#FFFFFF",
    borderColor: "#FBCFE8",
    borderSize: 1,
    borderRadius: 18,
    timerStyle: "BOXES",
    timerSurfaceColor: "#FFFFFF",
    timerSurfaceBorderColor: "#F9A8D4",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 14,
  },
  {
    ...defaultCampaignDesignValues,
    ...campaignDesignTemplateMeta["black-volt"],
    templateKey: "black-volt",
    copyButtonBackgroundColor: "#18181B",
    copyButtonTextColor: "#FACC15",
    copyButtonBorderColor: "#FACC15",
    applyButtonBackgroundColor: "#FACC15",
    applyButtonTextColor: "#111827",
    applyButtonBorderColor: "#FACC15",
    backgroundColor: "#0A0A0A",
    textColor: "#FFFFFF",
    closeButtonColor: "#FFFFFF",
    titleColor: "#FFFFFF",
    subheadingColor: "#E5E7EB",
    timerColor: "#FACC15",
    legendColor: "#FDE68A",
    accentColor: "#FACC15",
    buttonColor: "#FACC15",
    buttonTextColor: "#111827",
    borderColor: "#FACC15",
    borderSize: 1,
    borderRadius: 8,
    timerStyle: "GROUPED",
    timerSurfaceColor: "#18181B",
    timerSurfaceBorderColor: "#FACC15",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 10,
  },
  {
    ...defaultCampaignDesignValues,
    ...campaignDesignTemplateMeta["ocean-depth"],
    templateKey: "ocean-depth",
    copyButtonBackgroundColor: "#0C4A6E",
    copyButtonTextColor: "#67E8F9",
    copyButtonBorderColor: "#67E8F9",
    applyButtonBackgroundColor: "#22D3EE",
    applyButtonTextColor: "#082F49",
    applyButtonBorderColor: "#22D3EE",
    backgroundType: "GRADIENT",
    backgroundColor: "#082F49",
    gradientStartColor: "#082F49",
    gradientEndColor: "#0F766E",
    gradientAngle: 135,
    textColor: "#ECFEFF",
    closeButtonColor: "#ECFEFF",
    titleColor: "#ECFEFF",
    subheadingColor: "#A5F3FC",
    timerColor: "#67E8F9",
    legendColor: "#BAE6FD",
    accentColor: "#22D3EE",
    buttonColor: "#22D3EE",
    buttonTextColor: "#082F49",
    borderSize: 0,
    borderRadius: 12,
    timerStyle: "GROUPED",
    timerSurfaceColor: "#0C4A6E",
    timerSurfaceBorderColor: "#67E8F9",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 12,
  },
  {
    ...defaultCampaignDesignValues,
    ...campaignDesignTemplateMeta["crimson-moon"],
    templateKey: "crimson-moon",
    copyButtonBackgroundColor: "#450A0A",
    copyButtonTextColor: "#FB7185",
    copyButtonBorderColor: "#FB7185",
    applyButtonBackgroundColor: "#E11D48",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#E11D48",
    backgroundType: "GRADIENT",
    backgroundColor: "#450A0A",
    gradientStartColor: "#1F0A12",
    gradientEndColor: "#7F1D1D",
    gradientAngle: 135,
    textColor: "#FFF1F2",
    closeButtonColor: "#FFF1F2",
    titleColor: "#FFF1F2",
    subheadingColor: "#FECDD3",
    timerColor: "#FB7185",
    legendColor: "#FDA4AF",
    accentColor: "#FB7185",
    buttonColor: "#E11D48",
    buttonTextColor: "#FFFFFF",
    borderColor: "#BE123C",
    borderSize: 1,
    borderRadius: 14,
    timerStyle: "GROUPED",
    timerSurfaceColor: "#450A0A",
    timerSurfaceBorderColor: "#FB7185",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 12,
  },
  {
    ...defaultCampaignDesignValues,
    ...campaignDesignTemplateMeta["fifty-shades"],
    templateKey: "fifty-shades",
    copyButtonBackgroundColor: "#28323F",
    copyButtonTextColor: "#E2E8F0",
    copyButtonBorderColor: "#94A3B8",
    applyButtonBackgroundColor: "#F8FAFC",
    applyButtonTextColor: "#313E50",
    applyButtonBorderColor: "#F8FAFC",
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
    ...campaignDesignTemplateMeta.love,
    templateKey: "love",
    copyButtonBackgroundColor: "#FFFFFF",
    copyButtonTextColor: "#991B1B",
    copyButtonBorderColor: "#FFFFFF",
    applyButtonBackgroundColor: "#172554",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#172554",
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
    ...campaignDesignTemplateMeta["black-friday"],
    templateKey: "black-friday",
    copyButtonBackgroundColor: "#111827",
    copyButtonTextColor: "#F59E0B",
    copyButtonBorderColor: "#F59E0B",
    applyButtonBackgroundColor: "#F59E0B",
    applyButtonTextColor: "#050505",
    applyButtonBorderColor: "#F59E0B",
    iconBadgeMode: "BADGE",
    iconBadgeText: "BLACK FRIDAY",
    iconBadgeBackgroundColor: "#1F2937",
    iconBadgeTextColor: "#F59E0B",
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
    ...campaignDesignTemplateMeta["flash-sale"],
    templateKey: "flash-sale",
    copyButtonBackgroundColor: "#450A0A",
    copyButtonTextColor: "#FDE047",
    copyButtonBorderColor: "#FDE047",
    applyButtonBackgroundColor: "#DC2626",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#DC2626",
    iconBadgeMode: "BADGE",
    iconBadgeText: "FLASH SALE",
    iconBadgeBackgroundColor: "#450A0A",
    iconBadgeTextColor: "#FDE047",
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
    timerStyle: "GROUPED",
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
    ...campaignDesignTemplateMeta["free-shipping"],
    templateKey: "free-shipping",
    copyButtonBackgroundColor: "#FFFFFF",
    copyButtonTextColor: "#047857",
    copyButtonBorderColor: "#047857",
    applyButtonBackgroundColor: "#047857",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#047857",
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
    ...campaignDesignTemplateMeta["delivery-cutoff"],
    templateKey: "delivery-cutoff",
    copyButtonBackgroundColor: "#FFFFFF",
    copyButtonTextColor: "#1E3A8A",
    copyButtonBorderColor: "#2563EB",
    applyButtonBackgroundColor: "#2563EB",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#2563EB",
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
    ...campaignDesignTemplateMeta["low-stock"],
    templateKey: "low-stock",
    copyButtonBackgroundColor: "#FFFFFF",
    copyButtonTextColor: "#C2410C",
    copyButtonBorderColor: "#C2410C",
    applyButtonBackgroundColor: "#C2410C",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#C2410C",
    backgroundType: "GRADIENT",
    backgroundColor: "#FFF7ED",
    gradientStartColor: "#FFF7ED",
    gradientEndColor: "#FFE4CC",
    gradientAngle: 135,
    textColor: "#7C2D12",
    closeButtonColor: "#7C2D12",
    accentColor: "#EA580C",
    buttonColor: "#C2410C",
    buttonTextColor: "#FFFFFF",
    alignment: "LEFT",
    borderRadius: 12,
    titleColor: "#7C2D12",
    subheadingColor: "#C2410C",
    timerColor: "#C2410C",
    legendColor: "#9A3412",
    timerStyle: "BOXES",
    timerSurfaceColor: "#FFFFFF",
    timerSurfaceBorderColor: "#FDBA74",
    timerSurfaceBorderSize: 1,
    timerSurfaceRadius: 10,
    showIcon: true,
    icon: "TAG",
  },
  {
    ...defaultCampaignDesignValues,
    ...campaignDesignTemplateMeta["clean-minimal"],
    templateKey: "clean-minimal",
    copyButtonBackgroundColor: "#111827",
    copyButtonTextColor: "#22C55E",
    copyButtonBorderColor: "#22C55E",
    applyButtonBackgroundColor: "#22C55E",
    applyButtonTextColor: "#052E16",
    applyButtonBorderColor: "#22C55E",
  },
  {
    ...defaultCampaignDesignValues,
    ...campaignDesignTemplateMeta["wide-clean"],
    templateKey: "wide-clean",
    copyButtonBackgroundColor: "#FFFFFF",
    copyButtonTextColor: "#0F766E",
    copyButtonBorderColor: "#0F766E",
    applyButtonBackgroundColor: "#0F766E",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#0F766E",
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
    ...campaignDesignTemplateMeta["cart-compact"],
    templateKey: "cart-compact",
    copyButtonBackgroundColor: "#FFFFFF",
    copyButtonTextColor: "#B45309",
    copyButtonBorderColor: "#D1D5DB",
    applyButtonBackgroundColor: "#111827",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#111827",
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
    ...campaignDesignTemplateMeta["premium-dark"],
    templateKey: "premium-dark",
    copyButtonBackgroundColor: "#1F2937",
    copyButtonTextColor: "#C4B5FD",
    copyButtonBorderColor: "#A78BFA",
    applyButtonBackgroundColor: "#A78BFA",
    applyButtonTextColor: "#1E1B4B",
    applyButtonBorderColor: "#A78BFA",
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
    ...campaignDesignTemplateMeta.holiday,
    templateKey: "holiday",
    copyButtonBackgroundColor: "#FFFFFF",
    copyButtonTextColor: "#166534",
    copyButtonBorderColor: "#166534",
    applyButtonBackgroundColor: "#DC2626",
    applyButtonTextColor: "#FFFFFF",
    applyButtonBorderColor: "#DC2626",
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

// Human-readable preset catalog for AI generation. The model should choose a
// preset first, then layer intentional setting tweaks on top of that preset.
export function describeDesignTemplatesForAi() {
  return [
    "Built-in preset catalog — choose templateKey FIRST, before deciding custom fields:",
    ...campaignDesignTemplates.map((template) =>
      [
        `- ${template.templateKey} (${template.label})`,
        `  Short UI description: ${template.description}`,
        `  Best for: ${template.bestFor}`,
        `  Visual code: ${template.visualCode}`,
        `  Emphasizes: ${template.emphasizes}`,
        `  Avoids / weak fit: ${template.avoids}`,
        `  Default layout: ${template.layout}; background: ${template.backgroundType}; icon: ${template.showIcon ? template.icon : "NONE"}; timer style: ${template.timerStyle}/${template.timerFormat}; fullWidth: ${template.fullWidth}.`,
      ].join("\n"),
    ),
    "Selection rule: pick the preset whose bestFor + visualCode match the campaign objective, placement, tone, offer, timer need, discount/free-shipping/delivery context, urgency level, and expected surface size. If none is clearly implied, use clean-minimal for safe brand compatibility.",
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

export const designBackgroundImageSizeOptions: Array<{
  value: DesignBackgroundImageSizeValue;
  label: string;
  description: string;
}> = [
  {
    value: "COVER",
    label: "Cover",
    description: "Fill the campaign surface and crop any overflow.",
  },
  {
    value: "CONTAIN",
    label: "Contain",
    description: "Show the full image inside the surface.",
  },
  {
    value: "AUTO",
    label: "Original",
    description: "Use the image's natural size.",
  },
  {
    value: "STRETCH",
    label: "Stretch",
    description: "Stretch the image to the full surface.",
  },
];

export const designBackgroundImagePositionOptions: Array<{
  value: DesignBackgroundImagePositionValue;
  label: string;
}> = [
  { value: "CENTER", label: "Center" },
  { value: "TOP", label: "Top" },
  { value: "BOTTOM", label: "Bottom" },
  { value: "LEFT", label: "Left" },
  { value: "RIGHT", label: "Right" },
  { value: "TOP_LEFT", label: "Top left" },
  { value: "TOP_RIGHT", label: "Top right" },
  { value: "BOTTOM_LEFT", label: "Bottom left" },
  { value: "BOTTOM_RIGHT", label: "Bottom right" },
];

export const designBackgroundImageRepeatOptions: Array<{
  value: DesignBackgroundImageRepeatValue;
  label: string;
  description: string;
}> = [
  {
    value: "NO_REPEAT",
    label: "No repeat",
    description: "Render the image once.",
  },
  {
    value: "REPEAT",
    label: "Tile",
    description: "Repeat the image in both directions.",
  },
  {
    value: "REPEAT_X",
    label: "Repeat X",
    description: "Repeat horizontally.",
  },
  {
    value: "REPEAT_Y",
    label: "Repeat Y",
    description: "Repeat vertically.",
  },
];

export const designBackgroundImageAttachmentOptions: Array<{
  value: DesignBackgroundImageAttachmentValue;
  label: string;
  description: string;
}> = [
  {
    value: "SCROLL",
    label: "Scroll",
    description: "Move with the campaign surface.",
  },
  {
    value: "FIXED",
    label: "Fixed",
    description: "Stay pinned to the viewport while the page scrolls.",
  },
  {
    value: "LOCAL",
    label: "Local",
    description: "Scroll with the element's own content.",
  },
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

export const designIconBadgeModeOptions: Array<{
  value: DesignIconBadgeModeValue;
  label: string;
}> = [
  { value: "ICON", label: "Icon" },
  { value: "BADGE", label: "Badge" },
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
    "- positionSticky (boolean): for top/bottom bars, true keeps the bar sticky in normal document flow while scrolling.",
    "- positionStickyZIndex (number, 0-2147483647): z-index used by sticky top/bottom bars and their storefront container.",
    `- alignment: ${enumValues(designAlignmentOptions)}. Horizontal alignment of the content.`,
    "",
    "Background & surface:",
    `- backgroundType: ${enumValues(designBackgroundTypeOptions)}. Use IMAGE when a generated/uploaded background should be applied through backgroundImageUrl, GRADIENT when the visual is a color transition, and SOLID for a single fill.`,
    "- backgroundColor (hex): the solid fill color of the bar/banner background.",
    '- backgroundImageUrl (URL or "{{asset:key}}" placeholder): the campaign surface background image. For generated campaign backgrounds, prefer backgroundType IMAGE + backgroundImageUrl over CSS background rules.',
    `- backgroundImageSize: ${enumValues(designBackgroundImageSizeOptions)}. Maps to CSS background-size for IMAGE backgrounds; COVER is best for photos/banners, CONTAIN preserves the full image, AUTO is useful for patterns, STRETCH fills exactly.`,
    `- backgroundImagePosition: ${enumValues(designBackgroundImagePositionOptions)}. Maps to CSS background-position for IMAGE backgrounds.`,
    `- backgroundImageRepeat: ${enumValues(designBackgroundImageRepeatOptions)}. Use REPEAT/AUTO-size for tileable patterns; use NO_REPEAT for photos and generated banners.`,
    `- backgroundImageAttachment: ${enumValues(designBackgroundImageAttachmentOptions)}. Usually SCROLL; use FIXED only when a pinned parallax-like background is intentional and still readable.`,
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
    "- buttonHoverColor (hex) + buttonTextHoverColor (hex): the CTA fill/label on hover. Set them equal to buttonColor/buttonTextColor for no hover change.",
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
    "",
    describeDesignTemplatesForAi(),
  ].join("\n");
}
