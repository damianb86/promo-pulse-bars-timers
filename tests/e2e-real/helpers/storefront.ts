import fs from "node:fs";
import path from "node:path";

import type { Browser, Page, TestInfo } from "@playwright/test";

import { clearPageDiagnostics, expect, test } from "./fixtures";
import { getConfig } from "./env";

const routedLocalThemeAssets = new WeakSet<Page>();

export async function openStorefront(page: Page, path = "/") {
  const config = getConfig();
  const url = new URL(path, config.storefrontUrl || "https://example.com");

  clearPageDiagnostics(page);
  await routeLocalThemeAssetsIfEnabled(page);
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  await unlockStorefrontPasswordIfNeeded(page);
  await skipIfStorefrontConnectionVerificationIsVisible(page);
  await page
    .waitForLoadState("load", { timeout: Math.min(config.timeoutMs, 15_000) })
    .catch(() => undefined);
  await skipIfStorefrontConnectionVerificationIsVisible(page);
}

export async function unlockStorefrontPasswordIfNeeded(page: Page) {
  const config = getConfig();
  if (!config.storefrontPassword) return;

  const passwordField = page
    .locator('input[type="password"], input[name="password"]')
    .first();

  if (!(await passwordField.isVisible().catch(() => false))) return;

  await passwordField.fill(config.storefrontPassword);

  const submit = page
    .getByRole("button", { name: /enter|submit|password/i })
    .first();

  if (await submit.isVisible().catch(() => false)) {
    await submit.click();
  } else {
    await passwordField.press("Enter");
  }

  await page.waitForLoadState("domcontentloaded");
  await skipIfStorefrontConnectionVerificationIsVisible(page);
}

async function skipIfStorefrontConnectionVerificationIsVisible(page: Page) {
  test.skip(
    await page
      .getByText(/connection needs to be verified before you can proceed/i)
      .isVisible({ timeout: 1_000 })
      .catch(() => false),
    "Shopify storefront requires human connection verification. Complete the storefront verification in a browser session before running real-store storefront E2E tests.",
  );
}

export async function clearCart(page: Page) {
  await page.evaluate(async () => {
    await fetch("/cart/clear.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }).catch(() => null);
    document.dispatchEvent(new CustomEvent("cart:updated"));
  });
}

export async function addProductToCart(page: Page, productHandle?: string) {
  if (!productHandle) {
    return false;
  }

  await openStorefront(page, `/products/${productHandle}`);

  const variantSelect = page.locator('select[name="id"]').first();
  if (await variantSelect.isVisible().catch(() => false)) {
    const options = await variantSelect.locator("option").count();
    if (options > 1) {
      await variantSelect.selectOption({ index: 1 });
    }
  }

  const addButton = page
    .getByRole("button", { name: /add to cart|add/i })
    .first();

  if (!(await addButton.isVisible().catch(() => false))) {
    return false;
  }

  await addButton.click();
  await page.waitForTimeout(1_000);
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent("cart:updated"));
  });

  return true;
}

export async function openCartDrawer(page: Page) {
  const cartButton = page
    .getByRole("button", { name: /cart|bag|basket/i })
    .or(page.getByRole("link", { name: /cart|bag|basket/i }))
    .first();

  if (await cartButton.isVisible().catch(() => false)) {
    await cartButton.click();
    await page.waitForTimeout(600);
    return true;
  }

  return false;
}

export async function goToCartPage(page: Page) {
  await openStorefront(page, "/cart");
}

export async function goToCheckout(page: Page, testInfo?: TestInfo) {
  const config = getConfig();
  if (!config.allowCheckout) {
    testInfo?.skip(
      true,
      "Set REAL_E2E_ALLOW_CHECKOUT=true to allow checkout navigation in a real store.",
    );
    return;
  }

  await openStorefront(page, "/checkout");
}

export async function newStorefrontVisitor(browser: Browser, path = "/") {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openStorefront(page, path);
  return { context, page };
}

export function realE2ECacheBustPath(label: string) {
  // `utm_*` params are stripped by Shopify's storefront cache key, so they do
  // NOT bust the full-page cache on a real store. Add a non-utm `ppcb` param
  // (kept alongside utm_source for targeting specs that assert on utm) so each
  // navigation renders a fresh page reflecting the current campaign metafield.
  const token = `${encodeURIComponent(label)}_${Date.now()}`;
  return `/?utm_source=real_e2e_${token}&ppcb=${token}`;
}

export async function expectStorefrontEmbedOrSkip(page: Page, testInfo: TestInfo) {
  const embed = page.locator("#promo-pulse-app-embed, .pp-root").first();
  if ((await embed.count()) === 0) {
    testInfo.skip(
      true,
      "Enable the Promo Pulse app embed in the active theme before running storefront real E2E tests.",
    );
  }
}

export async function expectProductBlockOrSkip(page: Page, testInfo: TestInfo) {
  const productBlock = page
    .locator(".pp-product-timer, .pp-product-badge, .pp-low-stock")
    .first();

  if (!(await productBlock.isVisible().catch(() => false))) {
    testInfo.skip(
      true,
      "Add the Promo Pulse product block to the product template.",
    );
  }

  await expect(productBlock).toBeVisible();
}

async function routeLocalThemeAssetsIfEnabled(page: Page) {
  const config = getConfig();
  if (!config.localThemeAssetsFallback) return;
  if (routedLocalThemeAssets.has(page)) return;

  routedLocalThemeAssets.add(page);

  await page.route("https://cdn.shopify.com/extensions/**/assets/*", async (route) => {
    const assetName = path.basename(new URL(route.request().url()).pathname);
    const assetPath = path.resolve(process.cwd(), config.themeAssetsDir, assetName);

    if (!fs.existsSync(assetPath)) {
      await route.continue();
      return;
    }

    await route.fulfill({
      body: await fs.promises.readFile(assetPath),
      contentType: contentTypeForAsset(assetName),
    });
  });
}

function contentTypeForAsset(assetName: string) {
  if (assetName.endsWith(".css")) return "text/css; charset=utf-8";
  if (assetName.endsWith(".js")) return "application/javascript; charset=utf-8";
  return "application/octet-stream";
}
