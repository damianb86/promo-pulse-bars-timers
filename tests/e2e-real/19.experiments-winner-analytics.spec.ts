import {
  ExperimentPrimaryMetric,
  ExperimentStatus,
  ExperimentVariantStatus,
  PlacementType,
} from "@prisma/client";

import prisma from "../../app/db.server";
import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import {
  clickCampaignBuilderTab,
  clickCampaignEditorTab,
  openCampaignEditor,
  pauseAllPrefixedCampaigns,
  publishCampaignDraft,
} from "./helpers/admin-app";
import { getAppFrameOrPage, openPromoPulseApp } from "./helpers/auth";
import {
  seedActionableRecommendation,
  seedAnalyticsForCampaign,
} from "./helpers/analytics-fixtures";
import {
  createPublishedPlacementCampaign,
  findRealE2EShopId,
  placementHeadline,
} from "./helpers/placement-fixtures";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";
import {
  expectCampaignPayload,
  fetchStorefrontCampaigns,
} from "./helpers/storefront-api";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";

test.describe("real experiments, winner application, analytics, reports, and recommendations", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test.afterEach(async ({ page }) => {
    await pauseAllPrefixedCampaigns(page);
  });

  test("serves experiment variants, applies a manual winner, and reflects seeded metrics", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );

    const baseHeadline = placementHeadline("Experiment base headline");
    const winningHeadline = placementHeadline("Experiment winning headline");
    const campaign = await createPublishedPlacementCampaign(shopId, {
      experiment: {
        name: uniqueName("Winner Experiment"),
        primaryMetric: ExperimentPrimaryMetric.CLICK_RATE,
        status: ExperimentStatus.RUNNING,
        variants: [
          {
            name: "Control copy",
            status: ExperimentVariantStatus.ACTIVE,
            textOverride: {},
            weight: 50,
          },
          {
            name: "Winning treatment",
            status: ExperimentVariantStatus.ACTIVE,
            textOverride: {
              headline: winningHeadline,
              subheadline: "Winning treatment copy.",
              ctaText: "Shop winning offer",
            },
            weight: 50,
          },
        ],
      },
      headline: baseHeadline,
      name: uniqueName("Experiment Winner Base"),
      placement: PlacementType.TOP_BAR,
      subheadline: "Base copy before winner application.",
    });
    const experiment = await prisma.experiment.findFirstOrThrow({
      where: {
        campaignId: campaign.id,
        shopId,
      },
      include: {
        variants: true,
      },
    });
    const controlVariant = experiment.variants.find(
      (variant) => variant.name === "Control copy",
    );
    const winningVariant = experiment.variants.find(
      (variant) => variant.name === "Winning treatment",
    );
    expect(controlVariant).toBeTruthy();
    expect(winningVariant).toBeTruthy();

    await seedAnalyticsForCampaign({
      campaignId: campaign.id,
      clickCount: 2,
      experimentId: experiment.id,
      impressionCount: 90,
      orderCount: 0,
      placement: PlacementType.TOP_BAR,
      shopId,
      variantId: controlVariant!.id,
    });
    await seedAnalyticsForCampaign({
      campaignId: campaign.id,
      clickCount: 34,
      experimentId: experiment.id,
      impressionCount: 90,
      orderCount: 3,
      placement: PlacementType.TOP_BAR,
      revenueAmount: 155,
      shopId,
      variantId: winningVariant!.id,
    });
    await seedActionableRecommendation({
      campaignId: campaign.id,
      campaignName: campaign.name,
      shopId,
    });

    await openStorefront(page, realE2ECacheBustPath("experiment_payload"));
    await expectStorefrontEmbedOrSkip(page, testInfo);
    const visitorId = findVisitorForVariant(
      experiment.id,
      winningVariant!.id,
      experiment.variants,
    );
    const payload = await fetchStorefrontCampaigns(page, {
      campaignId: campaign.id,
      placement: "TOP_BAR",
      visitorId,
    });
    const campaignPayload = expectCampaignPayload(payload.body, campaign.id);
    expect(campaignPayload).not.toHaveProperty("experiment");
    expect(campaignPayload).toMatchObject({
      experimentId: experiment.id,
      variantId: winningVariant!.id,
      texts: {
        headline: winningHeadline,
        subheadline: "Winning treatment copy.",
        ctaText: "Shop winning offer",
      },
    });
    await page.addInitScript((nextVisitorId) => {
      window.localStorage.setItem("promo_pulse_visitor_id", nextVisitorId);
      window.sessionStorage.setItem(
        "promo_pulse_session_id",
        `${nextVisitorId}-session`,
      );
    }, visitorId);
    await openStorefront(page, realE2ECacheBustPath("experiment_variant"));
    await expect(
      page
        .locator('[data-testid="promo-bar"], .pp-bar')
        .filter({ hasText: winningHeadline })
        .first(),
    ).toBeVisible({ timeout: 30_000 });

    await openCampaignEditor(page, campaign.name);
    let app = await getAppFrameOrPage(page);
    if (
      await app
        .getByText(/experiments are locked/i)
        .isVisible()
        .catch(() => false)
    ) {
      testInfo.skip(
        true,
        "Experiments require a plan that enables AB testing.",
      );
    }

    await clickCampaignEditorTab(app, "experiments");
    const winningRow = app
      .getByRole("row", { name: /Winning treatment/ })
      .first();
    await expect(winningRow).toBeVisible({ timeout: 30_000 });
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/app/campaigns/") &&
          response.request().method() === "POST",
      ),
      winningRow.getByRole("button", { name: /set winner/i }).click(),
    ]);

    app = await getAppFrameOrPage(page);
    await clickCampaignEditorTab(app, "experiments");
    await expect(
      app.getByRole("row", { name: /Winning treatment.*Winner/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/app/campaigns/") &&
          response.request().method() === "POST",
      ),
      app.getByRole("button", { name: /apply winner/i }).click(),
    ]);

    app = await getAppFrameOrPage(page);
    await clickCampaignEditorTab(app, "campaign");
    await clickCampaignBuilderTab(app, "message");
    const messagePanel = app.getByRole("tabpanel", { name: "Message" });
    await expect(
      messagePanel.getByRole("textbox", { name: "Headline", exact: true }),
    ).toHaveValue(winningHeadline);
    await expect(
      messagePanel.getByRole("textbox", { name: "Subheadline", exact: true }),
    ).toHaveValue("Winning treatment copy.");
    await publishCampaignDraft(page);

    await openStorefront(
      page,
      realE2ECacheBustPath("experiment_winner_applied"),
    );
    await expect(
      page
        .locator('[data-testid="promo-bar"], .pp-bar')
        .filter({ hasText: winningHeadline })
        .first(),
    ).toBeVisible({ timeout: 30_000 });

    await openPromoPulseApp(page, "/app/analytics");
    app = await getAppFrameOrPage(page);
    await expect(app.getByTestId("analytics-dashboard")).toContainText(
      /impressions|clicks|revenue/i,
      { timeout: 60_000 },
    );

    await openPromoPulseApp(page, "/app/reports");
    app = await getAppFrameOrPage(page);
    if (
      await app
        .getByText(/advanced reporting is locked/i)
        .isVisible()
        .catch(() => false)
    ) {
      testInfo.skip(
        true,
        "Reports require a plan that enables advanced reporting.",
      );
    }
    await app.getByLabel("Campaign").selectOption(campaign.id);
    await app.getByLabel("Placement").selectOption("TOP_BAR");
    await app.getByRole("button", { name: "Apply" }).click();
    await expect(
      app.getByRole("heading", { name: "Performance by experiment variant" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(app.getByText("Winning treatment").first()).toBeVisible({
      timeout: 30_000,
    });

    await openPromoPulseApp(page, "/app/recommendations");
    app = await getAppFrameOrPage(page);
    if (
      await app
        .getByText(/recommendations are locked/i)
        .isVisible()
        .catch(() => false)
    ) {
      testInfo.skip(
        true,
        "Recommendations require a plan that enables recommendations.",
      );
    }
    const recommendation = app
      .locator(".counterpulse-recommendation")
      .filter({ hasText: campaign.name })
      .first();
    await expect(recommendation).toContainText(/A\/B test|low CTR/i, {
      timeout: 30_000,
    });

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});

function findVisitorForVariant(
  experimentId: string,
  variantId: string,
  variants: Array<{ id: string; weight: number }>,
) {
  for (let index = 0; index < 1_000; index += 1) {
    const visitorId = `real-e2e-experiment-visitor-${index}`;
    const selected = selectExperimentVariant(experimentId, visitorId, variants);
    if (selected?.id === variantId) return visitorId;
  }

  throw new Error("Could not find a visitor assigned to the target variant.");
}

function selectExperimentVariant(
  experimentId: string,
  visitorId: string,
  variants: Array<{ id: string; weight: number }>,
) {
  const assignableVariants = variants.filter(
    (variant) => Number(variant.weight) > 0,
  );
  const totalWeight = assignableVariants.reduce(
    (total, variant) => total + Math.max(0, Math.trunc(variant.weight)),
    0,
  );

  if (totalWeight <= 0) return null;

  const bucket =
    hashAssignmentBucket(`${experimentId}:${visitorId}`) % totalWeight;
  let cumulativeWeight = 0;

  for (const variant of assignableVariants) {
    cumulativeWeight += Math.max(0, Math.trunc(variant.weight));
    if (bucket < cumulativeWeight) return variant;
  }

  return assignableVariants[assignableVariants.length - 1] ?? null;
}

function hashAssignmentBucket(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
