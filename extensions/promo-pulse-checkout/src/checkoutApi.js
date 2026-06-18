export const CHECKOUT_CAMPAIGN_PATH = "/api/checkout/campaign";
export const APP_PROXY_CHECKOUT_CAMPAIGN_PATH =
  "/apps/counterpulse-campaigns/api/checkout/campaign";

export function normalizeBlockSettings(settings = {}) {
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

export function buildCheckoutCampaignRequest({
  settings,
  shopDomain,
  storefrontUrl,
  subtotalAmount,
  currencyCode,
  countryCode,
  locale,
  marketHandle,
}) {
  const normalizedSettings = normalizeBlockSettings(settings);
  const endpoint = resolveCheckoutCampaignEndpoint({
    apiBaseUrl: normalizedSettings.apiBaseUrl,
    shopDomain,
    storefrontUrl,
  });

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
    compactMode: String(normalizedSettings.compactMode),
    showTimer: String(normalizedSettings.showTimer),
    path: "/checkout",
    placement: "CHECKOUT",
  });
  const subtotal = readNumber(subtotalAmount);
  const currency = readString(currencyCode).toUpperCase();
  const country = readString(countryCode).toUpperCase();
  const selectedLocale = readString(locale);
  const market = readString(marketHandle).toUpperCase();

  if (normalizedSettings.mode === "SPECIFIC_CAMPAIGN") {
    params.set("campaignId", normalizedSettings.campaignId);
  }
  if (subtotal !== null) params.set("cartSubtotal", String(subtotal));
  if (currency) params.set("currency", currency);
  if (country) params.set("country", country);
  if (selectedLocale) params.set("locale", selectedLocale);
  if (market) params.set("market", market);

  const separator = endpoint.url.includes("?") ? "&" : "?";
  const url = `${endpoint.url}${separator}${params.toString()}`;

  return {
    url,
    cacheKey: url,
    requiresSessionToken: endpoint.requiresSessionToken,
  };
}

export function resolveCheckoutCampaignEndpoint({
  apiBaseUrl,
  shopDomain,
  storefrontUrl,
}) {
  const customBaseUrl = readString(apiBaseUrl).replace(/\/+$/, "");

  if (/^https?:\/\//i.test(customBaseUrl)) {
    return {
      url: customBaseUrl.endsWith(CHECKOUT_CAMPAIGN_PATH)
        ? customBaseUrl
        : `${customBaseUrl}${CHECKOUT_CAMPAIGN_PATH}`,
      shop: normalizeShopDomain(shopDomain || extractHost(storefrontUrl)),
      requiresSessionToken: true,
    };
  }

  const shop = normalizeShopDomain(shopDomain || extractHost(storefrontUrl));
  if (!shop) {
    return { url: "", shop: "", requiresSessionToken: false };
  }

  return {
    url: `https://${shop}${APP_PROXY_CHECKOUT_CAMPAIGN_PATH}`,
    shop,
    requiresSessionToken: false,
  };
}

export function formatTimerLabel(remainingSeconds) {
  const totalSeconds = Math.max(0, Math.floor(readNumber(remainingSeconds) ?? 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function readSignalValue(signal, fallback = undefined) {
  return signal && typeof signal === "object" && "value" in signal
    ? signal.value
    : fallback;
}

export function readCode(value) {
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
