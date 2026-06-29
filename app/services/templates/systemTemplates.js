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

// Strategy templates bundle behavior targeting with campaign features for
// complex, ready-to-run flows (cart/checkout recovery, intent-based offers,
// cross-campaign retargeting). Each documents its objective and bundled
// functionality in `settings.description` + `settings.highlights`, which the
// Template Library surfaces on the card.
const strategyDefinitions = [
  event(
    "abandoned-cart-rescue",
    "Abandoned Cart Rescue",
    "CART_RECOVERY",
    "CART_RESCUE",
    "CART_TIMER",
    {
      badgeText: "Still thinking it over?",
      ctaText: "Complete your order",
      ctaUrl: "/checkout",
      discountText: "Your cart is waiting — finish before it's gone",
      icon: "TAG",
      templateKey: "premium-dark",
      recommendedPlacement: "CART_DRAWER",
      placements: ["CART_DRAWER", "CART_PAGE"],
      suggestedDurationHours: 24,
      subheadline: "Re-engage shoppers who added to cart but never checked out.",
      description:
        "Objective: recover stalled carts. Shows a cart-drawer urgency timer only to shoppers who added to cart and then went quiet, waiting a configurable delay before appearing so it never interrupts an active checkout. Pairs the Inactive cart and Added-to-cart-no-checkout behavior segments, and automatically excludes anyone who already purchased.",
      highlights: [
        "Behavior targeting: Inactive cart (60 min) + Added to cart, no checkout (30 min delay)",
        "Cart drawer + cart page placements with an evergreen urgency timer",
        "Excludes shoppers who already completed an order",
      ],
      behaviorRules: {
        enabled: true,
        segments: ["INACTIVE_CART", "ADDED_TO_CART_NO_CHECKOUT"],
        inactiveCartMinutes: 60,
        addedToCartDelayMinutes: 30,
        checkoutStartedExcludePurchasers: true,
        lookbackDays: 14,
      },
      design: {
        layout: "CTA_RIGHT",
        timerStyle: "BOXES",
        timerTickAnimation: "PULSE",
      },
    },
  ),
  event(
    "checkout-abandoner-last-chance",
    "Checkout Abandoner Last-Chance",
    "CART_RECOVERY",
    "FLASH_SALE",
    "COUNTDOWN_BAR",
    {
      badgeText: "Don't miss out",
      ctaText: "Finish checkout",
      ctaUrl: "/checkout",
      discountText: "Your checkout is almost done — complete it now",
      icon: "TAG",
      templateKey: "premium-dark",
      recommendedPlacement: "TOP_BAR",
      suggestedDurationHours: 12,
      subheadline: "Nudge shoppers who started checkout but didn't finish.",
      description:
        "Objective: win back checkout abandoners. Displays a top-bar countdown only to visitors who reached checkout and stalled, after a short delay, and never to shoppers who already purchased. Ideal to pair with a time-boxed discount code for a true last-chance push.",
      highlights: [
        "Behavior targeting: Checkout started (15 min delay)",
        "Automatically excludes shoppers who already purchased",
        "Top-bar countdown for a time-boxed last-chance offer",
      ],
      behaviorRules: {
        enabled: true,
        segments: ["CHECKOUT_STARTED"],
        checkoutStartedDelayMinutes: 15,
        checkoutStartedExcludePurchasers: true,
        lookbackDays: 7,
      },
      design: {
        fullWidth: true,
        layout: "INLINE",
        timerStyle: "GROUPED",
        timerTickAnimation: "FLIP",
      },
    },
  ),
  event(
    "high-intent-flash-offer",
    "High-Intent Flash Offer",
    "FLASH_SALE",
    "FLASH_SALE",
    "COUNTDOWN_BAR",
    {
      badgeText: "Just for you",
      ctaText: "Claim the deal",
      discountText: "You're on a roll — here's a limited-time deal",
      icon: "TAG",
      templateKey: "black-friday",
      recommendedPlacement: "TOP_BAR",
      suggestedDurationHours: 6,
      subheadline: "Reward shoppers showing strong buying intent right now.",
      description:
        "Objective: convert high-intent sessions. Surfaces an urgent flash offer only to visitors who fired several qualifying events (product views, clicks, add-to-cart) inside a short window, concentrating the discount on shoppers most likely to buy.",
      highlights: [
        "Behavior targeting: High intent (4+ events within 30 minutes)",
        "Short urgency window keeps the offer scarce and timely",
        "Great paired with a unique or basic discount code",
      ],
      behaviorRules: {
        enabled: true,
        segments: ["HIGH_INTENT"],
        highIntentMinEvents: 4,
        highIntentWindowMinutes: 30,
        lookbackDays: 3,
      },
      design: {
        fullWidth: true,
        layout: "INLINE",
        timerStyle: "PLAIN",
        timerTickAnimation: "PULSE",
      },
    },
  ),
  event(
    "returning-vip-welcome-back",
    "Returning VIP Welcome-Back",
    "SEASONAL",
    "ANNOUNCEMENT",
    "COUNTDOWN_BAR",
    {
      badgeText: "Welcome back",
      ctaText: "See what's new",
      discountText: "Welcome back — here's something for returning shoppers",
      icon: "GIFT",
      templateKey: "clean-minimal",
      recommendedPlacement: "TOP_BAR",
      suggestedDurationHours: 48,
      subheadline: "Greet loyal shoppers who keep coming back.",
      description:
        "Objective: reward loyalty. Shows a welcome-back message only to visitors seen across multiple sessions over time, defining 'returning' as at least two prior sessions and at least one day since first seen so brand-new browsers are excluded.",
      highlights: [
        "Behavior targeting: Returning visitor (2+ prior sessions, 1+ day since first seen)",
        "Privacy-safe: uses anonymous visitor/session signals, no PII",
        "Top-bar announcement tuned for repeat shoppers",
      ],
      behaviorRules: {
        enabled: true,
        segments: ["RETURNING_VISITOR"],
        returningMinPriorSessions: 2,
        returningMinDaysSinceFirstSeen: 1,
        lookbackDays: 60,
      },
      design: {
        layout: "BALANCED",
        timerStyle: "BOXES",
      },
    },
  ),
  event(
    "new-visitor-welcome",
    "New Visitor Welcome",
    "FREE_SHIPPING",
    "FREE_SHIPPING",
    "FREE_SHIPPING_GOAL",
    {
      badgeText: "Welcome",
      ctaText: "Start shopping",
      discountText: "Welcome! Unlock free shipping on your first order",
      icon: "TRUCK",
      templateKey: "free-shipping",
      recommendedPlacement: "CART_DRAWER",
      placements: ["CART_DRAWER"],
      subheadline: "Convert first-time visitors with a clear first-order reward.",
      description:
        "Objective: convert first-time visitors. Presents a free-shipping progress goal in the cart drawer only to shoppers with no prior Promo Pulse history, giving newcomers a concrete incentive to complete a first order.",
      highlights: [
        "Behavior targeting: New visitor (no prior history)",
        "Free-shipping progress goal in the cart drawer",
        "Set the real threshold and reward before publishing",
      ],
      behaviorRules: {
        enabled: true,
        segments: ["NEW_VISITOR"],
        lookbackDays: 30,
      },
      design: {
        layout: "STANDARD",
      },
    },
  ),
  event(
    "cross-campaign-retargeting",
    "Cross-Campaign Retargeting",
    "FLASH_SALE",
    "FLASH_SALE",
    "COUNTDOWN_BAR",
    {
      badgeText: "Saw it? Now save",
      ctaText: "Shop the offer",
      discountText: "Still interested? Here's a reason to come back",
      icon: "TAG",
      templateKey: "premium-dark",
      recommendedPlacement: "TOP_BAR",
      suggestedDurationHours: 24,
      subheadline:
        "Retarget shoppers who saw a previous campaign but didn't convert.",
      description:
        "Objective: cross-campaign retargeting. Targets visitors who already saw one of your campaigns and viewed products without adding to cart — a warm audience for a follow-up offer. Open the Targeting tab and paste the specific prior campaign IDs into the 'Saw campaign' list to make it a true cross-campaign sequence (leave blank to match any previously seen campaign).",
      highlights: [
        "Behavior targeting: Saw campaign + Viewed product, no add to cart",
        "Cross-campaign: add prior campaign IDs to chain offers together",
        "Top-bar countdown for a warm-audience follow-up",
      ],
      behaviorRules: {
        enabled: true,
        segments: ["SAW_CAMPAIGN", "VIEWED_PRODUCT_NO_ADD_TO_CART"],
        sawCampaignIds: [],
        viewedProductMinViews: 1,
        lookbackDays: 14,
      },
      design: {
        fullWidth: true,
        layout: "CTA_RIGHT",
        timerStyle: "GROUPED",
      },
    },
  ),
  event(
    "clicked-campaign-booster",
    "Clicked-Campaign Booster",
    "CART_RECOVERY",
    "CART_RESCUE",
    "CART_TIMER",
    {
      badgeText: "Pick up where you left off",
      ctaText: "Complete your order",
      ctaUrl: "/checkout",
      discountText: "You were interested — finish your order",
      icon: "TAG",
      templateKey: "premium-dark",
      recommendedPlacement: "CART_DRAWER",
      suggestedDurationHours: 24,
      subheadline: "Deepen engagement for shoppers who clicked a campaign.",
      description:
        "Objective: convert engaged clickers. Shows a cart-drawer offer to visitors who clicked one of your campaigns, the strongest signal of interest. Add specific prior campaign IDs to the 'Clicked campaign' list in the Targeting tab to chain it behind a particular promotion.",
      highlights: [
        "Behavior targeting: Clicked campaign (any, or specific IDs)",
        "Cross-campaign: chain behind a specific promotion by ID",
        "Cart-drawer timer to push engaged clickers to checkout",
      ],
      behaviorRules: {
        enabled: true,
        segments: ["CLICKED_CAMPAIGN"],
        clickedCampaignIds: [],
        lookbackDays: 14,
      },
      design: {
        layout: "CTA_RIGHT",
        timerStyle: "BOXES",
      },
    },
  ),
  event(
    "loyalty-code-redeemers",
    "Loyalty Code Redeemers",
    "SEASONAL",
    "ANNOUNCEMENT",
    "COUNTDOWN_BAR",
    {
      badgeText: "Thanks for being here",
      ctaText: "Shop loyalty picks",
      discountText: "Loyal shopper? Here's your next reward",
      icon: "GIFT",
      templateKey: "clean-minimal",
      recommendedPlacement: "TOP_BAR",
      suggestedDurationHours: 48,
      subheadline: "Re-engage shoppers who already hold or used a unique code.",
      description:
        "Objective: nurture code holders. Targets visitors who were assigned or have already used a unique discount code, a known engaged or returning audience. Includes assigned-but-not-yet-used codes so you can remind shoppers to redeem before they expire.",
      highlights: [
        "Behavior targeting: Used unique code (includes assigned-but-unused)",
        "Reminds shoppers to redeem a code before it expires",
        "Top-bar announcement for a loyalty follow-up",
      ],
      behaviorRules: {
        enabled: true,
        segments: ["USED_UNIQUE_CODE"],
        usedUniqueCodeIncludeAssigned: true,
        lookbackDays: 30,
      },
      design: {
        layout: "BALANCED",
        timerStyle: "BOXES",
      },
    },
  ),
  event(
    "window-shopper-nudge",
    "Window Shopper Nudge",
    "PRODUCT_LAUNCH",
    "FLASH_SALE",
    "PRODUCT_TIMER",
    {
      badgeText: "Take another look",
      ctaText: "Add to cart",
      discountText: "Liked what you saw? Make it yours",
      icon: "TAG",
      templateKey: "clean-minimal",
      recommendedPlacement: "PRODUCT_PAGE",
      suggestedDurationHours: 12,
      subheadline: "Nudge browsers who viewed products but didn't add to cart.",
      description:
        "Objective: convert window shoppers. Shows a product-page timer to visitors who viewed multiple product pages without adding anything to cart, giving an extra reason to take the next step.",
      highlights: [
        "Behavior targeting: Viewed product, no add to cart (2+ views)",
        "Product-page timer placed where the decision happens",
        "Add product tags in Targeting to focus on key collections",
      ],
      behaviorRules: {
        enabled: true,
        segments: ["VIEWED_PRODUCT_NO_ADD_TO_CART"],
        viewedProductMinViews: 2,
        lookbackDays: 14,
      },
      design: {
        layout: "STANDARD",
        timerStyle: "BOXES",
      },
    },
  ),
];

export function buildSystemCampaignTemplates() {
  return [...eventDefinitions, ...strategyDefinitions].flatMap((definition) =>
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

function buildTexts(definition, market) {
  const texts = buildBaseTexts(definition, market);

  // Strategy templates carry a short, scenario-specific subheadline.
  if (definition.settings.subheadline) {
    texts.subheadline = definition.settings.subheadline;
  }

  return texts;
}

function buildBaseTexts(definition) {
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
      freeShippingProgressText: "You're {{remaining_amount}} away from free shipping.",
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
    // Strategy templates additionally bundle behavior targeting, a written
    // explanation, and richer targeting. These are optional and only present on
    // strategy definitions.
    ...(settings.behaviorRules ? { behaviorRules: settings.behaviorRules } : {}),
    ...(settings.description ? { description: settings.description } : {}),
    ...(settings.highlights ? { highlights: settings.highlights } : {}),
    ...(settings.placements ? { placements: settings.placements } : {}),
    ...(settings.productTags ? { productTags: settings.productTags } : {}),
    ...(settings.devices ? { devices: settings.devices } : {}),
    ...(settings.urlContains ? { urlContains: settings.urlContains } : {}),
    ...(settings.utmSources ? { utmSources: settings.utmSources } : {}),
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
