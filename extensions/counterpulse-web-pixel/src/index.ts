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
  experimentId?: string | null;
  variantId?: string | null;
  placementType: string | null;
  visitorId?: string | null;
  sessionId?: string | null;
  lastPromoTouch?: number;
  seenAt?: number;
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

const visitorIdStorageKey = "counterpulse_visitor_id";
const sessionIdStorageKey = "counterpulse_session_id";
const attributionStorageKey = "counterpulse_last_seen_campaign";
const lastSeenCampaignIdStorageKey = "counterpulse_last_seen_campaign_id";
const lastSeenExperimentIdStorageKey = "counterpulse_last_seen_experiment_id";
const lastSeenVariantIdStorageKey = "counterpulse_last_seen_variant_id";
const lastPromoTouchStorageKey = "counterpulse_last_promo_touch";
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
  const visitorId = await getVisitorId(browser);
  const sessionId = await getSessionId(browser);
  const attribution = await getAttribution(browser);
  const checkout = readCheckout(event);
  const payload = {
    shop: config.shop,
    eventName,
    visitorId,
    sessionId,
    lastSeenCampaignId: attribution?.campaignId ?? null,
    lastSeenExperimentId: attribution?.experimentId ?? null,
    lastSeenVariantId: attribution?.variantId ?? null,
    lastSeenPlacementType: attribution?.placementType ?? null,
    lastPromoTouch: attribution?.lastPromoTouch
      ? String(attribution.lastPromoTouch)
      : null,
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

async function getVisitorId(browser: ExtensionApi["browser"]) {
  return getOrCreateBrowserStorageId(
    browser.localStorage,
    visitorIdStorageKey,
    "cpv",
  );
}

async function getSessionId(browser: ExtensionApi["browser"]) {
  return getOrCreateBrowserStorageId(
    browser.sessionStorage,
    sessionIdStorageKey,
    "cps",
  );
}

async function getOrCreateBrowserStorageId(
  storage: ExtensionApi["browser"]["localStorage"],
  key: string,
  prefix: string,
) {
  try {
    const existingId = await storage.getItem(key);

    if (typeof existingId === "string" && existingId) {
      return existingId;
    }

    const nextId = createTrackingId(prefix);
    await storage.setItem(key, nextId);
    return nextId;
  } catch {
    return createTrackingId(prefix);
  }
}

async function getAttribution(browser: ExtensionApi["browser"]) {
  const fromSnapshot = await getAttributionSnapshot(browser);

  if (fromSnapshot) {
    return fromSnapshot;
  }

  return getAttributionFromIndividualKeys(browser);
}

async function getAttributionSnapshot(browser: ExtensionApi["browser"]) {
  try {
    const value = await browser.localStorage.getItem(attributionStorageKey);
    const parsedValue = JSON.parse(
      String(value || "null"),
    ) as AttributionState | null;
    const lastPromoTouch = Number(
      parsedValue?.lastPromoTouch ?? parsedValue?.seenAt,
    );

    if (
      !parsedValue ||
      !parsedValue.campaignId ||
      !Number.isFinite(lastPromoTouch) ||
      Date.now() - lastPromoTouch > attributionMaxAgeMs
    ) {
      return null;
    }

    return {
      campaignId: parsedValue.campaignId,
      experimentId: parsedValue.experimentId ?? null,
      variantId: parsedValue.variantId ?? null,
      placementType: parsedValue.placementType ?? null,
      visitorId: parsedValue.visitorId ?? null,
      sessionId: parsedValue.sessionId ?? null,
      lastPromoTouch,
    } satisfies AttributionState;
  } catch {
    return null;
  }
}

async function getAttributionFromIndividualKeys(
  browser: ExtensionApi["browser"],
) {
  try {
    const [campaignId, experimentId, variantId, lastPromoTouchValue] =
      await Promise.all([
        browser.localStorage.getItem(lastSeenCampaignIdStorageKey),
        browser.localStorage.getItem(lastSeenExperimentIdStorageKey),
        browser.localStorage.getItem(lastSeenVariantIdStorageKey),
        browser.localStorage.getItem(lastPromoTouchStorageKey),
      ]);
    const lastPromoTouch = Number(lastPromoTouchValue);

    if (
      !campaignId ||
      !Number.isFinite(lastPromoTouch) ||
      Date.now() - lastPromoTouch > attributionMaxAgeMs
    ) {
      return null;
    }

    return {
      campaignId,
      experimentId: experimentId || null,
      variantId: variantId || null,
      placementType: null,
      lastPromoTouch,
    } satisfies AttributionState;
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

function createTrackingId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2)}`;
}
