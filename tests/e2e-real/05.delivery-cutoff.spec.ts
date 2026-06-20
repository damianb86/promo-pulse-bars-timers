import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import { createDeliveryCutoffCampaign } from "./helpers/admin-app";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";

test.describe("real delivery cutoff", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("renders a readable delivery cutoff message", async ({
    page,
  }, testInfo) => {
    const headline = "Delivery cutoff real E2E";
    await createDeliveryCutoffCampaign(page, uniqueName("Delivery Cutoff"));
    await openStorefront(page, realE2ECacheBustPath("delivery_cutoff"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const bar = page
      .locator('[data-testid="promo-bar"], .pp-bar')
      .filter({ hasText: headline })
      .first();
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(bar).toContainText(/delivery|ship|order/i);
    await expect(bar).not.toContainText(/invalid|nan|undefined/i);

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
