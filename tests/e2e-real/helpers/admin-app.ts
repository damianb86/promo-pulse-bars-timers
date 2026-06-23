import type { Frame, Page } from "@playwright/test";

import prisma from "../../../app/db.server";
import { expect } from "./fixtures";
import {
  completeDirectAppLoginIfNeeded,
  getAppFrameOrPage,
  openPromoPulseApp,
  openPromoPulseAppDirect,
  type AppScope,
} from "./auth";
import { E2E_PREFIX, getConfig, uniqueName } from "./env";

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
  await selectLegacyCampaignTypeIfPresent(app, values.type);
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
  await selectOnlyCampaignPlacement(app, values.placement);

  await clickCampaignBuilderTab(app, "schedule");
  const startInput = app.getByLabel("Start date/time");
  if (await startInput.isVisible().catch(() => false)) {
    await startInput.fill(toDateTimeLocal(-5));
  }
  const endInput = app.getByLabel(/^End date/);
  if (await endInput.isVisible().catch(() => false)) {
    await endInput.fill(toDateTimeLocal(24 * 60));
  }
  await app.getByLabel("Timezone").fill(values.timezone);
  await app.getByRole("button", { name: /save campaign/i }).click();
  await confirmSaveCampaignIfNeeded(app);

  await expectEditorReady(page);
  await boostPrefixedCampaignPriority(values.name);

  if (values.status === "ACTIVE") {
    await publishCampaignDraft(page);
  }

  return values.name;
}

