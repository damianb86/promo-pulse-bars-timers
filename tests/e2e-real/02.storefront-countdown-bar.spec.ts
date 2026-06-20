import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import { createCountdownCampaign } from "./helpers/admin-app";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";

test.describe("real storefront countdown bar", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("renders an active countdown bar on desktop and mobile", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile-storefront";
    const headline = "Countdown real E2E";

    if (!isMobile) {
      await createCountdownCampaign(page, uniqueName("Countdown Bar"));
    }

    await openStorefront(page, realE2ECacheBustPath("countdown"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const bar = isMobile
      ? page.locator('[data-testid="promo-bar"], .pp-bar').filter({
          has: page.locator('[data-testid="promo-timer"], .pp-countdown'),
        }).first()
      : page
          .locator('[data-testid="promo-bar"], .pp-bar')
          .filter({ hasText: headline })
          .first();
    if (isMobile && !(await bar.isVisible().catch(() => false))) {
      testInfo.skip(
        true,
        "Create an active [PP-E2E] countdown campaign before running the mobile storefront project.",
      );
    }

    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(
      bar.locator('[data-testid="promo-timer"], .pp-countdown').first(),
    ).toHaveText(
      /^(?:(?:\d+\s+Days?\s+)?(?:[01]?\d|2[0-3])\s+Hrs\s+[0-5]?\d\s+Mins\s+[0-5]?\d\s+Secs|(?:[01]?\d|2[0-3]):[0-5]\d:[0-5]\d)$/,
      { timeout: 30_000 },
    );

    const cta = bar.locator(".pp-cta").first();
    if (await cta.isVisible().catch(() => false)) {
      await cta.click();
      await expect(page).toHaveURL(/collections|products|\/$/);
    }

    const close = page.getByRole("button", { name: /close/i }).first();
    if (await close.isVisible().catch(() => false)) {
      await close.click();
      await expect(bar).toBeHidden();
    }

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
