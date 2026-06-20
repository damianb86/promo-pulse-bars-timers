import fs from "node:fs";
import { URL } from "node:url";

import type { Frame, Locator, Page } from "@playwright/test";

import { getConfig, requireRealE2E, storageStateAbsolutePath } from "./env";

export type AppScope = Frame | Page;

let discoveredAdminAppBaseUrl = "";

export function ensureStorageStateExists() {
  const storageState = storageStateAbsolutePath();

  if (!fs.existsSync(storageState)) {
    throw new Error(
      `Missing Playwright storageState at ${storageState}. Run npm run test:e2e:real:auth after configuring .env.real-e2e.`,
    );
  }
}

export async function openShopifyAdmin(page: Page) {
  const config = requireRealE2E();
  ensureStorageStateExists();
  await page.goto(config.adminUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: config.timeoutMs });
}

export async function openPromoPulseApp(page: Page, appPath = "/app") {
  const config = requireRealE2E();
  ensureStorageStateExists();

  const adminEmbeddedUrl = resolveAdminEmbeddedAppUrl(appPath);

  if (adminEmbeddedUrl) {
    await page.goto(adminEmbeddedUrl, { waitUntil: "domcontentloaded" });
  } else if (canNavigateDirectlyToAppUrl(config.appAdminUrl)) {
    await page.goto(
      resolveAppUrl(config.appAdminUrl, appPath, config.shopDomain),
      {
        waitUntil: "domcontentloaded",
      },
    );
  } else {
    await page.goto(config.appAdminUrl, { waitUntil: "domcontentloaded" });
  }

  await page.waitForLoadState("domcontentloaded");
  await completeDirectAppLoginIfNeeded(page);
  await waitForAppReady(page, appPath);
  rememberAdminAppBaseUrl(page.url());

  if (isShopifyAdminUrl(page.url()) && appPath !== "/app") {
    await navigateToEmbeddedAdminPath(page, appPath);
    await waitForAppReady(page, appPath);
  } else if (
    !canNavigateDirectlyToAppUrl(config.appAdminUrl) &&
    appPath !== "/app"
  ) {
    await navigateToEmbeddedAdminPath(page, appPath);
    await waitForAppReady(page, appPath);
  }
}

export async function openPromoPulseAppDirect(page: Page, appPath = "/app") {
  const config = requireRealE2E();
  ensureStorageStateExists();

  if (!canNavigateDirectlyToAppUrl(config.appAdminUrl)) {
    await openPromoPulseApp(page, appPath);
    return;
  }

  const targetUrl = resolveAppUrl(
    config.appAdminUrl,
    appPath,
    config.shopDomain,
  );
  const expectedPath = safeUrl(targetUrl)?.pathname.replace(/\/+$/, "") ?? "";

  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("domcontentloaded");
  await completeDirectAppLoginIfNeeded(page);

  const currentPath = safeUrl(page.url())?.pathname.replace(/\/+$/, "") ?? "";
  if (expectedPath && !currentPath.startsWith(expectedPath)) {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");
    await completeDirectAppLoginIfNeeded(page);
  }

  await waitForAppReady(page, appPath);
}

export async function getEmbeddedAppRoot(page: Page): Promise<Locator> {
  const app = await getAppFrameOrPage(page);
  return app
    .locator(
      '[data-promo-pulse-app-root], [data-campaign-form], s-page, input[name="goal"], input[name="headline"]',
    )
    .first();
}

export async function getAppFrameOrPage(page: Page): Promise<AppScope> {
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    for (const candidate of page.frames()) {
      if (candidate === page.mainFrame()) continue;
      if (await completeDirectAppLoginInScope(candidate)) continue;
      if (isConfiguredAppUrl(candidate.url())) {
        return candidate;
      }
    }

    const iframeHandles = await page
      .locator("iframe")
      .elementHandles()
      .catch(() => []);

    for (const iframeHandle of iframeHandles) {
      const candidate = await iframeHandle.contentFrame();

      if (!candidate) continue;
      if (await completeDirectAppLoginInScope(candidate)) continue;
      if (isConfiguredAppUrl(candidate.url())) return candidate;
      if (await frameLooksLikePromoPulse(candidate)) return candidate;
    }

    for (const candidate of page.frames()) {
      if (candidate === page.mainFrame()) continue;
      if (await completeDirectAppLoginInScope(candidate)) continue;
      if (await frameLooksLikePromoPulse(candidate)) {
        return candidate;
      }
    }

    await page.waitForTimeout(300);
  }

  return page;
}

