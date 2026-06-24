import { PlacementType } from "@prisma/client";
import type { Page } from "@playwright/test";

import prisma from "../../app/db.server";
import { normalizeBehaviorTargetingRules } from "../../app/types/behavior-targeting";
import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import { getAppFrameOrPage, type AppScope } from "./helpers/auth";
import {
  clickCampaignEditorTab,
  openCampaignEditor,
  pauseAllPrefixedCampaigns,
} from "./helpers/admin-app";
import {
  createPublishedPlacementCampaign,
  findRealE2EShopId,
  placementHeadline,
} from "./helpers/placement-fixtures";
import { expectNoConsoleErrors } from "./helpers/assertions";

test.describe("real behavior targeting editor (front-end + persistence)", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test.afterEach(async ({ page }) => {
    await pauseAllPrefixedCampaigns(page);
  });

  async function openTargetingTab(page: Page) {
    const app = await getAppFrameOrPage(page);
    await clickCampaignEditorTab(app, "targeting");
    return app;
  }

  async function skipIfBehaviorLocked(app: AppScope) {
    const enable = app.locator('input[name="behaviorEnabled"]');
    const available = await enable
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    test.skip(
      !available,
      "Behavior targeting is locked on this plan. Run with a plan that includes BEHAVIORAL_TARGETING.",
    );
  }

  async function selectSegment(app: AppScope, key: string) {
    await app
      .locator(`input[name="behaviorSegments"][value="${key}"]`)
      .check();
  }

  test("opens per-segment panels, saves sub-options, and persists them", async ({
    page,
  }) => {
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );

    await pauseAllPrefixedCampaigns(page);
    const campaign = await createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline("Behavior editor"),
      name: uniqueName("Behavior Editor"),
      placement: PlacementType.TOP_BAR,
    });

    await openCampaignEditor(page, campaign.name);
    const app = await openTargetingTab(page);
    await skipIfBehaviorLocked(app);

    await app.locator('input[name="behaviorEnabled"]').check();

    // Returning visitor -> reveals min prior sessions + min days since first seen.
    await selectSegment(app, "RETURNING_VISITOR");
    await expect(
      app.locator('input[name="behaviorReturningMinPriorSessions"]'),
    ).toBeVisible();
    await app
      .locator('input[name="behaviorReturningMinPriorSessions"]')
      .fill("2");
    await app
      .locator('input[name="behaviorReturningMinDaysSinceFirstSeen"]')
      .fill("7");

    // Added to cart but no checkout -> reveals the delay field (the headline use case).
    await selectSegment(app, "ADDED_TO_CART_NO_CHECKOUT");
    await expect(
      app.locator('input[name="behaviorAddedToCartDelayMinutes"]'),
    ).toBeVisible();
    await app
      .locator('input[name="behaviorAddedToCartDelayMinutes"]')
      .fill("30");

    // Checkout started -> reveals exclude-purchasers toggle (default on).
    await selectSegment(app, "CHECKOUT_STARTED");
    const excludePurchasers = app.locator(
      'input[name="behaviorCheckoutStartedExcludePurchasers"]',
    );
    await expect(excludePurchasers).toBeVisible();
    await expect(excludePurchasers).toBeChecked();

    // Saw campaign -> reveals its own per-segment campaign id list.
    await selectSegment(app, "SAW_CAMPAIGN");
    await app
      .locator('textarea[name="behaviorSawCampaignIds"]')
      .fill("ref-campaign-1");

    // High intent -> reveals event count + window.
    await selectSegment(app, "HIGH_INTENT");
    await app.locator('input[name="behaviorHighIntentMinEvents"]').fill("4");
    await app
      .locator('input[name="behaviorHighIntentWindowMinutes"]')
      .fill("45");

    // New visitor has no sub-options -> selecting it must not render a panel.
    await selectSegment(app, "NEW_VISITOR");
    await expect(
      app.locator('[name^="behaviorNewVisitor"]'),
    ).toHaveCount(0);

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/app/campaigns/${campaign.id}`) &&
          response.request().method() === "POST",
      ),
      saveBehaviorTargeting(app),
    ]);

    await expect(app.getByText("Behavior targeting saved.")).toBeVisible({
      timeout: 15_000,
    });

    const targeting = await prisma.campaignTargeting.findFirst({
      where: { campaignId: campaign.id },
      select: { behaviorRules: true },
    });
    const rules = normalizeBehaviorTargetingRules(targeting?.behaviorRules);

    expect(rules.enabled).toBe(true);
    expect(new Set(rules.segments)).toEqual(
      new Set([
        "RETURNING_VISITOR",
        "ADDED_TO_CART_NO_CHECKOUT",
        "CHECKOUT_STARTED",
        "SAW_CAMPAIGN",
        "HIGH_INTENT",
        "NEW_VISITOR",
      ]),
    );
    expect(rules.returningMinPriorSessions).toBe(2);
    expect(rules.returningMinDaysSinceFirstSeen).toBe(7);
    expect(rules.addedToCartDelayMinutes).toBe(30);
    expect(rules.checkoutStartedExcludePurchasers).toBe(true);
    expect(rules.sawCampaignIds).toContain("ref-campaign-1");
    expect(rules.highIntentMinEvents).toBe(4);
    expect(rules.highIntentWindowMinutes).toBe(45);

    await expectNoConsoleErrors(page);
  });

  test("keeps the purchaser-exclusion default when CHECKOUT_STARTED is not selected", async ({
    page,
  }) => {
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );

    await pauseAllPrefixedCampaigns(page);
    const campaign = await createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline("Behavior default"),
      name: uniqueName("Behavior Default"),
      placement: PlacementType.TOP_BAR,
    });

    await openCampaignEditor(page, campaign.name);
    const app = await openTargetingTab(page);
    await skipIfBehaviorLocked(app);

    await app.locator('input[name="behaviorEnabled"]').check();
    await selectSegment(app, "NEW_VISITOR");

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/app/campaigns/${campaign.id}`) &&
          response.request().method() === "POST",
      ),
      saveBehaviorTargeting(app),
    ]);

    const targeting = await prisma.campaignTargeting.findFirst({
      where: { campaignId: campaign.id },
      select: { behaviorRules: true },
    });
    const rules = normalizeBehaviorTargetingRules(targeting?.behaviorRules);

    // The checkbox never rendered, yet the persisted value must stay the
    // default (true) rather than be clobbered to false.
    expect(rules.checkoutStartedExcludePurchasers).toBe(true);
    expect(rules.segments).toEqual(["NEW_VISITOR"]);
  });
});

async function saveBehaviorTargeting(app: AppScope) {
  // "Save behavior targeting" is unique to the behavior form's submit button.
  await app
    .getByRole("button", { name: "Save behavior targeting" })
    .first()
    .click();
  // useConfirmSubmit renders a confirmation dialog before the form posts.
  const confirm = app
    .getByRole("dialog")
    .getByRole("button", { name: "Save behavior targeting" });

  if (await confirm.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await confirm.click();
  }
}
