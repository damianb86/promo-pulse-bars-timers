export const templateMarkets = [
  { countryCode: "US", locale: "en", currencyCode: "USD", threshold: 75 },
];

const eventDefinitions = [
  event("black-friday", "Black Friday", "BFCM", "FLASH_SALE", "COUNTDOWN_BAR", {
    badgeText: "Black Friday",
    ctaText: "Shop Black Friday",
    discountText: "Up to 40% off sitewide",
    icon: "TAG",
    knownOffer: "Sitewide Black Friday sale",
    productContext: "all storefront traffic",
    suggestedDurationHours: 48,
    templateKey: "black-friday",
    design: {
      alignment: "CENTER",
      fontFamily: "CONDENSED",
      fullWidth: true,
      layout: "INLINE",
      paddingBlock: 12,
      paddingInline: 20,
      showProgressBar: false,
      titleFontSize: 16,
      timerFormat: "COLON",
      timerShowLabels: false,
      timerStyle: "PLAIN",
      timerTickAnimation: "PULSE",
    },
  }),
  event("cyber-monday", "Cyber Monday", "BFCM", "FLASH_SALE", "COUNTDOWN_BAR", {
    badgeText: "Cyber Monday",
    ctaText: "Shop Cyber Monday",
    discountText: "Online deals end tonight",
    icon: "TAG",
    knownOffer: "Cyber Monday limited-time sale",
    suggestedDurationHours: 24,
    templateKey: "premium-dark",
    design: {
      fontFamily: "GEOMETRIC",
      fullWidth: true,
      layout: "CTA_RIGHT",
      paddingBlock: 14,
      paddingInline: 22,
      showProgressBar: false,
      timerStyle: "GROUPED",
      timerTickAnimation: "FLIP",
    },
  }),
  event("christmas", "Christmas", "HOLIDAY", "FLASH_SALE", "COUNTDOWN_BAR", {
    badgeText: "Holiday sale",
    ctaText: "Shop gifts",
    discountText: "Save on gifts before Christmas",
    icon: "GIFT",
    knownOffer: "Holiday gift sale",
    suggestedDurationHours: 72,
    templateKey: "holiday",
    design: {
      fontFamily: "ROUNDED",
      layout: "BALANCED",
      paddingBlock: 18,
      paddingInline: 22,
      showProgressBar: false,
      timerStyle: "BOXES",
      timerTickAnimation: "PULSE",
    },
  }),
  event("new-year", "New Year", "SEASONAL", "FLASH_SALE", "COUNTDOWN_BAR", {
    badgeText: "New Year",
    ctaText: "Start saving",
    discountText: "New year savings are live",
    icon: "GIFT",
    knownOffer: "New Year sitewide promotion",
    suggestedDurationHours: 48,
    templateKey: "premium-dark",
    design: {
      fontFamily: "SERIF",
      gradientAngle: 120,
      gradientEndColor: "#1D4ED8",
      gradientStartColor: "#020617",
      layout: "CTA_RIGHT",
      paddingBlock: 16,
      paddingInline: 22,
      showProgressBar: false,
      timerStyle: "GROUPED",
    },
  }),
  event(
    "valentines-day",
    "Valentine's Day",
    "HOLIDAY",
    "FLASH_SALE",
    "COUNTDOWN_BAR",
    {
      badgeText: "Valentine's Day",
      ctaText: "Shop gifts",
      discountText: "15% off gifts for a limited time",
      icon: "GIFT",
      knownOffer: "Valentine's Day gift sale",
      suggestedDurationHours: 48,
      templateKey: "love",
      design: {
        fontFamily: "SERIF",
        layout: "INLINE",
        paddingBlock: 11,
        paddingInline: 18,
        showProgressBar: false,
        timerFormat: "COLON",
        timerShowLabels: false,
      },
    },
  ),
  event(
    "mothers-day",
    "Mother's Day",
    "HOLIDAY",
    "FLASH_SALE",
    "COUNTDOWN_BAR",
    {
      badgeText: "Mother's Day",
      ctaText: "Shop Mother's Day",
      discountText: "Thoughtful gifts, limited-time savings",
      icon: "GIFT",
      knownOffer: "Mother's Day gift promotion",
      suggestedDurationHours: 48,
      templateKey: "dawn",
      design: {
        fontFamily: "HUMANIST",
        layout: "BALANCED",
        paddingBlock: 18,
        paddingInline: 22,
        timerFormat: "UNITS",
        timerStyle: "GROUPED",
      },
    },
  ),
  event(
    "fathers-day",
    "Father's Day",
    "HOLIDAY",
    "FLASH_SALE",
    "COUNTDOWN_BAR",
    {
      badgeText: "Father's Day",
      ctaText: "Shop Father's Day",
      discountText: "20% off gifts for Dad",
      icon: "GIFT",
      knownOffer: "Father's Day gift promotion",
      suggestedDurationHours: 48,
      templateKey: "fifty-shades",
      design: {
        fontFamily: "GEOMETRIC",
        layout: "CTA_RIGHT",
        paddingBlock: 14,
        paddingInline: 20,
        showProgressBar: false,
        timerStyle: "PLAIN",
      },
    },
  ),
  event(
    "flash-sale",
    "Flash Sale",
    "FLASH_SALE",
    "FLASH_SALE",
    "COUNTDOWN_BAR",
    {
      badgeText: "Flash sale",
      ctaText: "Shop now",
      discountText: "Limited-time offer ends soon",
      icon: "FIRE",
      knownOffer: "Short flash sale",
      suggestedDurationHours: 12,
      templateKey: "flash-sale",
      design: {
        fontFamily: "SYSTEM",
        fullWidth: true,
        layout: "INLINE",
        paddingBlock: 10,
        paddingInline: 18,
        showProgressBar: false,
        timerFormat: "COLON",
        timerShowLabels: false,
        timerTickAnimation: "PULSE",
      },
    },
  ),
  event("clearance", "Clearance", "FLASH_SALE", "FLASH_SALE", "COUNTDOWN_BAR", {
    badgeText: "Clearance",
    ctaText: "Shop clearance",
    discountText: "Final markdowns while inventory lasts",
    icon: "TAG",
    knownOffer: "Clearance markdown sale",
    suggestedDurationHours: 72,
    templateKey: "low-stock",
    design: {
      alignment: "LEFT",
      fontFamily: "CONDENSED",
      layout: "CTA_RIGHT",
      paddingBlock: 15,
      paddingInline: 20,
      timerStyle: "BOXES",
      timerTickAnimation: "FADE",
    },
  }),
  event(
    "last-chance",
    "Last Chance",
    "FLASH_SALE",
    "FLASH_SALE",
    "COUNTDOWN_BAR",
    {
      badgeText: "Last chance",
      ctaText: "Grab the deal",
      discountText: "Offer ends tonight",
      icon: "FIRE",
      knownOffer: "Last chance limited-time offer",
      suggestedDurationHours: 24,
      templateKey: "flash-sale",
      design: {
        fontFamily: "SYSTEM",
        layout: "CTA_LEFT",
        paddingBlock: 13,
        paddingInline: 18,
        showProgressBar: false,
        timerStyle: "GROUPED",
        timerTickAnimation: "PULSE",
      },
    },
  ),
  event(
    "cart-rescue",
    "Cart Rescue",
    "CART_RECOVERY",
    "CART_RESCUE",
    "CART_TIMER",
    {
      badgeText: "Cart offer",
      ctaText: "Checkout now",
      ctaUrl: "/checkout",
      discountText: "Your cart offer expires soon",
      icon: "CLOCK",
      knownOffer: "Cart recovery discount",
      recommendedPlacement: "CART_DRAWER",
      suggestedDurationHours: 2,
      templateKey: "premium-dark",
      design: {
        fontFamily: "SYSTEM",
        layout: "CTA_TOP",
        paddingBlock: 16,
        paddingInline: 18,
        showProgressBar: false,
        timerFormat: "COLON",
        timerShowLabels: false,
      },
    },
  ),
  event(
    "free-shipping-weekend",
    "Free Shipping Weekend",
    "FREE_SHIPPING",
    "FREE_SHIPPING",
    "FREE_SHIPPING_GOAL",
    {
      badgeText: "Free shipping",
      ctaText: "Continue shopping",
      discountText: "Unlock free shipping at $75",
      icon: "TRUCK",
      knownOffer: "Free shipping threshold",
      recommendedPlacement: "CART_DRAWER",
      templateKey: "free-shipping",
      design: {
        alignment: "LEFT",
        fontFamily: "HUMANIST",
        layout: "BALANCED",
        paddingBlock: 16,
        paddingInline: 18,
        showProgressBar: true,
        timerStyle: "BOXES",
      },
    },
  ),
  event(
    "shipping-cutoff",
    "Shipping Cutoff",
    "SEASONAL",
    "DELIVERY_CUTOFF",
    "DELIVERY_CUTOFF",
    {
      badgeText: "Delivery cutoff",
      ctaText: "Shop eligible items",
      cutoffHour: 14,
      cutoffMinute: 0,
      discountText: "Order by 2 PM for faster delivery",
      icon: "CLOCK",
      knownOffer: "Same-day shipping cutoff message",
      maxDeliveryDays: 3,
      minDeliveryDays: 1,
      processingDays: 0,
      recommendedPlacement: "PRODUCT_PAGE",
      templateKey: "delivery-cutoff",
      design: {
        fontFamily: "SYSTEM",
        layout: "BALANCED",
        paddingBlock: 16,
        paddingInline: 18,
        timerStyle: "GROUPED",
        timerTickAnimation: "FADE",
      },
    },
  ),
  event(
    "product-launch",
    "Product Launch",
    "PRODUCT_LAUNCH",
    "PRODUCT_BADGE",
    "PRODUCT_BADGE",
    {
      badgeShape: "ROUNDED",
      badgeText: "New",
      ctaText: "View new arrivals",
      ctaUrl: "/collections/new-arrivals",
      discountText: "New arrivals are live",
      icon: "TAG",
      knownOffer: "New product launch announcement",
      productContext: "new arrivals and featured collections",
      recommendedPlacement: "COLLECTION_CARD",
      templateKey: "clean-minimal",
      design: {
        alignment: "LEFT",
        fontFamily: "GEOMETRIC",
        icon: "NONE",
        layout: "STANDARD",
        paddingBlock: 10,
        paddingInline: 12,
        showButton: false,
        showCloseButton: false,
        showIcon: false,
        showProgressBar: false,
      },
    },
  ),
  event(
    "pre-order",
    "Pre-order",
    "PRODUCT_LAUNCH",
    "PREORDER",
    "PRODUCT_TIMER",
    {
      badgeText: "Pre-order",
      ctaText: "View details",
      discountText: "Pre-order window is open",
      icon: "CLOCK",
      knownOffer: "Pre-order availability window",
      productContext: "pre-order products",
      recommendedPlacement: "PRODUCT_PAGE",
      suggestedDurationHours: 168,
      templateKey: "premium-dark",
      design: {
        fontFamily: "SERIF",
        layout: "BALANCED",
        paddingBlock: 18,
        paddingInline: 22,
        showProgressBar: false,
        timerStyle: "GROUPED",
        timerTickAnimation: "FLIP",
      },
    },
  ),
  event(
    "low-stock",
    "Low Stock Alert",
    "FLASH_SALE",
    "LOW_STOCK_URGENCY",
    "LOW_STOCK",
    {
      badgeText: "Low stock",
      ctaText: "Buy before it sells out",
      discountText: "Only a few left",
      icon: "TAG",
      knownOffer: "Low stock urgency message",
      productContext: "low inventory products",
      recommendedPlacement: "PRODUCT_PAGE",
      templateKey: "low-stock",
      design: {
        alignment: "LEFT",
        fontFamily: "HUMANIST",
        layout: "CTA_RIGHT",
        paddingBlock: 14,
        paddingInline: 18,
        showButton: true,
        showProgressBar: false,
      },
    },
  ),
  event(
    "vip-early-access",
    "VIP Early Access",
    "PRODUCT_LAUNCH",
    "LAUNCH",
    "COUNTDOWN_BAR",
    {
      badgeText: "Early access",
      ctaText: "Enter early access",
      ctaUrl: "/collections/early-access",
      discountText: "Members get first access",
      icon: "TAG",
      knownOffer: "VIP early access launch",
      productContext: "VIP and launch traffic",
      suggestedDurationHours: 36,
      templateKey: "dawn",
      design: {
        fontFamily: "GEOMETRIC",
        layout: "CTA_RIGHT",
        paddingBlock: 16,
        paddingInline: 22,
        showProgressBar: false,
        timerStyle: "GROUPED",
        timerTickAnimation: "FADE",
      },
    },
  ),
  event(
    "site-announcement",
    "Site Announcement",
    "SEASONAL",
    "ANNOUNCEMENT",
    "COUNTDOWN_BAR",
    {
      badgeText: "Announcement",
      ctaText: "Learn more",
      ctaUrl: "/pages/announcements",
      discountText: "Important storefront update",
      icon: "TAG",
      knownOffer: "General announcement",
      suggestedDurationHours: 72,
      templateKey: "clean-minimal",
      design: {
        alignment: "LEFT",
        fontFamily: "SYSTEM",
        layout: "CTA_RIGHT",
        paddingBlock: 12,
        paddingInline: 18,
        showProgressBar: false,
        timerShowSeconds: false,
        timerStyle: "PLAIN",
      },
    },
  ),
];

