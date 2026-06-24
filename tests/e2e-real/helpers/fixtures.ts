/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, type Page } from "@playwright/test";

import { skipIfAppBackendUnavailable } from "./external-prereqs";

const consoleErrorsByPage = new WeakMap<Page, string[]>();
const failedRequestsByPage = new WeakMap<Page, string[]>();

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await skipIfAppBackendUnavailable(testInfo);
    attachPageDiagnostics(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";

export function attachPageDiagnostics(page: Page) {
  if (consoleErrorsByPage.has(page)) return;

  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  consoleErrorsByPage.set(page, consoleErrors);
  failedRequestsByPage.set(page, failedRequests);

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (isIgnoredConsoleError(message.text())) return;
    consoleErrors.push(message.text());
  });

  page.on("pageerror", (error) => {
    if (isIgnoredConsoleError(error.message)) return;
    consoleErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const failureText = request.failure()?.errorText ?? "unknown";

    if (isIgnoredFailedRequest(url, failureText)) return;

    failedRequests.push(`${request.method()} ${url}: ${failureText}`);
  });

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();

    if (status < 400) return;
    if (!isCriticalFailedResponse(url)) return;

    failedRequests.push(
      `${response.request().method()} ${url}: HTTP ${status}`,
    );
  });
}

export function getConsoleErrors(page: Page) {
  return consoleErrorsByPage.get(page) ?? [];
}

export function getFailedRequests(page: Page) {
  return failedRequestsByPage.get(page) ?? [];
}

export function clearPageDiagnostics(page: Page) {
  const consoleErrors = consoleErrorsByPage.get(page);
  const failedRequests = failedRequestsByPage.get(page);

  if (consoleErrors) consoleErrors.length = 0;
  if (failedRequests) failedRequests.length = 0;
}

function isIgnoredConsoleError(message: string) {
  return (
    message.includes(
      "Failed to load resource: the server responded with a status of 404",
    ) ||
    message.includes("Failed to fetch manifest patches") ||
    message.includes("ResizeObserver loop completed") ||
    message.includes("ResizeObserver loop limit exceeded") ||
    message.includes("Outdated Optimize Deprecation") ||
    message.includes("Unsupported decorator location: field") ||
    message.includes("Blocked a frame with origin") ||
    message.includes("Non-Error promise rejection captured") ||
    message.includes(
      "Blocked attempt to show multiple 'beforeunload' confirmation panels",
    ) ||
    isShopifyDevConsoleTunnelMessage(message)
  );
}

function isCriticalFailedResponse(url: string) {
  return (
    url.includes("/apps/promo-pulse") ||
    url.includes("/api/storefront") ||
    url.includes("/api/analytics") ||
    url.includes("/app/campaigns") ||
    url.includes("trycloudflare.com")
  );
}

function isIgnoredFailedRequest(url: string, failureText: string) {
  if (url.includes("/favicon.ico")) return true;
  if (url.includes("chrome-extension://")) return true;
  if (failureText === "net::ERR_ABORTED") {
    return (
      url.includes("cdn.shopify.com") ||
      url.includes("monorail-edge.shopifysvc.com") ||
      url.includes("/.well-known/shopify/monorail/") ||
      url.includes("otlp-http-production.shopifysvc.com") ||
      url.includes("admin.shopify.com/.well-known/") ||
      url.includes("/api/collect") ||
      url.includes("/services/login_with_shop/authorize") ||
      url.endsWith("/apps/promo-pulse") ||
      isAbortedViteDevAsset(url) ||
      url.endsWith(".map")
    );
  }

  return false;
}

function isAbortedViteDevAsset(url: string) {
  if (!url.includes("trycloudflare.com")) return false;

  return (
    url.includes("/node_modules/") ||
    url.includes("/app/components/") ||
    url.includes("/app/types/") ||
    url.includes("/__manifest")
  );
}

function isShopifyDevConsoleTunnelMessage(message: string) {
  return (
    message.includes("WebSocket connection to") &&
    message.includes("trycloudflare.com/extensions")
  );
}
