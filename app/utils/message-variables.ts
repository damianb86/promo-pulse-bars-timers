// Single source of truth for the dynamic message variables. Drives the Message
// tab help modal, the AI prompt (so the model knows which tokens exist), and the
// docs. The actual VALUES are produced per runtime (React preview in
// CampaignPreview.tsx, storefront in the theme JS) — this file only declares the
// canonical token names, what they mean, and which campaign types expose them.
//
// Canonical tokens only: there are no aliases. One concept = one token.

export type MessageVariableScope =
  | "global"
  | "timer"
  | "free_shipping"
  | "low_stock"
  | "delivery"
  | "badge";

export type MessageVariable = {
  // Token name WITHOUT the surrounding braces, e.g. "remaining_amount".
  token: string;
  description: string;
  example: string;
  scope: MessageVariableScope;
};

export const MESSAGE_VARIABLES: MessageVariable[] = [
  // --- Global: available in every campaign type ---
  {
    token: "year",
    description: "The current calendar year.",
    example: "2026",
    scope: "global",
  },
  {
    token: "month",
    description: "The current month name (storefront locale).",
    example: "April",
    scope: "global",
  },
  {
    token: "day",
    description: "The current day of the month.",
    example: "15",
    scope: "global",
  },
  {
    token: "weekday",
    description: "The current weekday name (storefront locale).",
    example: "Tuesday",
    scope: "global",
  },
  {
    token: "date",
    description: "The current date (storefront locale).",
    example: "Apr 15, 2026",
    scope: "global",
  },
  {
    token: "time",
    description: "The current time (storefront locale).",
    example: "2:30 PM",
    scope: "global",
  },

  // --- Timer / countdown ---
  {
    token: "time_left",
    description:
      "Live countdown remaining, shown whenever the campaign has an active timer or delivery cutoff.",
    example: "02h 15m",
    scope: "timer",
  },
  {
    token: "days_left",
    description: "Whole days remaining on the countdown.",
    example: "3",
    scope: "timer",
  },
  {
    token: "hours_left",
    description: "Hours component of the countdown (00–23).",
    example: "08",
    scope: "timer",
  },
  {
    token: "minutes_left",
    description: "Minutes component of the countdown (00–59).",
    example: "45",
    scope: "timer",
  },
  {
    token: "seconds_left",
    description: "Seconds component of the countdown (00–59).",
    example: "30",
    scope: "timer",
  },
  {
    token: "end_date",
    description: "Date the timer ends (campaign timezone + storefront locale).",
    example: "Apr 15",
    scope: "timer",
  },
  {
    token: "end_time",
    description: "Time the timer ends (campaign timezone + storefront locale).",
    example: "11:59 PM",
    scope: "timer",
  },

  // --- Free shipping ---
  {
    token: "remaining_amount",
    description:
      "Amount still needed to reach the free-shipping threshold, in the cart currency.",
    example: "$24.00",
    scope: "free_shipping",
  },
  {
    token: "cart_subtotal",
    description:
      "How much the customer has already added — the current cart subtotal, in the cart currency.",
    example: "$51.00",
    scope: "free_shipping",
  },
  {
    token: "threshold_amount",
    description: "The free-shipping goal amount, in the cart currency.",
    example: "$75.00",
    scope: "free_shipping",
  },
  {
    token: "progress_percent",
    description:
      "How far the cart is toward the free-shipping goal, as a whole percentage.",
    example: "68%",
    scope: "free_shipping",
  },
  {
    token: "remaining_percent",
    description: "Percentage still remaining to reach the goal.",
    example: "32%",
    scope: "free_shipping",
  },

  // --- Low stock ---
  {
    token: "quantity",
    description: "Remaining units in stock (when Shopify exposes a quantity).",
    example: "7",
    scope: "low_stock",
  },

  // --- Delivery cutoff ---
  {
    token: "cutoff_time",
    description: "Time of the daily order cutoff.",
    example: "2:00 PM",
    scope: "delivery",
  },
  {
    token: "delivery_range",
    description: "Estimated delivery window (min to max date).",
    example: "Apr 12-Apr 15",
    scope: "delivery",
  },
  {
    token: "ships_date",
    description: "Date the order is expected to ship.",
    example: "Apr 10",
    scope: "delivery",
  },
  {
    token: "ships_weekday",
    description: "Weekday the order is expected to ship.",
    example: "Wednesday",
    scope: "delivery",
  },
  {
    token: "min_delivery_date",
    description: "Earliest estimated delivery date.",
    example: "Apr 12",
    scope: "delivery",
  },
  {
    token: "min_delivery_weekday",
    description: "Earliest estimated delivery weekday.",
    example: "Friday",
    scope: "delivery",
  },
  {
    token: "max_delivery_date",
    description: "Latest estimated delivery date.",
    example: "Apr 15",
    scope: "delivery",
  },
  {
    token: "max_delivery_weekday",
    description: "Latest estimated delivery weekday.",
    example: "Monday",
    scope: "delivery",
  },
];

// Which scopes apply to a given campaign type. Global is always included.
export function variableScopesForType(type: string): MessageVariableScope[] {
  switch (type) {
    case "FREE_SHIPPING_GOAL":
      return ["global", "free_shipping"];
    case "LOW_STOCK":
      return ["global", "low_stock"];
    case "DELIVERY_CUTOFF":
      return ["global", "delivery"];
    case "PRODUCT_BADGE":
      return ["global", "timer"];
    default:
      // COUNTDOWN_BAR, PRODUCT_TIMER, CART_TIMER — countdown-driven.
      return ["global", "timer"];
  }
}

export function messageVariablesForType(type: string): MessageVariable[] {
  const scopes = new Set(variableScopesForType(type));
  return MESSAGE_VARIABLES.filter((variable) => scopes.has(variable.scope));
}

const SCOPE_LABELS: Record<MessageVariableScope, string> = {
  global: "Global (any campaign type)",
  timer: "Timer / countdown",
  free_shipping: "Free shipping",
  low_stock: "Low stock",
  delivery: "Delivery cutoff",
  badge: "Product badge",
};

export function messageVariableScopeLabel(scope: MessageVariableScope): string {
  return SCOPE_LABELS[scope];
}

// Compact, plain-text catalog for the AI prompt so the model knows exactly which
// tokens it may use (and that there are no aliases).
export function describeMessageVariablesForAi(): string {
  const byScope = new Map<MessageVariableScope, MessageVariable[]>();
  for (const variable of MESSAGE_VARIABLES) {
    const list = byScope.get(variable.scope) ?? [];
    list.push(variable);
    byScope.set(variable.scope, list);
  }
  const lines: string[] = [
    "Dynamic message variables — wrap a token in {{double braces}} inside any",
    "message field OR anywhere in the structural HTML text, and it is replaced",
    "live on the storefront. Use ONLY these exact tokens (there are no aliases):",
  ];
  for (const [scope, variables] of byScope) {
    lines.push(`- ${SCOPE_LABELS[scope]}:`);
    for (const variable of variables) {
      lines.push(
        `    {{${variable.token}}} — ${variable.description} (e.g. ${variable.example})`,
      );
    }
  }
  lines.push(
    "Only the variables for the chosen campaign type resolve; unknown tokens are",
    "left untouched. Free-shipping money + percentage tokens only resolve for",
    "FREE_SHIPPING_GOAL, quantity only for LOW_STOCK, delivery_* only for",
    "DELIVERY_CUTOFF, and the countdown tokens only when a timer/cutoff is active.",
  );
  return lines.join("\n");
}
