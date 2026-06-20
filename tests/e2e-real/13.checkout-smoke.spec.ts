import { test, expect } from "./helpers/fixtures";
import {
  getConfig,
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
} from "./helpers/env";
import { ensureTestProductHandle } from "./helpers/shopify-admin-api";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  addProductToCart,
  clearCart,
  goToCheckout,
  openStorefront,
} from "./helpers/storefront";

test.describe("real checkout smoke", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("loads checkout without completing an order", async ({
    page,
    request,
  }, testInfo) => {
    const config = getConfig();
    test.skip(
      !config.allowCheckout,
      "Set REAL_E2E_ALLOW_CHECKOUT=true to run checkout smoke against a real store.",
    );
    test.skip(
      config.allowOrder,
      "This smoke spec does not complete orders. Keep REAL_E2E_ALLOW_ORDER=false unless using a dedicated order spec.",
    );

    const productHandle = await ensureTestProductHandle(request);
    test.skip(
      !productHandle,
      "Set REAL_E2E_PRODUCT_HANDLE or SHOPIFY_ADMIN_ACCESS_TOKEN to provide a test product.",
    );

    await openStorefront(page);
    await clearCart(page);
    const added = await addProductToCart(page, productHandle);
    test.skip(!added, "The test product page needs an accessible Add to cart button.");

    await goToCheckout(page, testInfo);
    await expect(page).toHaveURL(/checkout|checkouts/i);
    await expect(page.locator("body")).toBeVisible();

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
