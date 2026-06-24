import type { Page } from "@playwright/test";

import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
} from "./helpers/env";
import {
  getAppFrameOrPage,
  openPromoPulseApp,
  type AppScope,
} from "./helpers/auth";
import { expectNoConsoleErrors } from "./helpers/assertions";

test.describe("real settings and billing", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("persists a safe setting and shows billing plan/usage", async ({
    page,
  }) => {
    await openPromoPulseApp(page, "/app/settings");
    const app = await getAppFrameOrPage(page);
    const brandNameInput = app.getByLabel("Brand name");
    const originalBrandName = await brandNameInput.inputValue();
    const temporaryBrandName = `[PP-E2E] Promo Pulse ${Date.now()}`;

    await brandNameInput.fill(temporaryBrandName);
    await saveSettings(page, app);

    await expect(
      app.getByText(/settings saved/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    const reloaded = await getAppFrameOrPage(page);
    await expect(reloaded.getByLabel("Brand name")).toHaveValue(
      temporaryBrandName,
    );

    await reloaded.getByLabel("Brand name").fill(originalBrandName);
    await saveSettings(page, reloaded);
    await expect(
      reloaded.getByText(/settings saved/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    await openPromoPulseApp(page, "/app/billing");
    const billing = await getAppFrameOrPage(page);
    await expect(billing.getByText(/current:/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(billing.getByText(/available plans/i)).toBeVisible();

    await expectNoConsoleErrors(page);
  });
});

async function saveSettings(page: Page, app: AppScope) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/app/settings") &&
      response.request().method() === "POST",
    { timeout: 30_000 },
  );
  const localSaveButton = app
    .locator("ui-save-bar button")
    .filter({ hasText: /^Save$/ })
    .first();

  if (await localSaveButton.isVisible().catch(() => false)) {
    await localSaveButton.click();
  } else {
    await page.getByRole("button", { name: /^Save$/ }).click();
  }

  await responsePromise;
}
