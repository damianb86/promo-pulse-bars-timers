import { isE2ETestMode } from "./e2e-test.server";
import { normalizeShopDomain } from "../utils/storefront-campaigns";

export type StorefrontAccessOptions = {
  authenticatedShopDomain?: string;
  trustedAppProxy?: boolean;
};

export type StorefrontAccessResult =
  | { ok: true; corsOrigin?: string }
  | { ok: false; status: number; error: string; corsOrigin?: string };

export function verifyStorefrontAccess(
  request: Request,
  requestedShop: string,
  options: StorefrontAccessOptions = {},
): StorefrontAccessResult {
  const shop = normalizeShopDomain(requestedShop);
  const authenticatedShop = normalizeShopDomain(
    options.authenticatedShopDomain ?? "",
  );
  const requestOrigin = readOrigin(request);

  if (!shop) {
    return {
      ok: false,
      status: 400,
      error: "The shop query parameter is required.",
      corsOrigin: requestOrigin,
    };
  }

  if (options.trustedAppProxy || authenticatedShop) {
    if (authenticatedShop && authenticatedShop !== shop) {
      return {
        ok: false,
        status: 403,
        error: "The authenticated shop does not match shop.",
        corsOrigin: requestOrigin,
      };
    }

    return { ok: true, corsOrigin: requestOrigin };
  }

  if (isE2ETestMode()) {
    return { ok: true, corsOrigin: requestOrigin };
  }

  const sourceHost = readSourceHost(request);

  if (sourceHost && isAllowedStorefrontHost(sourceHost, shop)) {
    return { ok: true, corsOrigin: requestOrigin };
  }

  if (process.env.NODE_ENV !== "production" && !sourceHost) {
    return { ok: true, corsOrigin: requestOrigin };
  }

  return {
    ok: false,
    status: 403,
    error: "Storefront request origin is not allowed for this shop.",
    corsOrigin: requestOrigin,
  };
}

export function buildCorsHeaders(
  access?: StorefrontAccessResult,
  fallbackOrigin = "*",
) {
  const origin = access?.corsOrigin || fallbackOrigin;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
    "Access-Control-Expose-Headers":
      "ETag, X-Promo-Pulse-Storefront-Version, X-Promo-Pulse-Cache-Expires-At, X-Promo-Pulse-Client-Cache-Max-Age, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
    Vary: "Origin",
  };
}

function readSourceHost(request: Request) {
  const origin = readOrigin(request);
  const originHost = readUrlHost(origin);

  if (originHost) return originHost;

  return readUrlHost(request.headers.get("referer"));
}

function readOrigin(request: Request) {
  return request.headers.get("origin") ?? undefined;
}

function readUrlHost(value: string | null | undefined) {
  if (!value) return "";

  try {
    return normalizeHost(new URL(value).hostname);
  } catch {
    return "";
  }
}

function isAllowedStorefrontHost(host: string, shop: string) {
  const normalizedHost = normalizeHost(host);
  const normalizedShop = normalizeHost(shop);

  if (!normalizedHost || !normalizedShop) return false;
  if (normalizedHost === normalizedShop) return true;
  if (normalizedHost.endsWith(`.${normalizedShop}`)) return true;

  return readConfiguredStorefrontHosts().includes(normalizedHost);
}

function readConfiguredStorefrontHosts() {
  return (process.env.PROMO_PULSE_ALLOWED_STOREFRONT_HOSTS ?? "")
    .split(",")
    .map(normalizeHost)
    .filter(Boolean);
}

function normalizeHost(value: string) {
  return normalizeShopDomain(value).replace(/:\d+$/, "");
}
