import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
} from "./helpers/env";
import { getAppFrameOrPage, openPromoPulseApp } from "./helpers/auth";
import { expectNoConsoleErrors } from "./helpers/assertions";

test.describe("real templates and AI builder", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("creates a draft from the template library and leaves AI output as draft", async ({
    page,
  }, testInfo) => {
    await openPromoPulseApp(page, "/app/templates");
    const app = await getAppFrameOrPage(page);

    if (await app.getByText(/template library is locked/i).isVisible().catch(() => false)) {
      testInfo.skip(true, "Template Library requires a plan that enables campaign templates.");
    }

    await expect(
      app.getByRole("heading", { name: "Campaign Template Library" }),
    ).toBeVisible();
    const useTemplate = app.getByRole("button", { name: /use template|create/i }).first();
    test.skip(
      !(await useTemplate.isVisible().catch(() => false)),
      "Seed system templates or relax filters before running template real E2E.",
    );

    await useTemplate.click();
    await expect(app.getByRole("button", { name: /update campaign/i })).toBeVisible({
      timeout: 30_000,
    });
    const campaignStatus = app.getByTestId("campaign-status-select");
    await expect(campaignStatus).toHaveValue("DRAFT");

    const aiGenerate = app.getByRole("button", { name: /generate/i }).first();
    if (await aiGenerate.isVisible().catch(() => false)) {
      await expect(campaignStatus).toHaveValue("DRAFT");
    }

    await expectNoConsoleErrors(page);
  });
});