async function frameLooksLikePromoPulse(candidate: Frame) {
  if (await hasDirectAppLogin(candidate)) {
    return false;
  }

  const structuralCount = await candidate
    .locator(
      '[data-promo-pulse-app-root], [data-campaign-form], input[name="goal"], input[name="headline"], textarea[name="subheadline"]',
    )
    .count()
    .catch(() => 0);

  if (structuralCount > 0) return true;

  return (
    (await candidate
      .getByText(/Generate with AI|Dashboard|Campaigns|Analytics|Reports/i)
      .count()
      .catch(() => 0)) > 0
  );
}

function canNavigateDirectlyToAppUrl(value: string) {
  const url = safeUrl(value);
  if (!url) return false;
  return url.hostname !== "admin.shopify.com";
}

function isConfiguredAppUrl(value: string) {
  const configUrl = safeUrl(getConfig().appAdminUrl);
  const candidateUrl = safeUrl(value);

  return Boolean(
    configUrl && candidateUrl && candidateUrl.hostname === configUrl.hostname,
  );
}

function resolveAppUrl(base: string, appPath: string, shopDomain: string) {
  const url = new URL(base);
  url.pathname = appPath;
  url.search = "";
  url.searchParams.set("shop", shopDomain);
  url.hash = "";
  return url.toString();
}

function resolveAdminEmbeddedAppUrl(appPath: string) {
  const config = getConfig();
  const adminUrl = safeUrl(config.adminUrl);
  const storeHandle = adminUrl?.pathname.match(/\/store\/([^/]+)/)?.[1];

  if (!adminUrl || !storeHandle || !config.shopifyAppHandle) return "";

  return `${adminUrl.origin}/store/${storeHandle}/apps/${config.shopifyAppHandle}${appPath}`;
}

export async function completeDirectAppLoginIfNeeded(page: Page) {
  if (await completeDirectAppLoginInScope(page)) return true;

  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    if (await completeDirectAppLoginInScope(frame)) return true;
  }

  return false;
}

async function completeDirectAppLoginInScope(scope: AppScope) {
  const loginButton = scope.getByRole("button", { name: /^log in$/i }).first();
  const hasShopInput = await hasDirectAppLogin(scope);
  const hasLoginOnlyScreen =
    !hasShopInput &&
    (await scope
      .getByRole("heading", { name: /^log in$/i })
      .isVisible({ timeout: 1_000 })
      .catch(() => false)) &&
    (await loginButton.isVisible({ timeout: 1_000 }).catch(() => false));

  if (!hasShopInput && !hasLoginOnlyScreen) {
    return false;
  }

  const config = getConfig();
  const shopInput = scope.getByLabel(/shop domain/i).first();

  if (hasShopInput) {
    await shopInput.fill(config.shopDomain);
  }

  await loginButton.click();
  await scope.waitForLoadState("domcontentloaded", {
    timeout: config.timeoutMs,
  });
  return true;
}

async function hasDirectAppLogin(scope: AppScope) {
  return scope
    .getByLabel(/shop domain/i)
    .first()
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
}