async function selectOnlyCampaignPlacement(scope: AppScope, placement: string) {
  const label = placementLabel(placement);
  const target = scope.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(label)}\\b`),
  });

  await target.click();

  if (placement !== "TOP_BAR") {
    const topBar = scope.getByRole("button", { name: /^Top bar\b/ });

    if ((await topBar.getAttribute("aria-pressed")) === "true") {
      await topBar.click();
    }
  }
}

function placementLabel(value: string) {
  const labels: Record<string, string> = {
    BOTTOM_BAR: "Bottom bar",
    CART_DRAWER: "Cart drawer",
    CART_PAGE: "Cart page",
    COLLECTION_CARD: "Collection card",
    CUSTOM_SELECTOR: "Custom selector",
    ORDER_STATUS_PAGE: "Order status page",
    PRODUCT_PAGE: "Product page",
    THANK_YOU_PAGE: "Thank you page",
    TOP_BAR: "Top bar",
  };

  return labels[value] ?? value;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  await clickCampaignEditorTab(app, "experiments");
  const createExperimentForm = app
    .locator('form:has(input[name="_action"][value="createExperiment"])')
    .first();
  await createExperimentForm.getByLabel("Experiment name").fill(experimentName);
  await createExperimentForm
    .getByRole("button", { name: "Add variant" })
    .click();

  const variantDrawer = app.getByRole("complementary", {
    name: "Edit variant",
  });
  await expect(variantDrawer).toBeVisible();
  await variantDrawer.getByRole("button", { name: "Done" }).click();
  await expect(variantDrawer).toHaveCount(0);
  await createExperimentForm
    .getByRole("button", { name: /create experiment/i })
    .click();

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

    await row.getByRole("button", { name: /delete/i }).click();
    await confirmCampaignListAction(page, app, /delete/i);
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
    await openCampaignHrefInCurrentApp(page, app, href);
    await expectEditorReady(page);
    return;
  }

  await link.click();
  await page.waitForLoadState("domcontentloaded");

  await expectEditorReady(page);
}

export async function editCampaignBasics(
  page: Page,
  updates: Pick<CampaignOptions, "headline" | "subheadline" | "ctaText">,
) {
  const app = await getAppFrameOrPage(page);
  await clickCampaignEditorTab(app, "campaign");
  await clickCampaignBuilderTab(app, "message");
  const messagePanel = app.getByRole("tabpanel", { name: "Message" });

  if (updates.headline) {
    await messagePanel.locator('input[name="headline"]').fill(updates.headline);
  }
  if (updates.subheadline) {
    await messagePanel
      .locator('textarea[name="subheadline"]')
      .fill(updates.subheadline);
  }
  if (updates.ctaText) {
    await messagePanel.locator('input[name="ctaText"]').fill(updates.ctaText);
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
  const candidates = [
    {
      tabId: `campaign-builder-tab-${key}`,
      panelId: `campaign-builder-panel-${key}`,
    },
    {
      tabId: `campaign-basics-builder-tab-${key}`,
      panelId: `campaign-basics-builder-panel-${key}`,
    },
  ];

  for (const candidate of candidates) {
    if (await app.locator(`#${candidate.tabId}`).count()) {
      await clickTabUntilPanelVisible(app, candidate.tabId, candidate.panelId);
      return;
    }
  }

  await clickTabUntilPanelVisible(
    app,
    candidates[0].tabId,
    candidates[0].panelId,
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
  const tab = app.locator(`#${id}`);

  await tab.click({ timeout: 5_000 }).catch(async () => {
    await tab.evaluate((element, tabId) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Tab ${tabId} is not an HTMLElement.`);
      }

      element.click();
    }, id);
  });
}

export async function pauseAllPrefixedCampaigns(page: Page) {
  void page;

  await prisma.campaign.updateMany({
    where: {
      name: { startsWith: E2E_PREFIX },
      status: "ACTIVE",
    },
    data: {
      status: "PAUSED",
    },
  });
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
  await confirmCampaignListAction(page, app, actionName);
  await page.waitForLoadState("domcontentloaded");
}

async function confirmCampaignListAction(
  page: Page,
  app: AppScope,
  actionName: RegExp,
) {
  const dialog = app
    .getByRole("dialog")
    .filter({ hasText: actionName })
    .first();

  if (!(await dialog.isVisible({ timeout: 5_000 }).catch(() => false))) {
    return;
  }

  const responsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns") &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    )
    .catch(() => null);
  const confirmButton = dialog.getByRole("button", { name: actionName }).last();

  await confirmButton.click({ timeout: 10_000 }).catch(async (error) => {
    if (await dialog.isVisible().catch(() => false)) {
      throw error;
    }
  });
  await responsePromise;
}

async function confirmSaveCampaignIfNeeded(app: AppScope) {
  const dialog = app.getByRole("dialog", { name: /save this campaign/i });

  if (!(await dialog.isVisible({ timeout: 5_000 }).catch(() => false))) {
    return;
  }

  await dialog.getByRole("button", { name: /^save campaign$/i }).click();
}

async function expectEditorReady(page: Page) {
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    await completeDirectAppLoginIfNeeded(page);

    const app = await getAppFrameOrPage(page);
    const workspace = app.locator(".counterpulse-editor-workspace");
    const publishButton = app.getByTestId("campaign-publish-button");

    if (
      (await workspace.isVisible().catch(() => false)) &&
      (await publishButton.isVisible().catch(() => false))
    ) {
      return;
    }

    await page.waitForTimeout(500);
  }

  const app = await getAppFrameOrPage(page);
  await expect(app.locator(".counterpulse-editor-workspace")).toBeVisible({
    timeout: 1,
  });
  await expect(app.getByTestId("campaign-publish-button")).toBeVisible({
    timeout: 1,
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
    window.dispatchEvent(new CustomEvent("promo-pulse:campaign-save"));
  });
}

async function boostPrefixedCampaignPriority(campaignName: string) {
  if (!campaignName.startsWith(E2E_PREFIX)) return;

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: getConfig().shopDomain },
    select: { id: true },
  });

  if (!shop) return;

  const maxPriority = await prisma.campaign.aggregate({
    where: {
      shopId: shop.id,
    },
    _max: {
      priority: true,
    },
  });

  await prisma.campaign.updateMany({
    where: {
      name: campaignName,
      shopId: shop.id,
    },
    data: {
      priority: (maxPriority._max.priority ?? 0) + 1,
    },
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

function isFrameScope(scope: AppScope): scope is Frame {
  return "parentFrame" in scope;
}

async function openCampaignHrefInCurrentApp(
  page: Page,
  app: AppScope,
  href: string,
) {
  const appPath = normalizeAppPath(href);

  if (isFrameScope(app)) {
    const currentUrl = new URL(app.url());
    const targetUrl = new URL(appPath, currentUrl.origin);
    targetUrl.search = currentUrl.search;

    await app.goto(targetUrl.toString(), { waitUntil: "domcontentloaded" });
    return;
  }

  await openPromoPulseAppDirect(page, appPath);
}

export function campaignEditorScope(scope: AppScope) {
  return scope.locator("[data-campaign-form]").first();
}

async function checkCampaignGoal(app: AppScope, goalLabel: string) {
  const byRole = app
    .getByRole("radio", {
      name: new RegExp(`^${escapeRegExp(goalLabel)}\\b`, "i"),
    })
    .first();

  if (await byRole.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await byRole.click();
    await expect(byRole).toHaveAttribute("aria-checked", "true");
    return;
  }

  const nativeInput = app.locator(
    `input[name="campaignTypeChoice"][value="${goalValueForLabel(goalLabel)}"]`,
  );

  if (await nativeInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await nativeInput.check();
    return;
  }

  await app
    .locator(`input[name="goal"][value="${goalValueForLabel(goalLabel)}"]`)
    .waitFor({ state: "attached", timeout: 5_000 });
}

async function selectLegacyCampaignTypeIfPresent(app: AppScope, type: string) {
  const legacySelect = app.locator('select[name="type"]').first();

  if (await legacySelect.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await legacySelect.selectOption(type);
    return;
  }

  await app
    .locator(`input[name="type"][value="${type}"]`)
    .waitFor({ state: "attached", timeout: 5_000 })
    .catch(() => undefined);
}

function goalValueForLabel(goalLabel: string) {
  return goalLabel.toUpperCase().replace(/\s+/g, "_");
}
