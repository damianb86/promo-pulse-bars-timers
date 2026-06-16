import {
  register,
  type ExtensionApi,
  type PixelEvents,
} from "@shopify/web-pixels-extension";

type CounterPulsePixelEventName =
  | "page_viewed"
  | "product_viewed"
  | "collection_viewed"
  | "cart_viewed"
  | "product_added_to_cart"
  | "checkout_started"
  | "checkout_completed";

type AttributionState = {
  campaignId: string;
  placementType: string | null;
  seenAt: number;
};

const subscribedEvents: CounterPulsePixelEventName[] = [
  "page_viewed",
  "product_viewed",
  "collection_viewed",
  "cart_viewed",
  "product_added_to_cart",
  "checkout_started",
  "checkout_completed",
];

const sessionIdStorageKey = "counterpulse_session_id";
const attributionStorageKey = "counterpulse_last_seen_campaign";
const attributionMaxAgeMs = 24 * 60 * 60 * 1000;

register(({ analytics, browser, settings, init }) => {
  const config = {
    appEndpoint: readString(settings.appEndpoint) || "/api/analytics/pixel",
    shop:
      readString(settings.shop) ||
      readString(init.data.shop?.myshopifyDomain) ||
      "",
  };

  subscribedEvents.forEach((eventName) => {
    analytics.subscribe(eventName, (event) => {
      void sendPixelEvent(eventName, event, browser, config);
    });
  });
});

async function sendPixelEvent(
  eventName: CounterPulsePixelEventName,
  event: PixelEvents[CounterPulsePixelEventName],
  browser: ExtensionApi["browser"],
  config: { appEndpoint: string; shop: string },
) {
  const sessionId = await getSessionId(browser);
  const attribution = await getAttribution(browser);
  const checkout = readCheckout(event);
  const payload = {
    shop: config.shop,
    eventName,
    sessionId,
    lastSeenCampaignId: attribution?.campaignId ?? null,
    lastSeenPlacementType: attribution?.placementType ?? null,
    cartToken: readCartToken(event, checkout),
    orderId: checkout?.order?.id ?? null,
    revenueAmount: checkout?.totalPrice?.amount ?? null,
    currencyCode:
      checkout?.totalPrice?.currencyCode ?? checkout?.currencyCode ?? null,
    country: readCountry(event, checkout),
    locale: event.context.navigator.language ?? null,
    path: event.context.window.location?.pathname ?? null,
    userAgent: event.context.navigator.userAgent ?? null,
  };

  if (!payload.shop || !config.appEndpoint) return;

  try {
    await fetch(config.appEndpoint, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Pixel analytics must never affect storefront behavior.
  }
}

async function getSessionId(browser: ExtensionApi["browser"]) {
  try {
    const existingSessionId =
      await browser.localStorage.getItem(sessionIdStorageKey);

    if (typeof existingSessionId === "string" && existingSessionId) {
      return existingSessionId;
    }

    const nextSessionId = createSessionId();
    await browser.localStorage.setItem(sessionIdStorageKey, nextSessionId);
    return nextSessionId;
  } catch {
    return createSessionId();
  }
}

async function getAttribution(browser: ExtensionApi["browser"]) {
  try {
    const value = await browser.localStorage.getItem(attributionStorageKey);
    const parsedValue = JSON.parse(
      String(value || "null"),
    ) as AttributionState | null;

    if (
      !parsedValue ||
      !parsedValue.campaignId ||
      !Number.isFinite(parsedValue.seenAt) ||
      Date.now() - parsedValue.seenAt > attributionMaxAgeMs
    ) {
      return null;
    }

    return parsedValue;
  } catch {
    return null;
  }
}

function readCheckout(event: PixelEvents[CounterPulsePixelEventName]) {
  if (
    event.name === "checkout_started" ||
    event.name === "checkout_completed"
  ) {
    return event.data.checkout;
  }

  return null;
}

function readCartToken(
  event: PixelEvents[CounterPulsePixelEventName],
  checkout: ReturnType<typeof readCheckout>,
) {
  if (checkout?.token) return checkout.token;

  if (event.name === "cart_viewed") {
    return event.data.cart?.id ?? null;
  }

  return null;
}

function readCountry(
  event: PixelEvents[CounterPulsePixelEventName],
  checkout: ReturnType<typeof readCheckout>,
) {
  return (
    checkout?.localization?.country?.isoCode ??
    event.context.window.location?.hostname?.split(".").at(-1)?.toUpperCase() ??
    null
  );
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
