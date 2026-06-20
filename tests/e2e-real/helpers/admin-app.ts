import type { Page } from "@playwright/test";

import { expect } from "./fixtures";
import { getAppFrameOrPage, openPromoPulseApp, type AppScope } from "./auth";
import { E2E_PREFIX, uniqueName } from "./env";

type CampaignOptions = Partial<{
  ctaText: string;
  ctaUrl: string;
  goal: string;
  headline: string;
  name: string;
  placement: string;
  status: "ACTIVE" | "DRAFT" | "PAUSED";
  subheadline: string;
  timezone: string;
  type: string;
}>;

export async function createCampaignViaUI(
  page: Page,
  options: CampaignOptions = {},
) {
  const values = {
    ctaText: "Shop now",
    ctaUrl: "/collections/all",
    goal: "Flash sale",
    headline: "Promo Pulse real E2E",
    name: uniqueName("Campaign"),
    placement: "TOP_BAR",
    status: "DRAFT",
    subheadline: "Created by real-store Playwright.",
    timezone: "UTC",
    type: "COUNTDOWN_BAR",
    ...options,
  };

  await openPromoPulseApp(page, "/app/campaigns/new");
  const app = await getAppFrameOrPage(page);

  await waitForCampaignBuilderInteractivity(app);
  await checkCampaignGoal(app, values.goal);
  await app.getByLabel("Campaign type").selectOption(values.type);
  await app.getByLabel("Campaign name").fill(values.name);
  await app
    .getByRole("combobox", { name: /^Status$/ })
    .selectOption(values.status);

  await clickCampaignBuilderTab(app, "message");
  await app.locator('input[name="headline"]').fill(values.headline);
  await app.locator('textarea[name="subheadline"]').fill(values.subheadline);
  await app.getByLabel("CTA text").fill(values.ctaText);
  await app.getByLabel("CTA URL").fill(values.ctaUrl);

  await clickCampaignBuilderTab(app, "placement");
  await app.getByLabel("Primary placement").selectOption(values.placement);

  await clickCampaignBuilderTab(app, "schedule");
  const startInput = app.getByLabel("Start date/time");
  if (await startInput.isVisible().catch(() => false)) {
    await startInput.fill(toDateTimeLocal(-5));
  }
  await app.getByLabel(/^End date/).fill(toDateTimeLocal(24 * 60));
  await app.getByLabel("Timezone").fill(values.timezone);
  await app.getByRole("button", { name: /save campaign/i }).click();
  await confirmSaveCampaignIfNeeded(app);

  await expectEditorReady(page);

  return values.name;
}

export async function createCountdownCampaign(page: Page, name?: string) {
  return createCampaignViaUI(page, {
    goal: "Flash sale",
    headline: "Countdown real E2E",
    name: name ?? uniqueName("Countdown Bar"),
    placement: "TOP_BAR",
    status: "ACTIVE",
    subheadline: "Timer should be visible.",
    type: "COUNTDOWN_BAR",
  });
}

export async function createFreeShippingCampaign(page: Page, name?: string) {
  return createCampaignViaUI(page, {
    goal: "Free shipping",
    headline: "Free shipping real E2E",
    name: name ?? uniqueName("Free Shipping Goal"),
    placement: "TOP_BAR",
    status: "ACTIVE",
    subheadline: "Progress should update in cart.",
    type: "FREE_SHIPPING_GOAL",
  });
}

export async function createDeliveryCutoffCampaign(page: Page, name?: string) {
  return createCampaignViaUI(page, {
    goal: "Delivery cutoff",
    headline: "Delivery cutoff real E2E",
    name: name ?? uniqueName("Delivery Cutoff"),
    placement: "TOP_BAR",
    status: "ACTIVE",
    subheadline: "Order within the delivery window.",
    type: "DELIVERY_CUTOFF",
  });
}

