import { AnalyticsEventType, PlacementType } from "@prisma/client";

import { normalizeShopDomain } from "../utils/storefront-campaigns";

export const counterPulseWebPixelEventNames = [
  "page_viewed",
  "product_viewed",
  "collection_viewed",
  "cart_viewed",
  "product_added_to_cart",
  "checkout_started",
  "checkout_completed",
] as const;

export type PromoPulseWebPixelEventName =
  (typeof counterPulseWebPixelEventNames)[number];

export type PromoPulseWebPixelPayload = {
  shop: string;
  eventName: PromoPulseWebPixelEventName;
  visitorId: string | null;
  sessionId: string | null;
  lastSeenCampaignId: string | null;
  lastSeenExperimentId: string | null;
  lastSeenVariantId: string | null;
  lastSeenPlacementType: PlacementType | null;
  lastPromoTouch: string | null;
  cartToken: string | null;
  orderId: string | null;
  revenueAmount: string | null;
  currencyCode: string | null;
  country: string | null;
  locale: string | null;
  path: string | null;
  userAgent: string | null;
};

export type WebPixelAnalyticsPayload = {
  shop: string;
  campaignId: string;
  experimentId: string | null;
  variantId: string | null;
  visitorId: string | null;
  eventType: AnalyticsEventType;
  placementType: PlacementType | null;
  sessionId: string | null;
  cartToken: string | null;
  orderId: string | null;
  revenueAmount: string | null;
  currencyCode: string | null;
  country: string | null;
  locale: string | null;
  path: string | null;
  userAgent: string | null;
};

export type WebPixelMappingResult =
  | {
      ok: true;
      payload: WebPixelAnalyticsPayload;
    }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "unsupported_event"
        | "not_campaign_metric"
        | "missing_attribution";
      errors: string[];
    };

const campaignMetricEventTypes: Partial<
  Record<PromoPulseWebPixelEventName, AnalyticsEventType>
> = {
  product_viewed: AnalyticsEventType.PRODUCT_VIEWED,
  product_added_to_cart: AnalyticsEventType.ADD_TO_CART,
  checkout_started: AnalyticsEventType.CHECKOUT_STARTED,
  checkout_completed: AnalyticsEventType.ORDER_ATTRIBUTED,
};

const nonCampaignMetricEvents = new Set<PromoPulseWebPixelEventName>([
  "page_viewed",
  "collection_viewed",
  "cart_viewed",
]);

export function parsePromoPulseWebPixelPayload(
  value: unknown,
): PromoPulseWebPixelPayload | null {
  const input = readObject(value);
  const eventName = readWebPixelEventName(input.eventName);
  const shop = normalizeShopDomain(readText(input.shop, 255));

  if (!shop || !eventName) {
    return null;
  }

  return {
    shop,
    eventName,
    visitorId: readNullableText(input.visitorId, 255),
    sessionId: readNullableText(input.sessionId, 255),
    lastSeenCampaignId: readNullableText(input.lastSeenCampaignId, 255),
    lastSeenExperimentId: readNullableText(input.lastSeenExperimentId, 255),
    lastSeenVariantId: readNullableText(input.lastSeenVariantId, 255),
    lastSeenPlacementType: readPlacementType(input.lastSeenPlacementType),
    lastPromoTouch: readNullableText(input.lastPromoTouch, 64),
    cartToken: readNullableText(input.cartToken, 255),
    orderId: readNullableText(input.orderId, 255),
    revenueAmount: readRevenueAmount(input.revenueAmount),
    currencyCode: normalizeUppercaseText(input.currencyCode, 8),
    country: normalizeUppercaseText(input.country, 8),
    locale: readNullableText(input.locale, 32),
    path: readNullableText(input.path, 500),
    userAgent: readNullableText(input.userAgent, 500),
  };
}

export function mapWebPixelEventToAnalyticsPayload(
  value: unknown,
): WebPixelMappingResult {
  const payload = parsePromoPulseWebPixelPayload(value);

  if (!payload) {
    return {
      ok: false,
      reason: "invalid_payload",
      errors: ["shop and supported eventName are required."],
    };
  }

  if (nonCampaignMetricEvents.has(payload.eventName)) {
    return {
      ok: false,
      reason: "not_campaign_metric",
      errors: [],
    };
  }

  const eventType = campaignMetricEventTypes[payload.eventName];

  if (!eventType) {
    return {
      ok: false,
      reason: "unsupported_event",
      errors: [`${payload.eventName} is not tracked by Promo Pulse.`],
    };
  }

  if (!payload.lastSeenCampaignId) {
    return {
      ok: false,
      reason: "missing_attribution",
      errors: [
        "No recently rendered campaign was available for session attribution.",
      ],
    };
  }

  return {
    ok: true,
    payload: {
      shop: payload.shop,
      campaignId: payload.lastSeenCampaignId,
      experimentId: payload.lastSeenExperimentId,
      variantId: payload.lastSeenVariantId,
      visitorId: payload.visitorId,
      eventType,
      placementType: payload.lastSeenPlacementType,
      sessionId: payload.sessionId,
      cartToken: payload.cartToken,
      orderId: payload.orderId,
      revenueAmount:
        eventType === AnalyticsEventType.ORDER_ATTRIBUTED
          ? payload.revenueAmount
          : null,
      currencyCode: payload.currencyCode,
      country: payload.country,
      locale: payload.locale,
      path: payload.path,
      userAgent: payload.userAgent,
    },
  };
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readNullableText(value: unknown, maxLength: number) {
  const text = readText(value, maxLength);
  return text || null;
}

function normalizeUppercaseText(value: unknown, maxLength: number) {
  const text = readText(value, maxLength).toUpperCase();
  return text || null;
}

function readWebPixelEventName(value: unknown) {
  return counterPulseWebPixelEventNames.includes(
    value as PromoPulseWebPixelEventName,
  )
    ? (value as PromoPulseWebPixelEventName)
    : null;
}

function readPlacementType(value: unknown) {
  return Object.values(PlacementType).includes(value as PlacementType)
    ? (value as PlacementType)
    : null;
}

function readRevenueAmount(value: unknown) {
  if (value == null || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) && numberValue >= 0
    ? numberValue.toFixed(2)
    : null;
}
