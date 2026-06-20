import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import { createCartTimerCampaign } from "./helpers/admin-app";
import { ensureTestProductHandle } from "./helpers/shopify-admin-api";
import {
  cartDrawerWidgetLocator,
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  addProductToCart,
  clearCart,
  expectStorefrontEmbedOrSkip,
  openCartDrawer,
  openStorefront,
} from "./helpers/storefront";

test.describe("real cart drawer widget", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("renders once and stays stable after repeated drawer opens", async ({
    page,
    request,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile-storefront";
    const productHandle = await ensureTestProductHandle(request);
    test.skip(
      !productHandle,
      "Set REAL_E2E_PRODUCT_HANDLE or SHOPIFY_ADMIN_ACCESS_TOKEN to provide a test product.",
    );

    if (!isMobile) {
      await createCartTimerCampaign(page, uniqueName("Cart Timer"));
    }

    await openStorefront(page);
    await expectStorefrontEmbedOrSkip(page, testInfo);
    await clearCart(page);

    const added = await addProductToCart(page, productHandle);
    test.skip(!added, "The test product page needs an accessible Add to cart button.");

    const opened = await openCartDrawer(page);
    test.skip(
      !opened,
      "Configure a cart drawer trigger in the theme or set customCartDrawerSelector in Settings.",
    );

    await expect(cartDrawerWidgetLocator(page)).toBeVisible({
      timeout: 30_000,
    });

    for (let index = 0; index < 5; index += 1) {
      await openCartDrawer(page);
    }

    expect(await page.locator('[data-testid="cart-drawer-widget"], .pp-cart-drawer-slot').count()).toBeLessThanOrEqual(1);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