export async function createCartTimerCampaign(page: Page, name?: string) {
  return createCampaignViaUI(page, {
    goal: "Cart rescue",
    headline: "Cart timer real E2E",
    name: name ?? uniqueName("Cart Timer"),
    placement: "CART_DRAWER",
    status: "ACTIVE",
    subheadline: "Your cart is reserved.",
    type: "CART_TIMER",
  });
}

export async function createUniqueCodeCampaign(page: Page, name?: string) {
  return createCampaignViaUI(page, {
    goal: "Flash sale",
    headline: "Unique code real E2E",
    name: name ?? uniqueName("Unique Codes"),
    placement: "TOP_BAR",
    status: "ACTIVE",
    subheadline: "Copy your one-time code.",
    type: "COUNTDOWN_BAR",
  });
}

export async function createExperimentViaUI(page: Page, campaignName: string) {
  await openCampaignEditor(page, campaignName);
  const app = await getAppFrameOrPage(page);
  const experimentName = uniqueName("Experiment");

  await app.getByLabel("Experiment name").first().fill(experimentName);
  await app.getByRole("button", { name: /create experiment/i }).click();

  const refreshedApp = await getAppFrameOrPage(page);
  await expect(
    refreshedApp.locator("tr", { hasText: experimentName }).first(),
  ).toBeVisible({ timeout: 30_000 });

  return experimentName;
}

export async function pauseCampaign(page: Page, campaignName: string) {
  await campaignListAction(page, campaignName, /pause/i);
}

export async function activateCampaign(page: Page, campaignName: string) {
  await campaignListAction(page, campaignName, /activate/i);
}

export async function deleteCampaignIfExists(page: Page, campaignName: string) {
  await openPromoPulseApp(page, "/app/campaigns");
  const app = await getAppFrameOrPage(page);
  await searchCampaign(page, campaignName);

  for (let attempts = 0; attempts < 5; attempts += 1) {
    const row = app.locator("tr", { hasText: campaignName }).first();
    if (!(await row.isVisible().catch(() => false))) return;

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: /delete/i }).click();
    await page.waitForLoadState("domcontentloaded");
    await searchCampaign(page, campaignName);
  }
}

export async function searchCampaign(page: Page, campaignName: string) {
  const app = await getAppFrameOrPage(page);
  const search = app.getByLabel("Search by name");
  await search.fill(campaignName);
  await app.getByRole("button", { name: /apply/i }).click();
}

export async function openCampaignEditor(page: Page, campaignName: string) {
  await openPromoPulseApp(page, "/app/campaigns");
  const app = await getAppFrameOrPage(page);
  await searchCampaign(page, campaignName);
  const link = app.getByRole("link", { name: campaignName });
  const href = await link.getAttribute("href");

  if (href) {
    await openPromoPulseApp(page, normalizeAppPath(href));
  } else {
    await link.click();
  }

  await expectEditorReady(page);
}

export async function editCampaignBasics(
  page: Page,
  updates: Pick<CampaignOptions, "headline" | "subheadline" | "ctaText">,
) {
  const app = await getAppFrameOrPage(page);
  await clickCampaignEditorTab(app, "campaign");
  await clickCampaignBuilderTab(app, "message");

  if (updates.headline) {
    await app.locator('input[name="headline"]').fill(updates.headline);
  }
  if (updates.subheadline) {
    await app.locator('textarea[name="subheadline"]').fill(updates.subheadline);
  }
  if (updates.ctaText) {
    await app.locator('input[name="ctaText"]').fill(updates.ctaText);
  }

  await saveCampaignDraft(page);
}

export async function saveCampaignDraft(page: Page) {
  const app = await getAppFrameOrPage(page);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    triggerDraftSave(app),
  ]);
  await expectEditorReady(page);
}

export async function publishCampaignDraft(page: Page) {
  const app = await getAppFrameOrPage(page);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    app.getByTestId("campaign-publish-button").click(),
  ]);
  await expectEditorReady(page);
}

export async function clickCampaignEditorTab(app: AppScope, key: string) {
  await clickTabUntilPanelVisible(
    app,
    `campaign-editor-tab-${key}`,
    `campaign-editor-panel-${key}`,
  );
}

