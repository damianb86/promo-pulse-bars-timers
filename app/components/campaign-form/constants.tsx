
import type {} from "../DevicePreviewToggle";
import {
  type CampaignGoalValue,
  type CampaignTypeValue,
  type PlacementTypeValue,
} from "../../types/campaign-options";
import {
  type CampaignDesignValues,
} from "../../types/campaign-design";
import type {
  CampaignFormValues,
  CampaignTimerExpiredBehaviorValue,
  CampaignTimerModeValue,
  } from "../../types/campaign-form";
import {
  cartRescueReasonCopyDefaults,
  } from "../../types/cart-rescue";
import type {} from "../../types/ai-campaign";

export type ResourceFieldName = "productIds" | "excludeProductIds" | "collectionIds";
export type TextListFieldName =
  | ResourceFieldName
  | "productTags"
  | "countries"
  | "urlContains"
  | "excludedUrlContains";
export type UrlTargetingFieldName = "urlContains" | "excludedUrlContains";
export type UrlEligibilityMode = "include" | "exclude";
export type AiApplyValuesEventDetail = {
  design?: CampaignDesignValues;
  values?: Partial<CampaignFormValues>;
};

export type ResourceChip = {
  id: string;
  label: string;
};

export type ShopifyResourcePickerType = "product" | "collection";

export type ShopifyResourcePickerResult = Array<{
  id?: string;
  title?: string;
  handle?: string;
}>;

export type BuilderTabKey =
  | "setup"
  | "message"
  | "design"
  | "placement"
  | "targeting"
  | "schedule"
  | "review";

export const builderTabs: Array<{
  key: BuilderTabKey;
  label: string;
  title: string;
  pill: string;
  description: string;
}> = [
  {
    key: "setup",
    label: "Setup",
    title: "Campaign setup",
    pill: "Intent",
    description:
      "Define the campaign type and status before editing copy or placements.",
  },
  {
    key: "message",
    label: "Message",
    title: "Copy and call to action",
    pill: "Copy",
    description:
      "Write the customer-facing message and CTA that will appear in the live preview.",
  },
  {
    key: "design",
    label: "Design",
    title: "Design & preview",
    pill: "Design",
    description:
      "Style the campaign: layout, colors, timer, progress bar, and the HTML/CSS structure.",
  },
  {
    key: "placement",
    label: "Placement",
    title: "Storefront placement",
    pill: "Surface",
    description:
      "Choose the storefront surfaces where this campaign is allowed to render. Select more than one when the same campaign should appear in several places.",
  },
  {
    key: "targeting",
    label: "Targeting",
    title: "Product and audience targeting",
    pill: "Eligibility",
    description:
      "Limit which products, collections, tags, or countries can show this campaign. These filters are separate from where the widget is placed.",
  },
  {
    key: "schedule",
    label: "Schedule",
    title: "Timing and timezone",
    pill: "Real time",
    description:
      "Set real start/end timing and the UTC offset representative used for timer calculations.",
  },
  {
    key: "review",
    label: "Review",
    title: "Review before saving",
    pill: "Checks",
    description:
      "Check the important settings before confirming changes that can affect the storefront.",
  },
];

export const urlPageTargetingOptions = [
  {
    token: "page:home",
    label: "Home page",
    description: "Only the storefront root URL.",
    example: "/",
  },
  {
    token: "page:product",
    label: "Product pages",
    description: "Product detail pages, including collection product URLs.",
    example: "/products/...",
  },
  {
    token: "page:collection",
    label: "Collection pages",
    description: "Individual collection listing pages.",
    example: "/collections/summer",
  },
  {
    token: "page:collections",
    label: "All collections page",
    description: "The storefront collections index.",
    example: "/collections",
  },
  {
    token: "page:page",
    label: "Store pages",
    description: "About, contact, FAQ, and other Shopify pages.",
    example: "/pages/about",
  },
  {
    token: "page:cart",
    label: "Cart page",
    description: "The standard cart page.",
    example: "/cart",
  },
  {
    token: "page:search",
    label: "Search page",
    description: "Search results pages.",
    example: "/search",
  },
  {
    token: "page:blog",
    label: "Blogs and articles",
    description: "Blog index and article pages.",
    example: "/blogs/news",
  },
] as const;

export type UrlPageTargetingToken = (typeof urlPageTargetingOptions)[number]["token"];

export const urlPageTargetingTokenSet = new Set<string>(
  urlPageTargetingOptions.map((option) => option.token),
);

