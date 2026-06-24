import { Buffer } from "node:buffer";

export function buildEmbeddedAppRedirect(request: Request, appPath = "/app") {
  const url = new URL(request.url);
  const shop =
    normalizeShopDomain(url.searchParams.get("shop")) ||
    readShopFromEncodedHost(url.searchParams.get("host"));

  if (!shop) return null;

  const params = new URLSearchParams(url.searchParams);
  params.set("shop", shop);

  const query = params.toString();

  return query ? `${appPath}?${query}` : appPath;
}

function readShopFromEncodedHost(value: string | null) {
  if (!value) return "";

  try {
    const decoded = Buffer.from(toBase64(value), "base64").toString("utf8");
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
