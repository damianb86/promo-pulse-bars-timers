import { useEffect } from "react";

type ShopifyReconnectPageProps = {
  title?: string;
  message?: string;
};

export function ShopifyReconnectPage({
  title = "Connecting to Shopify",
  message = "Promo Pulse is reconnecting to your Shopify admin workspace.",
}: ShopifyReconnectPageProps) {
  useEffect(() => {
    const shop = resolveShopFromBrowserContext();

    if (!shop) return;

    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = "/app";
    nextUrl.searchParams.set("shop", shop);

    window.location.replace(`${nextUrl.pathname}${nextUrl.search}`);
  }, []);

  return (
    <main className="counterpulse-reconnect-page">
      <section className="counterpulse-reconnect-card">
        <div className="counterpulse-reconnect-card__mark" aria-hidden="true">
          <span />
        </div>
        <p className="counterpulse-kicker">Promo Pulse</p>
        <h1>{title}</h1>
        <p>{message}</p>
        <div className="counterpulse-reconnect-card__status" role="status">
          <span aria-hidden="true" />
          Reopening the embedded app
        </div>
      </section>
    </main>
  );
}

function resolveShopFromBrowserContext() {
  const currentUrl = new URL(window.location.href);

  return (
    normalizeShopDomain(currentUrl.searchParams.get("shop")) ||
    readShopFromEncodedHost(currentUrl.searchParams.get("host")) ||
    readShopFromReferrer(document.referrer)
  );
}

function readShopFromEncodedHost(value: string | null) {
  if (!value) return "";

  try {
    const decoded = window.atob(toBase64(value));
    const match = decoded.match(/([a-z0-9][a-z0-9-]*\.myshopify\.com)/i);

    return normalizeShopDomain(match?.[1] ?? "");
  } catch {
    return "";
  }
}

function toBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;

  return padding ? `${normalized}${"=".repeat(4 - padding)}` : normalized;
}

function readShopFromReferrer(value: string) {
  if (!value) return "";

  try {
    const referrer = new URL(value);
    const myShopifyMatch = referrer.href.match(
      /([a-z0-9][a-z0-9-]*\.myshopify\.com)/i,
    );

    if (myShopifyMatch?.[1]) {
      return normalizeShopDomain(myShopifyMatch[1]);
    }

    const adminStoreMatch = referrer.href.match(
      /admin\.shopify\.com\/store\/([a-z0-9-]+)/i,
    );

    return normalizeShopDomain(adminStoreMatch?.[1] ?? "");
  } catch {
    return "";
  }
}

function normalizeShopDomain(value: string | null | undefined) {
  const trimmed = (value ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  if (!trimmed) return "";

  const domain = trimmed.endsWith(".myshopify.com")
    ? trimmed
    : `${trimmed}.myshopify.com`;

  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : "";
}
