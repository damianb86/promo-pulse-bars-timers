import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
} from "./helpers/env";
import { getAppFrameOrPage, openPromoPulseApp } from "./helpers/auth";
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
    await app
      .locator("ui-save-bar")
      .getByRole("button", { name: /^save$/i })
      .click();

    await expect(
      app.getByText(/settings saved/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    const reloaded = await getAppFrameOrPage(page);
    await expect(reloaded.getByLabel("Brand name")).toHaveValue(
      temporaryBrandName,
    );

    await reloaded.getByLabel("Brand name").fill(originalBrandName);
    await reloaded
      .locator("ui-save-bar")
      .getByRole("button", { name: /^save$/i })
      .click();
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
