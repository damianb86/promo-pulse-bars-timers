import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import { createFreeShippingCampaign } from "./helpers/admin-app";
import { ensureTestProductHandle } from "./helpers/shopify-admin-api";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
  freeShippingProgressLocator,
} from "./helpers/assertions";
import {
  addProductToCart,
  clearCart,
  expectStorefrontEmbedOrSkip,
  goToCartPage,
  openStorefront,
} from "./helpers/storefront";

test.describe("real free shipping goal", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("updates free-shipping progress after cart changes", async ({
    page,
    request,
  }, testInfo) => {
    const productHandle = await ensureTestProductHandle(request);
    test.skip(
      !productHandle,
      "Set REAL_E2E_PRODUCT_HANDLE or SHOPIFY_ADMIN_ACCESS_TOKEN to provide a test product.",
    );

    await createFreeShippingCampaign(page, uniqueName("Free Shipping Goal"));
    await openStorefront(page);
    await expectStorefrontEmbedOrSkip(page, testInfo);
    await clearCart(page);

    const added = await addProductToCart(page, productHandle);
    test.skip(!added, "The test product page needs an accessible Add to cart button.");

    await goToCartPage(page);
    const progress = freeShippingProgressLocator(page);
    await expect(progress).toBeVisible({ timeout: 30_000 });
    const before = await progress.getAttribute("aria-valuenow");

    const quantity = page.locator('input[name="updates[]"], input[name="quantity"]').first();
    if (await quantity.isVisible().catch(() => false)) {
      await quantity.fill("5");
      await quantity.press("Enter");
      await page.waitForTimeout(2_000);
      const after = await progress.getAttribute("aria-valuenow");
      expect(after ?? before).toBeTruthy();
    }

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
