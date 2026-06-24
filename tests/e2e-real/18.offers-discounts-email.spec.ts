import type { Locator, Page, TestInfo } from "@playwright/test";

import { test, expect } from "./helpers/fixtures";
import {
  DISCOUNT_CODE_PREFIX,
  getConfig,
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import {
  clickCampaignEditorTab,
  createCampaignViaUI,
  createUniqueCodeCampaign,
  openCampaignEditor,
  pauseAllPrefixedCampaigns,
  publishCampaignDraft,
} from "./helpers/admin-app";
import { getAppFrameOrPage } from "./helpers/auth";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";
import { readPngSize } from "./helpers/storefront-api";

test.describe("real offers, discounts, advanced rules, and email timers", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test.afterEach(async ({ page }) => {
    await pauseAllPrefixedCampaigns(page);
  });

  test("links a real basic discount, saves an advanced rule, and creates a public email timer image", async ({
    page,
  }, testInfo) => {
    const config = getConfig();
    test.skip(
      !config.existingDiscountCode,
      "Set REAL_E2E_EXISTING_DISCOUNT_CODE to a real safe Shopify discount code before running the Basic discount link test.",
    );

    const campaignName = await createCampaignViaUI(page, {
      headline: "Offer settings real E2E",
      name: uniqueName("Offers Full Stack"),
      placement: "TOP_BAR",
      status: "DRAFT",
      subheadline: "Discount and email timer settings should persist.",
      type: "COUNTDOWN_BAR",
    });
    let app = await getAppFrameOrPage(page);

    await clickCampaignEditorTab(app, "offers");
    await app.locator("#offer-tab-basic-discount").click();
    await skipIfLocked(app, testInfo, /discount.*locked|discount sync/i);

    const discountForm = app
      .locator('form:has(input[name="_action"][value="saveDiscount"])')
      .first();
    await discountForm
      .getByLabel("Discount mode")
      .selectOption("LINK_EXISTING");
    await discountForm
      .getByLabel("Existing discount code or ID")
      .fill(config.existingDiscountCode);
    await submitConfirmedForm(page, app, discountForm, "Save discount");

    app = await getAppFrameOrPage(page);
    await clickCampaignEditorTab(app, "offers");
    await app.locator("#offer-tab-basic-discount").click();
    await expect(app.getByLabel("Existing discount code or ID")).toHaveValue(
      config.existingDiscountCode,
    );

    await app.locator("#offer-tab-advanced-rules").click();
    await skipIfLocked(app, testInfo, /advanced discounts are locked/i);
    const advancedRuleForm = app
      .locator(
        'form:has(input[name="_action"][value="saveAdvancedDiscountRule"])',
      )
      .first();
    const ruleTitle = `${campaignName} tiered rule`;
    await advancedRuleForm.getByLabel("Rule title").fill(ruleTitle);
    await advancedRuleForm
      .getByLabel("Advanced discount rule type")
      .selectOption("TIERED_DISCOUNT");
    await advancedRuleForm
      .getByLabel("Advanced discount status")
      .selectOption("DRAFT");
    await advancedRuleForm.getByLabel("Advanced discount value").fill("12");
    await advancedRuleForm.getByLabel("Tier 1 minimum subtotal").fill("75");
    await advancedRuleForm.getByLabel("Tier 1 discount percent").fill("12");
    await submitConfirmedForm(
      page,
      app,
      advancedRuleForm,
      "Save advanced rule",
    );
    await expect(app.getByRole("cell", { name: ruleTitle })).toBeVisible({
      timeout: 30_000,
    });

    await app.locator("#offer-tab-email-timer").click();
    await skipIfLocked(app, testInfo, /email timers are locked/i);
    const emailTimerForm = app
      .locator('form:has(input[name="_action"][value="createEmailTimer"])')
      .first();
    await emailTimerForm.getByLabel("Transparent pixel").check();
    await submitConfirmedForm(page, app, emailTimerForm, "Create email timer");

    const imageUrlInput = app.getByLabel("Email timer URL").first();
    await expect(imageUrlInput).toHaveValue(/\/api\/email-timer\/.+\.png$/, {
      timeout: 30_000,
    });
    const imageUrl = await imageUrlInput.inputValue();
    const imageResponse = await page.request.get(imageUrl);
    expect(imageResponse.ok()).toBe(true);
    expect(imageResponse.headers()["content-type"]).toContain("image/png");
    expect(readPngSize(await imageResponse.body())).toMatchObject({
      width: 600,
      height: 180,
    });
    await expect(app.getByLabel("Email snippet").first()).toHaveValue(/<img/);

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("generates auto-apply unique codes and exposes a safe discount URL on the storefront", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);

    const campaignName = await createUniqueCodeCampaign(
      page,
      uniqueName("Unique Auto Apply"),
    );
    await openCampaignEditor(page, campaignName);
    const app = await getAppFrameOrPage(page);
    await clickCampaignEditorTab(app, "offers");
    await app.locator("#offer-tab-unique-codes").click();
    await skipIfLocked(app, testInfo, /unique codes are locked/i);

    const uniqueCodesForm = app
      .locator('form:has(input[name="_action"][value="generateUniqueCodes"])')
      .first();
    const prefix = `${DISCOUNT_CODE_PREFIX}AUTO`;
    await uniqueCodesForm.getByLabel("Enable unique codes").check();
    await uniqueCodesForm.getByLabel("Prefix").fill(prefix);
    await uniqueCodesForm
      .getByLabel("Discount type")
      .selectOption("PERCENTAGE");
    await uniqueCodesForm.getByLabel("Discount value").fill("15");
    await uniqueCodesForm.getByLabel("Duration per visitor").fill("45");
    await uniqueCodesForm.getByLabel("Total codes to generate").fill("8");
    const autoApply = uniqueCodesForm.getByLabel("Auto-apply visitor codes");
    if (!(await autoApply.isChecked())) {
      await autoApply.check();
    }
    await submitConfirmedForm(page, app, uniqueCodesForm, "Generate codes");
    await expect(
      app
        .getByRole("status")
        .filter({ hasText: /generated/i })
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await publishCampaignDraft(page);

    await openStorefront(page, realE2ECacheBustPath("unique_auto_apply"));
    await expectStorefrontEmbedOrSkip(page, testInfo);
    const widget = page
      .locator('[data-testid="promo-bar"], .pp-bar')
      .filter({ hasText: "Unique code real E2E" })
      .first();
    const code = widget.locator(".pp-unique-code__value").first();
    await expect(code).toHaveText(new RegExp(`^${prefix}`, "i"), {
      timeout: 30_000,
    });
    const codeValue = (await code.textContent())?.trim() ?? "";
    const applyDiscountLink = widget
      .locator('a.pp-cta[href^="/discount/"]')
      .first();
    await expect(applyDiscountLink).toHaveAttribute(
      "href",
      new RegExp(`^/discount/${escapeRegExp(codeValue)}`),
    );

    await applyDiscountLink.evaluate((element) => {
      element.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      });
      (element as HTMLElement).click();
    });

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});

async function skipIfLocked(
  app: Awaited<ReturnType<typeof getAppFrameOrPage>>,
  testInfo: TestInfo,
  pattern: RegExp,
) {
  if (
    await app
      .getByText(pattern)
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    testInfo.skip(true, "This offer capability is locked by the current plan.");
  }
}

async function submitConfirmedForm(
  page: Page,
  app: Awaited<ReturnType<typeof getAppFrameOrPage>>,
  form: Locator,
  buttonName: string,
) {
  const responsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
      { timeout: 30_000 },
    )
    .catch(() => null);

  await form.getByRole("button", { name: buttonName }).click();
  const dialog = app
    .getByRole("dialog")
    .filter({ hasText: buttonName })
    .first();
  if (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await dialog.getByRole("button", { name: buttonName }).last().click();
  }
  await responsePromise;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
