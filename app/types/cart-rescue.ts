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
  {
    value: "FREE_SHIPPING_GOAL",
    label: "Free shipping goal",
    description:
      "Uses the real cart subtotal and configured threshold to show the remaining amount.",
    supported: true,
  },
  {
    value: "OFFER_EXPIRES",
    label: "Offer expires",
    description:
      "Requires tighter discount-code or automatic-discount expiry sync before it can make a real expiry claim.",
    supported: false,
  },
  {
    value: "SHIPPING_CUTOFF",
    label: "Shipping cutoff",
    description:
      "Requires cart-surface delivery cutoff wiring before it can promise ship-today urgency.",
    supported: false,
  },
  {
    value: "LOW_STOCK_RISK",
    label: "Low stock risk",
    description:
      "Requires reliable inventory for every cart line. Promo Pulse will not invent stock urgency.",
    supported: false,
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

export const defaultCartRescueSettingsValues = {
  rescueReason: "CART_RESERVED" as CartRescueReasonValue,
  showTimer: true,
  showButton: true,
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
  FREE_SHIPPING_GOAL: {
    headline: "You are close to free shipping",
    subheadline: "Add a little more to unlock shipping benefits.",
    ctaText: "Checkout",
    ctaUrl: "/checkout",
    showTimer: false,
    showButton: true,
  },
  OFFER_EXPIRES: {
    headline: "Offer availability",
    subheadline:
      "Connect a real Shopify discount expiry before using this reason.",
    ctaText: "Checkout",
    ctaUrl: "/checkout",
    showTimer: false,
    showButton: true,
  },
  SHIPPING_CUTOFF: {
    headline: "Shipping window",
    subheadline: "Connect delivery cutoff rules before using this reason.",
    ctaText: "Checkout",
    ctaUrl: "/checkout",
    showTimer: false,
    showButton: true,
  },
  LOW_STOCK_RISK: {
    headline: "Cart availability",
    subheadline: "Connect cart-line inventory before using this reason.",
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

export function isCartRescueFreeShippingReason(value: {
  cartRescueReason?: string;
  goal?: string;
  type?: string;
}) {
  return (
    (value.type === "CART_TIMER" || value.goal === "CART_RESCUE") &&
    value.cartRescueReason === "FREE_SHIPPING_GOAL"
  );
}
