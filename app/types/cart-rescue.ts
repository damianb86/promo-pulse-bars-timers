export const cartRescueReasonOptions = [
  {
    value: "CART_RESERVED",
    label: "Offer reserved",
    description:
      "Runs a visitor/session timer with safe copy about holding the offer, not Shopify inventory.",
    supported: true,
  },
  {
    value: "CHECKOUT_REMINDER",
    label: "Checkout reminder",
    description:
      "Shows a softer cart message without a timer or scarcity claim.",
    supported: true,
  },
] as const;

export type CartRescueReasonValue =
  (typeof cartRescueReasonOptions)[number]["value"];

export const supportedCartRescueReasonOptions = cartRescueReasonOptions.filter(
  (option) => option.supported,
);

export const supportedCartRescueReasons = new Set<string>(
  supportedCartRescueReasonOptions.map((option) => option.value),
);

export const cartRescueTimerStartOptions = [
  {
    value: "CART_VIEWED",
    label: "When the cart is seen",
    description:
      "Starts the countdown the first time the visitor opens the cart with items in it.",
  },
  {
    value: "FIRST_ITEM",
    label: "First item added",
    description:
      "Anchors the countdown to the cart's first item and never restarts, even if more items are added.",
  },
  {
    value: "LATEST_ITEM",
    label: "Latest cart change",
    description:
      "Restarts the countdown every time the cart contents change, keeping urgency fresh on each add.",
  },
  {
    value: "DISCOUNT_APPLIED",
    label: "Discount applied",
    description:
      "Starts the countdown only once a discount (code or automatic) is applied to the cart.",
  },
] as const;

export type CartRescueTimerStartValue =
  (typeof cartRescueTimerStartOptions)[number]["value"];

export const supportedCartRescueTimerStarts = new Set<string>(
  cartRescueTimerStartOptions.map((option) => option.value),
);

export const defaultCartRescueSettingsValues = {
  rescueReason: "CART_RESERVED" as CartRescueReasonValue,
  showTimer: true,
  showButton: true,
  timerStart: "CART_VIEWED" as CartRescueTimerStartValue,
  armBeforeStart: false,
};

export const cartRescueReasonCopyDefaults: Record<
  CartRescueReasonValue,
  {
    ctaText: string;
    ctaUrl: string;
    headline: string;
    showButton: boolean;
    showTimer: boolean;
    subheadline: string;
  }
> = {
  CART_RESERVED: {
    headline: "Your cart is ready",
    subheadline: "We will hold this offer for a limited time.",
    ctaText: "Checkout",
    ctaUrl: "/checkout",
    showTimer: true,
    showButton: true,
  },
  CHECKOUT_REMINDER: {
    headline: "Your cart is ready",
    subheadline: "Complete your order when you are ready.",
    ctaText: "Checkout",
    ctaUrl: "/checkout",
    showTimer: false,
    showButton: true,
  },
};

export function isSupportedCartRescueReason(
  value: string,
): value is CartRescueReasonValue {
  return supportedCartRescueReasons.has(value);
}

export function isSupportedCartRescueTimerStart(
  value: string,
): value is CartRescueTimerStartValue {
  return supportedCartRescueTimerStarts.has(value);
}
