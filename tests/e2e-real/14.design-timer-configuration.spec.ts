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
  pauseAllPrefixedCampaigns,
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

  test.afterEach(async ({ page }) => {
    await pauseAllPrefixedCampaigns(page);
  });

  test("persists timer type, timer labels, layouts, presets, gradient styling, and publishes to the storefront", async ({
    page,
  }, testInfo) => {
    const campaignName = uniqueName("Timer Configuration");
    const headline = `${campaignName} headline`;
    const endDate = toDateTimeLocalInputValue(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );

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
    let schedulePanel = app.getByRole("tabpanel", { name: "Schedule" });

    await selectTimerMode(app, "EVERGREEN_SESSION");
    await schedulePanel.locator('input[name="timerDurationMinutes"]').fill("45");
    await schedulePanel
      .locator('select[name="timerExpiredBehavior"]')
      .selectOption("SHOW_CUSTOM_TITLE");
    await schedulePanel
      .locator('input[name="expiredText"]')
      .fill("Timer finished for this buyer");

    const recurringTimer = schedulePanel.locator(
      'input[type="radio"][name="timerMode"][value="RECURRING_DAILY"]',
    );
    await expect(recurringTimer).toHaveCount(1);

    await selectTimerMode(app, "FIXED_DATE");
    const scheduledStart = schedulePanel.locator(
      'input[type="radio"][name="timerStartsMode"][value="SCHEDULED"]',
    );
    if (await scheduledStart.isDisabled().catch(() => false)) {
      await expect(scheduledStart).toBeDisabled();
    } else {
      await scheduledStart.check({ force: true });
      await expect(schedulePanel.getByLabel("Start date/time")).toBeVisible();
      await schedulePanel
        .locator('input[type="radio"][name="timerStartsMode"][value="NOW"]')
        .check({ force: true });
    }
    await schedulePanel.getByLabel("End date").fill(endDate);

    await saveCampaignDraft(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    app = await getAppFrameOrPage(page);
    await clickCampaignEditorTab(app, "campaign");
    await clickCampaignBuilderTab(app, "schedule");
    schedulePanel = app.getByRole("tabpanel", { name: "Schedule" });
    await expect(
      schedulePanel.locator(
        'input[type="radio"][name="timerMode"][value="FIXED_DATE"]',
      ),
    ).toBeChecked();
    await expect(schedulePanel.getByLabel("End date")).toHaveValue(endDate);
    await expect(
      schedulePanel.locator('select[name="timerExpiredBehavior"]'),
    ).toHaveValue("SHOW_CUSTOM_TITLE");
    await expect(
      schedulePanel.locator('input[name="expiredText"]'),
    ).toHaveValue("Timer finished for this buyer");

    await clickCampaignEditorTab(app, "design");
    const controls = app.locator(".counterpulse-design-editor__controls");
    const preview = app
      .locator(
        ".counterpulse-design-editor__preview .counterpulse-preview-promo",
      )
      .first();

    const layouts = [
      ["Stacked", "STANDARD"],
      ["Split", "BALANCED"],
      ["Inline", "INLINE"],
      ["Wide stacked", "STACKED_WIDE"],
      ["Compact stack", "COMPACT_STACK"],
      ["Action right", "CTA_RIGHT"],
      ["Action left", "CTA_LEFT"],
      ["Action top", "CTA_TOP"],
    ] as const;

    for (const [label, value] of layouts) {
      await selectPreviewDropdownOption(controls, "Layout options", label);
      await expect(controls.locator('input[name="layout"]')).toHaveValue(value);
      await expect(preview).toHaveClass(
        new RegExp(`counterpulse-preview-promo--layout-${value.toLowerCase()}`),
      );
    }

    await selectPreviewDropdownOption(
      controls,
      "Layout options",
      "Action left",
    );
    await selectPreviewDropdownOption(controls, "Preset options", "Dawn");
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
    await controls.locator('input[name="closeButtonColor"]').fill("#00FF88");
    await controls
      .locator('select[name="entranceAnimation"]')
      .selectOption("SLIDE");
    await controls.locator('select[name="exitAnimation"]').selectOption("POP");
    await controls.locator('input[name="animationDurationMs"]').fill("480");
    await controls
      .locator('select[name="timerTickAnimation"]')
      .selectOption("PULSE");
    await expect(preview.locator(".counterpulse-preview-close")).toHaveCSS(
      "color",
      "rgb(0, 255, 136)",
    );
    await expect(preview).toHaveClass(
      /counterpulse-preview-promo--enter-slide/,
    );
    await expect(preview).toHaveClass(/counterpulse-preview-promo--exit-pop/);

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
    await expect(
      preview.locator(".counterpulse-preview-timer--tick-pulse"),
    ).toBeVisible();

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
      reloadedControls.locator('input[name="closeButtonColor"]'),
    ).toHaveValue("#00FF88");
    await expect(
      reloadedControls.locator('select[name="entranceAnimation"]'),
    ).toHaveValue("SLIDE");
    await expect(
      reloadedControls.locator('select[name="exitAnimation"]'),
    ).toHaveValue("POP");
    await expect(
      reloadedControls.locator('input[name="animationDurationMs"]'),
    ).toHaveValue("480");
    await expect(
      reloadedControls.locator('select[name="timerTickAnimation"]'),
    ).toHaveValue("PULSE");
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
    .getByRole("tabpanel", { name: "Schedule" })
    .locator(`input[type="radio"][name="timerMode"][value="${value}"]`)
    .check({ force: true });
}

async function selectPreviewDropdownOption(
  container: Locator,
  dropdownLabel: string,
  optionLabel: string,
) {
  await container.getByRole("button", { name: dropdownLabel }).click();
  await container
    .getByRole("option", {
      name: new RegExp(`^${escapeRegExp(optionLabel)}\\b`),
    })
    .click();
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toDateTimeLocalInputValue(date: Date) {
  const localTime = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );

  return localTime.toISOString().slice(0, 16);
}
