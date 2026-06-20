import { test, expect } from "./helpers/fixtures";
import {
  getConfig,
  getMissingRequiredEnv,
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
} from "./helpers/env";
import {
  ensureStorageStateExists,
  getEmbeddedAppRoot,
  openPromoPulseApp,
  openShopifyAdmin,
} from "./helpers/auth";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
} from "./helpers/storefront";

test.describe("real store prerequisites", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("REAL_E2E_ENABLED and required env are configured", async () => {
    expect(getConfig().enabled).toBe(true);
    expect(getMissingRequiredEnv()).toEqual([]);
  });

  test("storageState exists", async () => {
    ensureStorageStateExists();
  });

  test("Shopify admin opens with storageState", async ({ page }) => {
    await openShopifyAdmin(page);
    await expect(page).toHaveURL(/admin\.shopify\.com/);
  });

  test("Promo Pulse app opens in admin or direct app URL", async ({ page }) => {
    await openPromoPulseApp(page, "/app");
    await expect(await getEmbeddedAppRoot(page)).toBeVisible({
      timeout: 30_000,
    });
    await expectNoConsoleErrors(page);
  });

  test("storefront opens and app embed is available", async ({
    page,
  }, testInfo) => {
    await openStorefront(page);
    await expect(page.locator("body")).toBeVisible();
    await expectStorefrontEmbedOrSkip(page, testInfo);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
