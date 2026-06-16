import type {
  CampaignGoalValue,
  CampaignTypeValue,
  PlacementTypeValue,
} from "./campaign-options";

export type OnboardingGoalValue =
  | "FLASH_SALE"
  | "FREE_SHIPPING"
  | "DELIVERY_CUTOFF"
  | "CART_RESCUE";

export type OnboardingLocationValue = "TOP_BAR" | "PRODUCT_PAGE" | "CART";

export type OnboardingChecklistField =
  | "firstCampaignCreated"
  | "appEmbedEnabled"
  | "productBlockAdded"
  | "cartBlockAdded"
  | "firstImpressionReceived";

export type OnboardingChecklistStatus = Record<
  OnboardingChecklistField,
  boolean
>;

export type StarterCampaignDefaults = {
  goal: CampaignGoalValue;
  type: CampaignTypeValue;
  placementType: PlacementTypeValue;
  name: string;
  templateKey: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
};

export const onboardingGoalOptions: Array<{
  value: OnboardingGoalValue;
  label: string;
  description: string;
}> = [
  {
    value: "FLASH_SALE",
    label: "Flash sale",
    description: "Launch a countdown bar for a limited-time offer.",
  },
  {
    value: "FREE_SHIPPING",
    label: "Free shipping",
    description: "Show shoppers how close they are to free shipping.",
  },
  {
    value: "DELIVERY_CUTOFF",
    label: "Delivery cutoff",
    description: "Create urgency around today's shipping cutoff.",
  },
  {
    value: "CART_RESCUE",
    label: "Cart rescue",
    description: "Add a cart timer to encourage checkout completion.",
  },
];

export const onboardingLocationOptions: Array<{
  value: OnboardingLocationValue;
  label: string;
  description: string;
}> = [
  {
    value: "TOP_BAR",
    label: "Top bar",
    description: "Best for global announcements and flash sale banners.",
  },
  {
    value: "PRODUCT_PAGE",
    label: "Product page",
    description: "Best for product timers, delivery promises, and stock cues.",
  },
  {
    value: "CART",
    label: "Cart",
    description: "Best for cart page timers and free shipping goals.",
  },
];