export const timerModeOptions: Array<{
  description: string;
  disabledFeature?: "recurringTimers";
  label: string;
  value: CampaignTimerModeValue;
}> = [
  {
    description: "Timer that ends at the specific date.",
    label: "Countdown to a date",
    value: "FIXED_DATE",
  },
  {
    description: "Individual fixed minutes countdown for each buyer session.",
    label: "Fixed minutes",
    value: "EVERGREEN_SESSION",
  },
  {
    description: "E.g. every day until the configured cutoff time.",
    disabledFeature: "recurringTimers",
    label: "Daily recurring timer",
    value: "RECURRING_DAILY",
  },
];

export const timerExpiredBehaviorOptions: Array<{
  label: string;
  value: CampaignTimerExpiredBehaviorValue;
}> = [
  { label: "Unpublish timer", value: "UNPUBLISH_TIMER" },
  { label: "Hide the timer for the buyer", value: "HIDE_TIMER" },
  { label: "Repeat the countdown", value: "REPEAT_COUNTDOWN" },
  { label: "Show custom title", value: "SHOW_CUSTOM_TITLE" },
  { label: "Do nothing", value: "DO_NOTHING" },
];

export const cartTimerResetBehaviorOptions: Array<{
  label: string;
  value: CampaignFormValues["cartTimerResetBehavior"];
}> = [
  { label: "Per cart session", value: "ON_SESSION_END" },
  { label: "Never reset for the visitor", value: "NEVER" },
  { label: "Reset daily", value: "DAILY" },
  { label: "Reset weekly", value: "WEEKLY" },
];

export const deliveryWeekdayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
] as const;

export const goalIconLabels: Record<CampaignFormValues["goal"], string> = {
  FLASH_SALE: "Flash sale",
  FREE_SHIPPING: "Free shipping",
  CART_RESCUE: "Cart rescue",
  DELIVERY_CUTOFF: "Delivery cutoff",
  LOW_STOCK_URGENCY: "Low stock urgency",
  PRODUCT_BADGE: "Product badge",
  ANNOUNCEMENT: "Announcement",
};

export type CampaignSetupPreset = {
  form?: Partial<CampaignFormValues>;
  goal?: CampaignGoalValue;
  placementType: PlacementTypeValue;
  type?: CampaignTypeValue;
};

export type CampaignTypeChoice = {
  description: string;
  goal: CampaignGoalValue;
  icon: "goal" | "type";
  label: string;
  type: CampaignTypeValue;
  value: string;
};

export const campaignTypeSetupPresets: Record<CampaignTypeValue, CampaignSetupPreset> =
  {
    COUNTDOWN_BAR: {
      form: {
        timerExpiredBehavior: "UNPUBLISH_TIMER",
        timerMode: "FIXED_DATE",
      },
      placementType: "TOP_BAR",
    },
    PRODUCT_TIMER: {
      form: {
        timerExpiredBehavior: "UNPUBLISH_TIMER",
        timerMode: "FIXED_DATE",
      },
      placementType: "PRODUCT_PAGE",
    },
    CART_TIMER: {
      form: {
        cartRescueReason: "CART_RESERVED",
        cartRescueShowButton: true,
        cartRescueShowTimer: true,
        cartRescueTimerStart: "CART_VIEWED",
        cartRescueArmBeforeStart: false,
        cartTimerDurationMinutes: "120",
        cartTimerResetBehavior: "ON_SESSION_END",
        ctaText: cartRescueReasonCopyDefaults.CART_RESERVED.ctaText,
        ctaUrl: cartRescueReasonCopyDefaults.CART_RESERVED.ctaUrl,
        headline: cartRescueReasonCopyDefaults.CART_RESERVED.headline,
        subheadline: cartRescueReasonCopyDefaults.CART_RESERVED.subheadline,
        timerDurationMinutes: "120",
        timerExpiredBehavior: "HIDE_TIMER",
        timerMode: "EVERGREEN_SESSION",
        timerResetBehavior: "ON_SESSION_END",
      },
      goal: "CART_RESCUE",
      placementType: "CART_DRAWER",
    },
    FREE_SHIPPING_GOAL: {
      form: {
        freeShippingAutoDiscount: true,
        freeShippingDiscountCode: "",
        freeShippingExistingDiscount: "",
        freeShippingDiscountTitle: "Promo Pulse free shipping",
        timerExpiredBehavior: "DO_NOTHING",
        timerMode: "FIXED_DATE",
      },
      goal: "FREE_SHIPPING",
      placementType: "CART_DRAWER",
    },
    DELIVERY_CUTOFF: {
      form: {
        deliveryAfterCutoffBehavior: "SHOW_NEXT_WINDOW",
        deliveryCutoffHour: "14",
        deliveryCutoffMinute: "0",
        deliveryMaxDays: "5",
        deliveryMinDays: "2",
        deliveryProcessingDays: "0",
        deliveryWorkingDays: "1,2,3,4,5",
        timerExpiredBehavior: "UNPUBLISH_TIMER",
        timerMode: "FIXED_DATE",
      },
      goal: "DELIVERY_CUTOFF",
      placementType: "PRODUCT_PAGE",
    },
    LOW_STOCK: {
      form: {
        lowStockFallbackMessage: "Only a few left",
        lowStockShowExactQuantity: false,
        lowStockThreshold: "5",
        timerExpiredBehavior: "DO_NOTHING",
        timerMode: "FIXED_DATE",
      },
      goal: "LOW_STOCK_URGENCY",
      placementType: "PRODUCT_PAGE",
    },
    PRODUCT_BADGE: {
      form: {
        badgePosition: "TOP_RIGHT",
        badgeShape: "PILL",
        badgeText: "Limited offer",
        timerExpiredBehavior: "DO_NOTHING",
        timerMode: "FIXED_DATE",
      },
      goal: "PRODUCT_BADGE",
      placementType: "COLLECTION_CARD",
    },
  };

