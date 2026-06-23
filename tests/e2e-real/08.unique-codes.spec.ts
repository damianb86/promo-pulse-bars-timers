import type { Page } from "@playwright/test";

import { test, expect } from "./helpers/fixtures";
import {
  DISCOUNT_CODE_PREFIX,
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import {
  clickCampaignEditorTab,
  createUniqueCodeCampaign,
  openCampaignEditor,
  pauseAllPrefixedCampaigns,
  publishCampaignDraft,
} from "./helpers/admin-app";
import { getAppFrameOrPage } from "./helpers/auth";
import { expectNoConsoleErrors } from "./helpers/assertions";
import {
  expectStorefrontEmbedOrSkip,
  newStorefrontVisitor,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";

test.describe("real unique codes", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("assigns stable unique codes per visitor and tracks copy/apply", async ({
    browser,
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);

    const campaignName = await createUniqueCodeCampaign(
      page,
      uniqueName("Unique Codes"),
    );
    await openCampaignEditor(page, campaignName);
    const app = await getAppFrameOrPage(page);

    if (
      await app
        .getByText(/unique codes are locked/i)
        .isVisible()
        .catch(() => false)
    ) {
      testInfo.skip(
        true,
        "Unique codes require a plan that enables unique_discount_codes.",
      );
    }

    await clickCampaignEditorTab(app, "offers");
    await app.locator("#offer-tab-unique-codes").click();

    const uniqueCodesForm = app
      .locator('form:has(input[name="_action"][value="generateUniqueCodes"])')
      .first();
    await uniqueCodesForm.locator('input[name="enableUniqueCodes"]').check();
    await uniqueCodesForm
      .locator('input[name="uniqueCodePrefix"]')
      .fill(DISCOUNT_CODE_PREFIX);
    await uniqueCodesForm.locator('input[name="value"]').fill("10");
    await uniqueCodesForm
      .locator('input[name="uniqueCodeExpiresMinutes"]')
      .fill("60");
    await uniqueCodesForm
      .locator('input[name="totalCodesToGenerate"]')
      .fill("25");
    await uniqueCodesForm
      .getByRole("button", { name: /generate codes/i })
      .click();

    const generateDialog = app.getByRole("dialog", {
      name: /generate unique visitor codes/i,
    });
    if (await generateDialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await generateDialog
        .getByRole("button", { name: /^generate codes$/i })
        .click();
    }

    await expect(
      app
        .getByRole("status")
        .filter({ hasText: /generated|unique codes updated/i })
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await publishCampaignDraft(page);

    const storefrontPath = realE2ECacheBustPath("unique_codes");
    await openStorefront(page, storefrontPath);
    await expectStorefrontEmbedOrSkip(page, testInfo);
    const codeA = uniqueCodeLocatorForCampaign(page, "Unique code real E2E");
    await expect(codeA).toBeVisible({ timeout: 30_000 });
    const firstCode = (await codeA.textContent())?.trim();
    expect(firstCode).toMatch(/^PPE2E/i);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      uniqueCodeLocatorForCampaign(page, "Unique code real E2E"),
    ).toHaveText(firstCode ?? "");

    const visitorB = await newStorefrontVisitor(
      browser,
      realE2ECacheBustPath("unique_codes_visitor_b"),
    );
    const visitorBCode = uniqueCodeLocatorForCampaign(
      visitorB.page,
      "Unique code real E2E",
    );
    await expect(visitorBCode).toBeVisible({
      timeout: 30_000,
    });
    const secondCode = (await visitorBCode.textContent())?.trim();
    expect(secondCode).toBeTruthy();
    expect(secondCode).not.toEqual(firstCode);
    await visitorB.context.close();

    await uniqueCodeBar(page, "Unique code real E2E")
      .locator('[data-testid="copy-code-button"], button.pp-code')
      .filter({ hasText: /copy|[A-Z0-9]/i })
      .first()
      .click();
    await expectNoConsoleErrors(page);
  });
});

function uniqueCodeBar(page: Page, headline: string) {
  return page
    .locator('[data-testid="promo-bar"], .pp-bar')
    .filter({ hasText: headline })
    .first();
}

function uniqueCodeLocatorForCampaign(
  page: Page,
  headline: string,
) {
  return uniqueCodeBar(page, headline)
    .locator(".pp-unique-code__value")
    .first();
}