export async function clickCampaignBuilderTab(app: AppScope, key: string) {
  await clickTabUntilPanelVisible(
    app,
    `campaign-builder-tab-${key}`,
    `campaign-builder-panel-${key}`,
  );
}

async function waitForCampaignBuilderInteractivity(app: AppScope) {
  await clickCampaignBuilderTab(app, "message");
  await clickCampaignBuilderTab(app, "setup");
}

async function clickTabUntilPanelVisible(
  app: AppScope,
  tabId: string,
  panelId: string,
) {
  const panel = app.locator(`#${panelId}`);
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    await clickTabById(app, tabId);

    if (await panel.isVisible().catch(() => false)) return;

    await app.waitForTimeout(400);
  }

  await expect(panel).toBeVisible({ timeout: 1 });
}

async function clickTabById(app: AppScope, id: string) {
  await app.locator(`#${id}`).evaluate((element, tabId) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Tab ${tabId} is not an HTMLElement.`);
    }

    element.click();
  }, id);
}

export async function pauseAllPrefixedCampaigns(page: Page) {
  await openPromoPulseApp(page, "/app/campaigns");
  const app = await getAppFrameOrPage(page);
  await searchCampaign(page, E2E_PREFIX);

  const rows = app.locator("tr", { hasText: E2E_PREFIX });
  const count = await rows.count();

  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const pause = row.getByRole("button", { name: /pause/i });
    if (await pause.isVisible().catch(() => false)) {
      await pause.click();
      await page.waitForLoadState("domcontentloaded");
    }
  }
}

async function campaignListAction(
  page: Page,
  campaignName: string,
  actionName: RegExp,
) {
  await openPromoPulseApp(page, "/app/campaigns");
  const app = await getAppFrameOrPage(page);
  await searchCampaign(page, campaignName);

  const row = app.locator("tr", { hasText: campaignName }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole("button", { name: actionName }).click();
  await page.waitForLoadState("domcontentloaded");
}

async function confirmSaveCampaignIfNeeded(app: AppScope) {
  const dialog = app.getByRole("dialog", { name: /save this campaign/i });

  if (!(await dialog.isVisible({ timeout: 5_000 }).catch(() => false))) {
    return;
  }

  await dialog.getByRole("button", { name: /^save campaign$/i }).click();
}

async function expectEditorReady(page: Page) {
  const app = await getAppFrameOrPage(page);
  await expect(app.locator(".counterpulse-editor-workspace")).toBeVisible({
    timeout: 30_000,
  });
  await expect(app.getByTestId("campaign-publish-button")).toBeVisible({
    timeout: 30_000,
  });
}

async function triggerDraftSave(app: AppScope) {
  const saveButton = app
    .locator("ui-save-bar button")
    .filter({ hasText: /^Save$/ })
    .first();

  if (await saveButton.isVisible().catch(() => false)) {
    await saveButton.click();
    return;
  }

  await app.evaluate(() => {
    window.dispatchEvent(new CustomEvent("counterpulse:campaign-save"));
  });
}

function toDateTimeLocal(minutesFromNow: number) {
  const date = new Date(Date.now() + minutesFromNow * 60_000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizeAppPath(href: string) {
  try {
    const url = new URL(href, "https://promo-pulse.local");
    return `${url.pathname}${url.search}`;
  } catch {
    return href;
  }
}

export function campaignEditorScope(scope: AppScope) {
  return scope.locator("[data-campaign-form]").first();
}

async function checkCampaignGoal(app: AppScope, goalLabel: string) {
  const byRole = app.getByRole("radio", { exact: true, name: goalLabel });

  if (await byRole.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await byRole.check();
    return;
  }

  await app
    .locator(`input[name="goal"][value="${goalValueForLabel(goalLabel)}"]`)
    .check();
}

function goalValueForLabel(goalLabel: string) {
  return goalLabel.toUpperCase().replace(/\s+/g, "_");
}
