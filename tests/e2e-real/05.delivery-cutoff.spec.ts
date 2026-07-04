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
    await expect(bar).not.toContainText(/\{\{\s*[\w]+\s*\}\}/);
    await expect(bar).not.toContainText(/invalid|nan|undefined/i);

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("localizes interpolated delivery dates on a non-default locale", async ({
    page,
  }, testInfo) => {
    const headline = "Delivery cutoff real E2E";
    await createDeliveryCutoffCampaign(page, uniqueName("Delivery Locale"));

    // Discover a published non-default locale; skip when the store only
    // publishes one language.
    await openStorefront(page, realE2ECacheBustPath("delivery_locale_probe"));
    const altLocaleHref = await page
      .evaluate(() => {
        const links = [
          ...document.querySelectorAll('link[rel="alternate"][hreflang]'),
        ] as HTMLLinkElement[];
        const currentLang = document.documentElement.lang
          .split("-")[0]
          .toLowerCase();
        const alt = links.find(
          (link) =>
            link.hreflang &&
            link.hreflang.split("-")[0].toLowerCase() !== currentLang &&
            link.hreflang !== "x-default",
        );
        return alt ? new URL(alt.href).pathname : "";
      })
      .catch(() => "");
    testInfo.skip(
      !altLocaleHref,
      "Store publishes a single locale; add a second published language to cover localized delivery dates.",
    );

    await openStorefront(
      page,
      `${altLocaleHref.replace(/\/$/, "")}${realE2ECacheBustPath("delivery_locale")}`,
    );
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const bar = page
      .locator('[data-testid="promo-bar"], .pp-bar')
      .filter({ hasText: headline })
      .first();
    await expect(bar).toBeVisible({ timeout: 30_000 });
    // The interpolated variables must resolve (no raw {{tokens}}) and produce
    // valid localized values on the alternate locale.
    await expect(bar).not.toContainText(/\{\{\s*[\w]+\s*\}\}/);
    await expect(bar).not.toContainText(/invalid|nan|undefined/i);

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