export const campaignGoalSetupPresets: Record<CampaignGoalValue, CampaignSetupPreset> =
  {
    FLASH_SALE: {
      ...campaignTypeSetupPresets.COUNTDOWN_BAR,
      type: "COUNTDOWN_BAR",
    },
    FREE_SHIPPING: {
      ...campaignTypeSetupPresets.FREE_SHIPPING_GOAL,
      type: "FREE_SHIPPING_GOAL",
    },
    CART_RESCUE: {
      ...campaignTypeSetupPresets.CART_TIMER,
      type: "CART_TIMER",
    },
    DELIVERY_CUTOFF: {
      ...campaignTypeSetupPresets.DELIVERY_CUTOFF,
      type: "DELIVERY_CUTOFF",
    },
    LOW_STOCK_URGENCY: {
      ...campaignTypeSetupPresets.LOW_STOCK,
      type: "LOW_STOCK",
    },
    PRODUCT_BADGE: {
      ...campaignTypeSetupPresets.PRODUCT_BADGE,
      type: "PRODUCT_BADGE",
    },
    ANNOUNCEMENT: {
      form: {
        timerExpiredBehavior: "DO_NOTHING",
        timerMode: "FIXED_DATE",
      },
      placementType: "TOP_BAR",
      type: "COUNTDOWN_BAR",
    },
  };

export const campaignTypeChoiceOptions: CampaignTypeChoice[] = [
  {
    description:
      "A sitewide urgency bar with timer and CTA. Best for short sales or announcements with a clear deadline.",
    goal: "FLASH_SALE",
    icon: "goal",
    label: "Flash sale",
    type: "COUNTDOWN_BAR",
    value: "FLASH_SALE",
  },
  {
    description:
      "A focused countdown near product content when urgency belongs to a product offer.",
    goal: "FLASH_SALE",
    icon: "type",
    label: "Product timer",
    type: "PRODUCT_TIMER",
    value: "PRODUCT_TIMER",
  },
  {
    description:
      "A cart or drawer timer for checkout urgency and cart rescue flows.",
    goal: "CART_RESCUE",
    icon: "goal",
    label: "Cart rescue",
    type: "CART_TIMER",
    value: "CART_RESCUE",
  },
  {
    description:
      "A cart progress campaign tied to a real free-shipping threshold.",
    goal: "FREE_SHIPPING",
    icon: "goal",
    label: "Free shipping",
    type: "FREE_SHIPPING_GOAL",
    value: "FREE_SHIPPING",
  },
  {
    description:
      "An order-by timer based on cutoff time, timezone, and delivery settings.",
    goal: "DELIVERY_CUTOFF",
    icon: "goal",
    label: "Delivery cutoff",
    type: "DELIVERY_CUTOFF",
    value: "DELIVERY_CUTOFF",
  },
  {
    description:
      "Inventory-aware urgency messaging without fake scarcity claims.",
    goal: "LOW_STOCK_URGENCY",
    icon: "goal",
    label: "Low stock urgency",
    type: "LOW_STOCK",
    value: "LOW_STOCK_URGENCY",
  },
  {
    description:
      "A compact product or collection badge for merchandising messages.",
    goal: "PRODUCT_BADGE",
    icon: "goal",
    label: "Product badge",
    type: "PRODUCT_BADGE",
    value: "PRODUCT_BADGE",
  },
  {
    description:
      "A general storefront announcement without a discount or scarcity assumption.",
    goal: "ANNOUNCEMENT",
    icon: "goal",
    label: "Announcement",
    type: "COUNTDOWN_BAR",
    value: "ANNOUNCEMENT",
  },
];

