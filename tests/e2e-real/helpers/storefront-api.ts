import type { Page } from "@playwright/test";

import { getConfig } from "./env";

export type StorefrontCampaignApiOptions = Partial<{
  campaignId: string;
  cartSubtotal: string;
  collectionIds: string;
  consentGranted: string;
  country: string;
  currency: string;
  device: "desktop" | "mobile" | "tablet";
  doNotTrack: string;
  locale: string;
  market: string;
  path: string;
  placement: string;
  productId: string;
  productTags: string;
  sessionId: string;
  utmSource: string;
  visitorId: string;
}>;

export type StorefrontCampaignApiPayload = {
  campaigns?: Array<{
    id: string;
    type: string;
    goal: string;
    placement: string;
    texts: Record<string, string>;
    discount?: {
      method?: string;
      discountCode?: string | null;
      uniqueCode?: {
        autoApply: boolean;
        endpoint: string;
        expiresMinutes: number | null;
      } | null;
    } | null;
    experiment?: {
      id: string;
      variants: Array<{
        id: string;
        name: string;
        textOverride?: Record<string, unknown>;
        weight: number;
      }>;
    } | null;
    freeShipping?: {
      currencyCode: string;
      thresholdAmount: string;
    } | null;
    deliveryCutoff?: {
      cutoffHour: number;
      minDeliveryDays: number;
      maxDeliveryDays: number;
    } | null;
    lowStock?: {
      fallbackMessage?: string | null;
      showExactQuantity: boolean;
      threshold: number;
    } | null;
    badge?: {
      badgeText: string;
    } | null;
  }>;
};

export async function fetchStorefrontCampaigns(
  page: Page,
  options: StorefrontCampaignApiOptions = {},
) {
  return page.evaluate(
    async ({ options: inputOptions, shopDomain }) => {
      const url = new URL("/apps/promo-pulse", window.location.origin);
      const defaults = {
        cartSubtotal: "",
        collectionIds: "",
        consentGranted: "true",
        country: "US",
        currency: "USD",
        device: "desktop",
        doNotTrack: "false",
        locale: "en",
        market: "US",
        path: window.location.pathname || "/",
        placement: "TOP_BAR",
        productId: "",
        productTags: "",
        sessionId: `cps_${Date.now()}`,
        shop: shopDomain,
        utmSource: "",
        visitorId: `cpv_${Date.now()}`,
      };
      const params = { ...defaults, ...inputOptions };

      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && String(value) !== "") {
          url.searchParams.set(key, String(value));
        }
      }

      const response = await fetch(url.toString(), {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      return {
        body: (await response.json()) as StorefrontCampaignApiPayload,
        cacheControl: response.headers.get("cache-control") ?? "",
        etag: response.headers.get("etag") ?? "",
        ok: response.ok,
        status: response.status,
      };
    },
    { options, shopDomain: getConfig().shopDomain },
  );
}

export async function postStorefrontAnalyticsEvent(
  page: Page,
  payload: Record<string, unknown>,
) {
  return page.evaluate(
    async ({ payload: inputPayload, shopDomain }) => {
      const response = await fetch("/apps/promo-pulse", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop: shopDomain,
          doNotTrack: false,
          consentGranted: true,
          ...inputPayload,
        }),
      });

      return {
        body: await response.json(),
        ok: response.ok,
        status: response.status,
      };
    },
    { payload, shopDomain: getConfig().shopDomain },
  );
}

export function expectCampaignPayload(
  payload: StorefrontCampaignApiPayload,
  campaignId: string,
) {
  return payload.campaigns?.find((campaign) => campaign.id === campaignId);
}

export function readPngSize(buffer: Buffer) {
  if (
    buffer.length < 24 ||
    buffer.toString("ascii", 1, 4) !== "PNG" ||
    buffer.readUInt32BE(12) !== 0x49484452
  ) {
    throw new Error("Expected a PNG image buffer.");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}