export function buildSystemCampaignTemplates() {
  return eventDefinitions.flatMap((definition) =>
    templateMarkets.map((market) => {
      const texts = buildTexts(definition, market);

      return {
        key: `${market.countryCode.toLowerCase()}-${definition.slug}`,
        shopId: null,
        category: definition.category,
        countryCode: market.countryCode,
        locale: market.locale,
        eventName: definition.eventName,
        goal: definition.goal,
        type: definition.type,
        defaultTexts: texts,
        defaultDesign: buildDesign(definition),
        defaultSettings: buildSettings(definition, market),
        isSystem: true,
      };
    }),
  );
}

function event(slug, eventName, category, goal, type, settings) {
  return { slug, eventName, category, goal, type, settings };
}

function buildTexts(definition) {
  const settings = definition.settings;
  const headline = settings.discountText;

  if (definition.type === "FREE_SHIPPING_GOAL") {
    return {
      headline,
      subheadline: "Add eligible items to your cart to unlock the reward.",
      ctaText: settings.ctaText,
      ctaUrl: settings.ctaUrl || "/collections/all",
      expiredText: "This free shipping offer has ended.",
      freeShippingEmptyText: "Add items to unlock free shipping.",
      freeShippingProgressText: "You're {{amount}} away from free shipping.",
      freeShippingSuccessText: "You've unlocked free shipping.",
      badgeText: settings.badgeText,
    };
  }

  if (definition.type === "DELIVERY_CUTOFF") {
    return {
      headline,
      subheadline: "Set the real cutoff window before publishing.",
      ctaText: settings.ctaText,
      ctaUrl: settings.ctaUrl || "/collections/all",
      expiredText: "Today's delivery cutoff has passed.",
      deliveryBeforeCutoffText: "Order before {{cutoff}} for faster delivery.",
      deliveryAfterCutoffText: "Orders now ship in the next delivery window.",
      badgeText: settings.badgeText,
    };
  }

  if (definition.type === "LOW_STOCK") {
    return {
      headline,
      subheadline: "Use this on products with real inventory pressure.",
      ctaText: settings.ctaText,
      ctaUrl: settings.ctaUrl || "/collections/all",
      expiredText: "This inventory message is no longer active.",
      lowStockText: "Only {{quantity}} left in stock.",
      badgeText: settings.badgeText,
    };
  }

  if (definition.type === "PRODUCT_BADGE") {
    return {
      headline,
      subheadline: "Highlight new or featured products in collection grids.",
      ctaText: settings.ctaText,
      ctaUrl: settings.ctaUrl || "/collections/new-arrivals",
      expiredText: "This product badge is no longer active.",
      badgeText: settings.badgeText,
    };
  }

  if (definition.type === "PRODUCT_TIMER") {
    return {
      headline,
      subheadline: "Show the real launch or pre-order window.",
      ctaText: settings.ctaText,
      ctaUrl: settings.ctaUrl || "/collections/all",
      expiredText: "This pre-order window has ended.",
      badgeText: settings.badgeText,
    };
  }

  if (definition.type === "CART_TIMER") {
    return {
      headline,
      subheadline: "Keep urgency close to checkout without changing the offer.",
      ctaText: settings.ctaText,
      ctaUrl: settings.ctaUrl || "/checkout",
      expiredText: "This cart offer has ended.",
      badgeText: settings.badgeText,
    };
  }

  return {
    headline,
    subheadline: `Use this ${definition.eventName} template with a real offer before publishing.`,
    ctaText: settings.ctaText,
    ctaUrl: settings.ctaUrl || "/collections/sale",
    expiredText: "This campaign has ended.",
    badgeText: settings.badgeText,
  };
}

