import fs from "node:fs";
import { URL } from "node:url";

import type { Frame, Locator, Page } from "@playwright/test";

import {
  getConfig,
  requireRealE2E,
  storageStateAbsolutePath,
} from "./env";

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
    await page.goto(resolveAppUrl(config.appAdminUrl, appPath, config.shopDomain), {
      waitUntil: "domcontentloaded",
    });
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
  } else if (!canNavigateDirectlyToAppUrl(config.appAdminUrl) && appPath !== "/app") {
    await navigateToEmbeddedAdminPath(page, appPath);
    await waitForAppReady(page, appPath);
  }
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
    const iframeHandles = await page
      .locator("iframe")
      .elementHandles()
      .catch(() => []);

    for (const iframeHandle of iframeHandles) {
      const candidate = await iframeHandle.contentFrame();

      if (!candidate) continue;
      if (await frameLooksLikePromoPulse(candidate)) return candidate;
    }

    for (const candidate of page.frames()) {
      if (candidate === page.mainFrame()) continue;
      if (await frameLooksLikePromoPulse(candidate)) {
        return candidate;
      }
    }

    await page.waitForTimeout(300);
  }

  return page;
}

async function frameLooksLikePromoPulse(candidate: Frame) {
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

async function completeDirectAppLoginIfNeeded(page: Page) {
  const config = getConfig();
  const shopInput = page.getByLabel(/shop domain/i).first();

  if (!(await shopInput.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return;
  }

  await shopInput.fill(config.shopDomain);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await page.waitForLoadState("domcontentloaded", {
    timeout: config.timeoutMs,
  });
}

async function waitForAppReady(page: Page, appPath: string) {
  const config = getConfig();
  const expectedPath = appPath.replace(/\/+$/, "");
  const deadline = Date.now() + config.timeoutMs;

  while (Date.now() < deadline) {
    const app = await getAppFrameOrPage(page);
    const url = safeUrl("url" in app ? app.url() : page.url());
    const loginVisible = await page
      .getByLabel(/shop domain/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (loginVisible) {
      await completeDirectAppLoginIfNeeded(page);
      continue;
    }

    if (
      await app
        .locator(
          '[data-promo-pulse-app-root], s-page, [data-campaign-form], input[name="goal"], input[name="headline"]',
        )
        .first()
        .isVisible()
        .catch(() => false)
    ) {
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
