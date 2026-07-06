import { AnalyticsEventType } from "@prisma/client";

import prisma from "../../db.server";
import {
  recordAnalyticsEvent,
  validateAnalyticsEventPayload,
} from "../../models/analytics.server";
import { normalizeShopDomain } from "../../utils/storefront-campaigns";

export type AttributeOrderInput = {
  shopDomain: string;
  order: Record<string, unknown>;
  now?: Date;
};

export type AttributeCheckoutInput = {
  shopDomain: string;
  checkout: Record<string, unknown>;
  now?: Date;
};

export type AttributeOrderResult = {
  attributed: boolean;
  reason?:
    | "shop_not_found"
    | "missing_order_id"
    | "missing_cart_token"
    | "already_attributed"
    | "no_campaign_touch"
    | "gated";
  campaignId?: string;
  revenueAmount?: string | null;
};

export type AttributeCheckoutResult = {
  attributed: boolean;
  reason?:
    | "shop_not_found"
    | "missing_cart_token"
    | "already_attributed"
    | "no_campaign_touch"
    | "gated";
  campaignId?: string;
};

// Attributes a completed order to the campaign the buyer interacted with, using
// the cart token that the storefront records on ADD_TO_CART / CHECKOUT_STARTED
// events. This is the RELIABLE order/revenue path: the Shopify web pixel runs in
// a sandbox that cannot read the storefront's campaign attribution, so orders
// are attributed server-side from the orders/create webhook instead.
export async function attributeOrderRevenue({
  shopDomain,
  order,
  now = new Date(),
}: AttributeOrderInput): Promise<AttributeOrderResult> {
  const shopifyDomain = normalizeShopDomain(shopDomain);
  if (!shopifyDomain) return { attributed: false, reason: "shop_not_found" };

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain },
    select: { id: true },
  });
  if (!shop) return { attributed: false, reason: "shop_not_found" };

  const orderId = readOrderId(order);
  if (!orderId) return { attributed: false, reason: "missing_order_id" };

  const cartToken = readCartToken(order);
  if (!cartToken) return { attributed: false, reason: "missing_cart_token" };

  // Webhook retries deliver the same order more than once; never double-count.
  const alreadyAttributed = await prisma.analyticsEvent.findFirst({
    where: {
      shopId: shop.id,
      orderId,
      eventType: AnalyticsEventType.ORDER_ATTRIBUTED,
    },
    select: { id: true },
  });
  if (alreadyAttributed) {
    return { attributed: false, reason: "already_attributed" };
  }

  // The most recent campaign touch that shared this cart token owns the order.
  const touch = await findCartTokenTouch(shop.id, cartToken);
  if (!touch?.campaignId) {
    return { attributed: false, reason: "no_campaign_touch" };
  }

  const revenueAmount = readMoney(order.total_price ?? order.current_total_price);
  const currencyCode = readCurrency(order);

  const validation = validateAnalyticsEventPayload({
    shop: shopifyDomain,
    campaignId: touch.campaignId,
    // Experiment/variant are enriched from the last attributable touch inside
    // recordAnalyticsEvent (via sessionId), so they are left null here.
    experimentId: null,
    variantId: null,
    visitorId: null,
    eventType: "ORDER_ATTRIBUTED",
    placementType: touch.placementType,
    sessionId: touch.sessionId,
    cartToken,
    orderId,
    revenueAmount,
    currencyCode,
    country: touch.country,
    locale: touch.locale,
    path: null,
    userAgent: null,
    // A completed order is first-party purchase data, always attributable.
    doNotTrack: false,
    consentGranted: true,
  });

  if (!validation.ok) {
    return { attributed: false, reason: "no_campaign_touch" };
  }

  const result = await recordAnalyticsEvent(validation.payload, now);
  if (!result.saved) {
    return { attributed: false, reason: "gated" };
  }

  return {
    attributed: true,
    campaignId: touch.campaignId,
    revenueAmount,
  };
}

// Records a CHECKOUT_STARTED event for the campaign the buyer engaged with when
// Shopify creates a checkout. This is the reliable server-side checkout signal
// (the storefront theme can only guess at "checkout" button clicks, and the web
// pixel cannot attribute from its sandbox). Idempotent per cart token, so it
// never double-counts against a checkout already recorded for the same cart.
export async function attributeCheckoutStarted({
  shopDomain,
  checkout,
  now = new Date(),
}: AttributeCheckoutInput): Promise<AttributeCheckoutResult> {
  const shopifyDomain = normalizeShopDomain(shopDomain);
  if (!shopifyDomain) return { attributed: false, reason: "shop_not_found" };

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain },
    select: { id: true },
  });
  if (!shop) return { attributed: false, reason: "shop_not_found" };

  const cartToken = readCartToken(checkout);
  if (!cartToken) return { attributed: false, reason: "missing_cart_token" };

  // Skip if a checkout was already recorded for this cart — whether by a prior
  // webhook delivery or by the storefront theme's own checkout tracking.
  const existing = await prisma.analyticsEvent.findFirst({
    where: {
      shopId: shop.id,
      cartToken,
      eventType: AnalyticsEventType.CHECKOUT_STARTED,
    },
    select: { id: true },
  });
  if (existing) return { attributed: false, reason: "already_attributed" };

  const touch = await findCartTokenTouch(shop.id, cartToken);
  if (!touch?.campaignId) {
    return { attributed: false, reason: "no_campaign_touch" };
  }

  const validation = validateAnalyticsEventPayload({
    shop: shopifyDomain,
    campaignId: touch.campaignId,
    experimentId: null,
    variantId: null,
    visitorId: null,
    eventType: "CHECKOUT_STARTED",
    placementType: touch.placementType,
    sessionId: touch.sessionId,
    cartToken,
    orderId: null,
    revenueAmount: null,
    currencyCode: readCurrency(checkout),
    country: touch.country,
    locale: touch.locale,
    path: null,
    userAgent: null,
    doNotTrack: false,
    consentGranted: true,
  });

  if (!validation.ok) return { attributed: false, reason: "no_campaign_touch" };

  const result = await recordAnalyticsEvent(validation.payload, now);
  if (!result.saved) return { attributed: false, reason: "gated" };

  return { attributed: true, campaignId: touch.campaignId };
}

// The most recent campaign touch (impression/click/add-to-cart) that shared a
// cart token owns the checkout/order for that cart.
async function findCartTokenTouch(shopId: string, cartToken: string) {
  return prisma.analyticsEvent.findFirst({
    where: { shopId, cartToken, campaignId: { not: null } },
    orderBy: { occurredAt: "desc" },
    select: {
      campaignId: true,
      sessionId: true,
      placementType: true,
      country: true,
      locale: true,
    },
  });
}

function readOrderId(order: Record<string, unknown>): string | null {
  return (
    readString(order.admin_graphql_api_id) || readString(order.id) || null
  );
}

// Shopify sends `cart_token` on storefront orders and `checkout_token` as a
// fallback; the storefront records the same `cart_token` on its cart events.
function readCartToken(order: Record<string, unknown>): string | null {
  return (
    readString(order.cart_token) || readString(order.checkout_token) || null
  );
}

function readCurrency(order: Record<string, unknown>): string | null {
  return (
    readString(order.currency) ||
    readString(order.presentment_currency) ||
    null
  );
}

function readMoney(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : null;
  }
  return null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
