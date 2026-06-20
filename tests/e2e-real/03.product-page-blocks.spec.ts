import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
} from "./helpers/env";
import { ensureTestProductHandle } from "./helpers/shopify-admin-api";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  expectProductBlockOrSkip,
  openStorefront,
} from "./helpers/storefront";

test.describe("real product page blocks", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("shows product timer, low-stock, or badge block without duplicates", async ({
    page,
    request,
  }, testInfo) => {
    const productHandle = await ensureTestProductHandle(request);
    test.skip(
      !productHandle,
      "Set REAL_E2E_PRODUCT_HANDLE or SHOPIFY_ADMIN_ACCESS_TOKEN to provide a test product.",
    );

    await openStorefront(page, `/products/${productHandle}`);
    await expectProductBlockOrSkip(page, testInfo);

    const blocks = page.locator(".pp-product-timer, .pp-product-badge, .pp-low-stock");
    await expect(blocks.first()).toBeVisible();
    expect(await blocks.count()).toBeLessThanOrEqual(3);

    const variantSelect = page.locator('select[name="id"]').first();
    if ((await variantSelect.locator("option").count().catch(() => 0)) > 1) {
      await variantSelect.selectOption({ index: 1 });
      await expect(blocks.first()).toBeVisible();
    }

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
