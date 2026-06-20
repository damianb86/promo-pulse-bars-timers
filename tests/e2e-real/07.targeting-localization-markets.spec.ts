import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
} from "./helpers/env";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import { openStorefront } from "./helpers/storefront";

test.describe("real targeting, localization, and markets", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("detects locale/market storefront signals or skips with setup guidance", async ({
    page,
  }, testInfo) => {
    await openStorefront(page);

    const htmlLang = await page.locator("html").getAttribute("lang");
    const localizedAlternates = await page
      .locator('link[rel="alternate"][hreflang], a[href*="/en"], a[href*="/fr"], a[href*="/es"]')
      .count();
    const currencyText = await page.locator("body").textContent();

    testInfo.skip(
      !htmlLang && localizedAlternates === 0,
      "Configure Shopify Markets/locales or localized URLs before running targeting/localization checks.",
    );

    expect(htmlLang || localizedAlternates).toBeTruthy();
    expect(currencyText ?? "").not.toMatch(/undefined|NaN/);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
