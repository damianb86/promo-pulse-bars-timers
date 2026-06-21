export const POST_PURCHASE_CAMPAIGN_PATH = "/api/post-purchase/campaign";
export const APP_PROXY_POST_PURCHASE_CAMPAIGN_PATH =
  "/apps/promo-pulse/api/post-purchase/campaign";
export const APP_PROXY_ANALYTICS_PATH = "/apps/promo-pulse";

export function normalizePostPurchaseSettings(settings = {}) {
  const mode =
    settings.mode === "SPECIFIC_CAMPAIGN"
      ? "SPECIFIC_CAMPAIGN"
      : "AUTO_ELIGIBLE";

  return {
    campaignId: readString(settings.campaignId),
    mode,
    compactMode: readBoolean(settings.compactMode, false),
    showTimer: readBoolean(settings.showTimer, true),
    apiBaseUrl: readString(settings.apiBaseUrl || settings.appEndpoint),
  };
}

/**
 * @param {{
 *   settings?: Record<string, unknown>,
 *   shopDomain?: string,
 *   storefrontUrl?: string,
 *   surface?: string,
 *   currencyCode?: string,
 *   countryCode?: string,
 *   locale?: string,
 *   marketHandle?: string,
 *   appliedDiscountCodes?: string[],
 * }} input
 */
export function buildPostPurchaseCampaignRequest({
  settings,
  shopDomain,
  storefrontUrl,
  surface,
  currencyCode,
  countryCode,
  locale,
  marketHandle,
  appliedDiscountCodes = [],
}) {
  const normalizedSettings = normalizePostPurchaseSettings(settings);
  const endpoint = resolvePostPurchaseCampaignEndpoint({
    apiBaseUrl: normalizedSettings.apiBaseUrl,
    shopDomain,
    storefrontUrl,
  });
  const resolvedSurface =
    surface === "ORDER_STATUS_PAGE" ? "ORDER_STATUS_PAGE" : "THANK_YOU_PAGE";

  if (!endpoint.url || !endpoint.shop) {
    return {
      url: "",
      cacheKey: "missing-shop",
      requiresSessionToken: false,
    };
  }

  if (
    normalizedSettings.mode === "SPECIFIC_CAMPAIGN" &&
    !normalizedSettings.campaignId
  ) {
    return {
      url: "",
      cacheKey: "missing-campaign",
      requiresSessionToken: false,
    };
  }

  const params = new URLSearchParams({
    shop: endpoint.shop,
    mode: normalizedSettings.mode,
    surface: resolvedSurface,
    compactMode: String(normalizedSettings.compactMode),
    showTimer: String(normalizedSettings.showTimer),
    path: resolvedSurface === "THANK_YOU_PAGE" ? "/thank-you" : "/order-status",
    placement: resolvedSurface,
  });
  const currency = readString(currencyCode).toUpperCase();
  const country = readString(countryCode).toUpperCase();
  const selectedLocale = readString(locale);
  const market = readString(marketHandle).toUpperCase();
  const appliedCodes = appliedDiscountCodes
    .map((code) => readString(code))
    .filter(Boolean);

  if (normalizedSettings.mode === "SPECIFIC_CAMPAIGN") {
    params.set("campaignId", normalizedSettings.campaignId);
  }
  if (currency) params.set("currency", currency);
  if (country) params.set("country", country);
  if (selectedLocale) params.set("locale", selectedLocale);
  if (market) params.set("market", market);
  if (appliedCodes.length > 0) {
    params.set("appliedDiscountCodes", appliedCodes.join(","));
  }

  const separator = endpoint.url.includes("?") ? "&" : "?";
  const url = `${endpoint.url}${separator}${params.toString()}`;

  return {
    url,
    cacheKey: url,
    requiresSessionToken: endpoint.requiresSessionToken,
  };
}

export function resolvePostPurchaseCampaignEndpoint({
  apiBaseUrl,
  shopDomain,
  storefrontUrl,
}) {
  const customBaseUrl = readString(apiBaseUrl).replace(/\/+$/, "");

  if (/^https?:\/\//i.test(customBaseUrl)) {
    return {
      url: customBaseUrl.endsWith(POST_PURCHASE_CAMPAIGN_PATH)
        ? customBaseUrl
        : `${customBaseUrl}${POST_PURCHASE_CAMPAIGN_PATH}`,
      shop: normalizeShopDomain(shopDomain || extractHost(storefrontUrl)),
      requiresSessionToken: true,
    };
  }

  const shop = normalizeShopDomain(shopDomain || extractHost(storefrontUrl));
  if (!shop) {
    return { url: "", shop: "", requiresSessionToken: false };
  }

  return {
    url: `https://${shop}${APP_PROXY_POST_PURCHASE_CAMPAIGN_PATH}`,
    shop,
    requiresSessionToken: false,
  };
}

/**
 * @param {{
 *   campaign?: { campaignId?: string } | null,
 *   shopDomain?: string,
 *   storefrontUrl?: string,
 *   eventType?: string,
 *   surface?: string,
 *   currencyCode?: string,
 *   countryCode?: string,
 *   locale?: string,
 * }} input
 */
export async function trackPostPurchaseEvent({
  campaign,
  shopDomain,
  storefrontUrl,
  eventType,
  surface,
  currencyCode,
  countryCode,
  locale,
}) {
  const shop = normalizeShopDomain(shopDomain || extractHost(storefrontUrl));
  const campaignId = readString(campaign?.campaignId);

  if (!shop || !campaignId || !eventType) {
    return { ok: false, skipped: true };
  }

  try {
    const response = await fetch(`https://${shop}${APP_PROXY_ANALYTICS_PATH}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shop,
        campaignId,
        eventType,
        placementType:
          surface === "ORDER_STATUS_PAGE" ? "ORDER_STATUS_PAGE" : "THANK_YOU_PAGE",
        currencyCode: readString(currencyCode).toUpperCase() || null,
        country: readString(countryCode).toUpperCase() || null,
        locale: readString(locale) || null,
        path:
          surface === "ORDER_STATUS_PAGE" ? "/order-status" : "/thank-you",
      }),
    });

    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, skipped: false };
  }
}

export function formatPostPurchaseTimerLabel(remainingSeconds) {
  const totalSeconds = Math.max(0, Math.floor(readNumber(remainingSeconds) ?? 0));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h`;
  }

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function readPostPurchaseCode(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  return readString(value.isoCode || value.code || value.handle);
}

function normalizeShopDomain(value) {
  return readString(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

function extractHost(value) {
  try {
    return value ? new URL(value).host : "";
  } catch {
    return "";
  }
}

function readBoolean(value, fallback) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;

  return fallback;
}

function readNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}