function buildDesign(definition) {
  return {
    templateKey: definition.settings.templateKey,
    icon: definition.settings.icon,
    showIcon: true,
    positionSticky: definition.type === "COUNTDOWN_BAR",
    ...definition.settings.design,
  };
}

function buildSettings(definition, market) {
  const settings = definition.settings;

  return {
    badgePosition: settings.badgePosition || "TOP_RIGHT",
    badgeShape: settings.badgeShape || "PILL",
    cutoffHour: settings.cutoffHour || 14,
    cutoffMinute: settings.cutoffMinute || 0,
    knownOffer: settings.knownOffer || settings.discountText,
    maxDeliveryDays: settings.maxDeliveryDays || 5,
    minDeliveryDays: settings.minDeliveryDays || 2,
    processingDays: settings.processingDays || 0,
    productContext: settings.productContext || "selected products",
    recommendedPlacement:
      settings.recommendedPlacement || defaultPlacement(definition.type),
    suggestedDurationHours: settings.suggestedDurationHours || 48,
    thresholdAmount: market.threshold,
    currencyCode: market.currencyCode,
    timezone: "America/New_York",
  };
}

function defaultPlacement(type) {
  if (type === "CART_TIMER") return "CART_DRAWER";
  if (type === "FREE_SHIPPING_GOAL") return "CART_DRAWER";
  if (type === "PRODUCT_BADGE") return "COLLECTION_CARD";
  if (type === "PRODUCT_TIMER") return "PRODUCT_PAGE";
  if (type === "DELIVERY_CUTOFF") return "PRODUCT_PAGE";
  if (type === "LOW_STOCK") return "PRODUCT_PAGE";
  return "TOP_BAR";
}