async function waitForAppReady(page: Page, appPath: string) {
  const config = getConfig();
  const expectedPath = appPath.replace(/\/+$/, "");
  const deadline = Date.now() + config.timeoutMs;

  while (Date.now() < deadline) {
    if (await completeDirectAppLoginIfNeeded(page)) {
      continue;
    }

    const app = await getAppFrameOrPage(page);
    const url = safeUrl("url" in app ? app.url() : page.url());

    if (await completeDirectAppLoginInScope(app).catch(() => false)) {
      await completeDirectAppLoginIfNeeded(page);
      continue;
    }

    const hasAppStructure =
      (await app
        .locator(
          '[data-promo-pulse-app-root], [data-campaign-form], input[name="goal"], input[name="headline"]',
        )
        .count()
        .catch(() => 0)) > 0;
    const hasAppText =
      isFrameScope(app) &&
      (await app
        .getByText(
          /Campaign workspace|Campaign controls|Generate with AI|Dashboard|Analytics|Reports|Template Library/i,
        )
        .count()
        .catch(() => 0)) > 0;

    if (
      !hasAppStructure &&
      isFrameScope(app) &&
      url &&
      url?.hostname === safeUrl(config.appAdminUrl)?.hostname
    ) {
      const bodyTextLength = await app
        .locator("body")
        .innerText({ timeout: 1_000 })
        .then((text) => text.trim().length)
        .catch(() => 0);

      if (
        bodyTextLength > 0 &&
        (!expectedPath || url.pathname.startsWith(expectedPath))
      ) {
        return;
      }
    }

    /*
     * Real Shopify Admin renders the app inside an iframe and may wrap
     * content in custom elements, so count known app markers instead of
     * relying on first-match visibility.
     */
    const isReady = hasAppStructure || hasAppText;

    if (isReady) {
      if (!expectedPath || !url || url.pathname.startsWith(expectedPath)) {
        return;
      }
      return;
    }

    await page.waitForTimeout(300);
  }

  throw new Error(
    `Promo Pulse app did not become ready at ${appPath}. Check that Shopify app dev is running and Shopify points to the current app tunnel URL.`,
  );
}

function isFrameScope(scope: AppScope): scope is Frame {
  return "parentFrame" in scope;
}

async function navigateWithinEmbeddedApp(page: Page, appPath: string) {
  const adminLink = page.locator(`a[href*="${appPath}"]`).first();
  if (await adminLink.isVisible().catch(() => false)) {
    await adminLink.click();
    await page.waitForLoadState("domcontentloaded");
    return;
  }

  const app = await getAppFrameOrPage(page);

  if (appPath === "/app/campaigns") {
    await clickFirstVisible(app, [/campaigns/i]);
    return;
  }

  if (appPath === "/app/campaigns/new") {
    await clickFirstVisible(app, [/create campaign/i, /new campaign/i]);
    return;
  }

  if (appPath === "/app/analytics") {
    await clickFirstVisible(app, [/analytics/i]);
    return;
  }

  if (appPath === "/app/reports") {
    await clickFirstVisible(app, [/reports/i]);
    return;
  }

  if (appPath === "/app/templates") {
    await clickFirstVisible(app, [/template/i]);
    return;
  }

  if (appPath === "/app/settings") {
    await clickFirstVisible(app, [/settings/i]);
    return;
  }

  if (appPath === "/app/billing") {
    await clickFirstVisible(app, [/billing/i]);
  }
}

async function navigateToEmbeddedAdminPath(page: Page, appPath: string) {
  if (discoveredAdminAppBaseUrl) {
    await page.goto(`${discoveredAdminAppBaseUrl}${appPath}`, {
      waitUntil: "domcontentloaded",
    });
    rememberAdminAppBaseUrl(page.url());
    return;
  }

  await navigateWithinEmbeddedApp(page, appPath);
  rememberAdminAppBaseUrl(page.url());
}

async function clickFirstVisible(scope: AppScope, names: RegExp[]) {
  for (const name of names) {
    const link = scope.getByRole("link", { name }).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      return;
    }

    const button = scope.getByRole("button", { name }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }
  }
}

function safeUrl(value: string) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function isShopifyAdminUrl(value: string) {
  return safeUrl(value)?.hostname === "admin.shopify.com";
}

function rememberAdminAppBaseUrl(value: string) {
  const url = safeUrl(value);
  const match = url?.pathname.match(/^(\/store\/[^/]+\/apps\/[^/]+)/);

  if (!url || url.hostname !== "admin.shopify.com" || !match) return;

  discoveredAdminAppBaseUrl = `${url.origin}${match[1]}`;
}
