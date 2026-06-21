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
    const supportEmail = `pp-e2e+${Date.now()}@example.com`;

    await app.getByLabel("Support email").fill(supportEmail);
    await app.getByRole("button", { name: /save settings/i }).click();
    const confirmDialog = app.getByRole("dialog", {
      name: /save shop defaults/i,
    });

    if (await confirmDialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await confirmDialog
        .getByRole("button", { name: /^save settings$/i })
        .click();
    }

    await expect(
      app.getByText(/settings saved/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    const reloaded = await getAppFrameOrPage(page);
    await expect(reloaded.getByLabel("Support email")).toHaveValue(supportEmail);

    await openPromoPulseApp(page, "/app/billing");
    const billing = await getAppFrameOrPage(page);
    await expect(billing.getByText(/current:/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(billing.getByText(/available plans/i)).toBeVisible();

    await expectNoConsoleErrors(page);
  });
});
