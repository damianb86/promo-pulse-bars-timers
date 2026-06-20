import { expect, test } from "./helpers/fixtures";
import type { Locator } from "@playwright/test";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import { getAppFrameOrPage, type AppScope } from "./helpers/auth";
import {
  clickCampaignBuilderTab,
  clickCampaignEditorTab,
  createCampaignViaUI,
  publishCampaignDraft,
  saveCampaignDraft,
} from "./helpers/admin-app";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";

test.describe("real design and timer configuration", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("persists timer type, timer labels, layouts, presets, gradient styling, and publishes to the storefront", async ({
    page,
  }, testInfo) => {
    const campaignName = uniqueName("Timer Configuration");
    const headline = `${campaignName} headline`;

    await createCampaignViaUI(page, {
      headline,
      name: campaignName,
      placement: "TOP_BAR",
      status: "DRAFT",
      subheadline: "Timer settings should persist.",
      type: "COUNTDOWN_BAR",
    });

    let app = await getAppFrameOrPage(page);
    await clickCampaignEditorTab(app, "campaign");
    await clickCampaignBuilderTab(app, "schedule");

    await selectTimerMode(app, "EVERGREEN_SESSION");
    await app.locator('input[name="timerDurationMinutes"]').fill("45");
    await app.getByLabel("Once it ends").selectOption("SHOW_CUSTOM_TITLE");
    await app
      .locator('input[name="expiredText"]')
      .fill("Timer finished for this buyer");

    const recurringTimer = app.locator(
      'input[type="radio"][name="timerMode"][value="RECURRING_DAILY"]',
    );
    await expect(recurringTimer).toHaveCount(1);

    await selectTimerMode(app, "FIXED_DATE");
    const scheduledStart = app.locator(
      'input[type="radio"][name="timerStartsMode"][value="SCHEDULED"]',
    );
    if (await scheduledStart.isDisabled().catch(() => false)) {
      await expect(scheduledStart).toBeDisabled();
    } else {
      await scheduledStart.check({ force: true });
      await expect(
        app.locator(
          '#campaign-builder-panel-schedule input[name="startsAt"][type="datetime-local"]',
        ),
      ).toBeVisible();
      await app
        .locator('input[type="radio"][name="timerStartsMode"][value="NOW"]')
        .check({ force: true });
    }

    await selectTimerMode(app, "EVERGREEN_SESSION");
    await saveCampaignDraft(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    app = await getAppFrameOrPage(page);
    await clickCampaignEditorTab(app, "campaign");
    await clickCampaignBuilderTab(app, "schedule");
    await expect(
      app.locator(
        'input[type="radio"][name="timerMode"][value="EVERGREEN_SESSION"]',
      ),
    ).toBeChecked();
    await expect(app.locator('input[name="timerDurationMinutes"]')).toHaveValue(
      "45",
    );
    await expect(app.getByLabel("Once it ends")).toHaveValue(
      "SHOW_CUSTOM_TITLE",
    );
    await expect(app.locator('input[name="expiredText"]')).toHaveValue(
      "Timer finished for this buyer",
    );

    await clickCampaignEditorTab(app, "design");
    const controls = app.locator(".counterpulse-design-editor__controls");
    const preview = app
      .locator(
        ".counterpulse-design-editor__preview .counterpulse-preview-promo",
      )
      .first();

    const layouts = [
      ["Standard", "STANDARD"],
      ["Balanced", "BALANCED"],
      ["Inline", "INLINE"],
      ["Button right", "CTA_RIGHT"],
      ["Button left", "CTA_LEFT"],
      ["Button top", "CTA_TOP"],
    ] as const;

    for (const [label, value] of layouts) {
      await controls.getByRole("button", { name: label }).click();
      await expect(controls.locator('input[name="layout"]')).toHaveValue(value);
      await expect(preview).toHaveClass(
        new RegExp(`counterpulse-preview-promo--layout-${value.toLowerCase()}`),
      );
    }

    await controls.getByRole("button", { name: "Button left" }).click();
    await controls.getByRole("button", { name: "Dawn" }).click();
    await expect(controls.locator('input[name="layout"]')).toHaveValue(
      "CTA_LEFT",
    );

    await controls
      .locator('input[type="radio"][name="backgroundType"][value="GRADIENT"]')
      .check({ force: true });
    await controls.locator('input[name="gradientStartColor"]').fill("#123456");
    await controls.locator('input[name="gradientEndColor"]').fill("#ABCDEF");
    await controls.locator('input[type="range"]').first().fill("135");
    await expect(preview).toHaveCSS(
      "background-image",
      /linear-gradient.*rgb\(18, 52, 86\).*rgb\(171, 205, 239\)/,
    );

    await expect(
      controls.locator('select[name="fontFamily"] option'),
    ).toHaveCount(9);
    await controls
      .locator('select[name="fontFamily"]')
      .selectOption("HUMANIST");

    await controls.getByRole("button", { name: "Boxes" }).click();
    await controls.getByRole("button", { name: "Units" }).click();
    await ensureCheckbox(
      controls.locator('input[name="timerShowLabels"]'),
      true,
    );
    await ensureCheckbox(
      controls.locator('input[name="timerShowSeconds"]'),
      false,
    );
    await ensureCheckbox(
      controls.locator('input[name="timerHideZeroDays"]'),
      false,
    );
    await controls.getByLabel("Days label").fill("D");
    await controls.getByLabel("Hours label").fill("Hr");
    await controls.getByLabel("Minutes label").fill("Min");
    await controls.getByLabel("Seconds label").fill("Sec");

    await expect(
      preview.locator(".counterpulse-preview-timer--boxes"),
    ).toContainText("D");
    await expect(
      preview.locator(".counterpulse-preview-timer--boxes"),
    ).toContainText("Hr");
    await expect(
      preview.locator(".counterpulse-preview-timer--boxes"),
    ).toContainText("Min");
    await expect(
      preview.locator(".counterpulse-preview-timer--boxes"),
    ).not.toContainText("Sec");

    await controls.getByRole("button", { name: "Plain" }).click();
    await controls.getByRole("button", { name: "Colon" }).click();
    await expect(
      preview.locator(".counterpulse-preview-timer--colon"),
    ).toHaveText(/\d{2}:\d{2}:\d{2}/);

    await ensureCheckbox(controls.locator('input[name="fullWidth"]'), true);
    await ensureCheckbox(
      controls.locator('input[name="positionOverlay"]'),
      true,
    );
    await ensureCheckbox(
      controls.locator('input[name="showCloseButton"]'),
      false,
    );
    await expect(preview).toHaveClass(/counterpulse-preview-promo--full-width/);
    await expect(preview).toHaveClass(
      /counterpulse-preview-promo--position-overlay/,
    );
    await expect(preview.locator(".counterpulse-preview-close")).toHaveCount(0);

    await saveCampaignDraft(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    app = await getAppFrameOrPage(page);
    await clickCampaignEditorTab(app, "design");
    const reloadedControls = app.locator(
      ".counterpulse-design-editor__controls",
    );
    await expect(reloadedControls.locator('input[name="layout"]')).toHaveValue(
      "CTA_LEFT",
    );
    await expect(
      reloadedControls.locator('input[name="gradientStartColor"]'),
    ).toHaveValue("#123456");
    await expect(
      reloadedControls.locator('input[name="gradientEndColor"]'),
    ).toHaveValue("#ABCDEF");
    await expect(
      reloadedControls.locator('select[name="fontFamily"]'),
    ).toHaveValue("HUMANIST");
    await expect(
      reloadedControls.locator('input[name="timerStyle"]'),
    ).toHaveValue("PLAIN");
    await expect(
      reloadedControls.locator('input[name="timerFormat"]'),
    ).toHaveValue("COLON");
    await expect(reloadedControls.getByLabel("Days label")).toHaveValue("D");
    await expect(reloadedControls.getByLabel("Hours label")).toHaveValue("Hr");
    await expect(reloadedControls.getByLabel("Minutes label")).toHaveValue(
      "Min",
    );
    await expect(reloadedControls.getByLabel("Seconds label")).toHaveValue(
      "Sec",
    );
    await expect(
      reloadedControls.locator('input[name="timerShowSeconds"]'),
    ).not.toBeChecked();
    await expect(
      reloadedControls.locator('input[name="timerHideZeroDays"]'),
    ).not.toBeChecked();

    await publishCampaignDraft(page);

    await openStorefront(page, realE2ECacheBustPath("timer-config"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const bar = page
      .locator('[data-testid="promo-bar"], .pp-bar')
      .filter({ hasText: headline })
      .first();
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(
      bar.locator('[data-testid="promo-timer"], .pp-countdown').first(),
    ).toHaveText(/\d{2}:\d{2}:\d{2}/, { timeout: 30_000 });

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});

async function selectTimerMode(app: AppScope, value: string) {
  await app
    .locator(`input[type="radio"][name="timerMode"][value="${value}"]`)
    .check({ force: true });
}

async function ensureCheckbox(locator: Locator, checked: boolean) {
  const currentValue = await locator.first().isChecked();
  if (currentValue === checked) return;

  if (checked) {
    await locator.first().check({ force: true });
  } else {
    await locator.first().uncheck({ force: true });
  }
}
