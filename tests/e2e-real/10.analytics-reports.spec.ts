import { test, expect } from "./helpers/fixtures";
import {
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import {
  createCampaignViaUI,
  pauseAllPrefixedCampaigns,
} from "./helpers/admin-app";
import { getAppFrameOrPage, openPromoPulseApp } from "./helpers/auth";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
} from "./helpers/storefront";

test.describe("real analytics and reports", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("records storefront engagement and exports report CSV", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);

    const campaignName = uniqueName("Analytics");
    const headline = `${campaignName} headline`;

    await createCampaignViaUI(page, {
      headline,
      name: campaignName,
      placement: "TOP_BAR",
      status: "ACTIVE",
      subheadline: "Analytics should record this storefront visit.",
      type: "COUNTDOWN_BAR",
    });

    await openStorefront(page);
    await expectStorefrontEmbedOrSkip(page, testInfo);
    const bar = page
      .locator('[data-testid="promo-bar"], .pp-bar')
      .filter({ hasText: headline })
      .first();
    await expect(bar).toBeVisible({ timeout: 30_000 });
    const cta = bar.locator(".pp-cta").first();
    if (await cta.isVisible().catch(() => false)) {
      await cta.click();
    }

    await openPromoPulseApp(page, "/app/analytics");
    const app = await getAppFrameOrPage(page);

    if (
      await app
        .getByText(/analytics are locked/i)
        .isVisible()
        .catch(() => false)
    ) {
      testInfo.skip(true, "Analytics require a plan that enables analytics.");
    }

    await expect(app.getByTestId("analytics-dashboard")).toContainText(
      /impressions|clicks/i,
      { timeout: 60_000 },
    );

    await openPromoPulseApp(page, "/app/reports");
    const reports = await getAppFrameOrPage(page);

    if (
      await reports
        .getByText(/advanced reporting is locked/i)
        .isVisible()
        .catch(() => false)
    ) {
      testInfo.skip(
        true,
        "Reports require a plan that enables advanced reporting.",
      );
    }

    const exportButton = reports.getByTestId("reports-export-csv");
    await expect(exportButton).toBeVisible();
    const csvHref = await exportButton.getAttribute("data-export-href");
    expect(csvHref).toBeTruthy();

    const reportsUrl = "url" in reports ? reports.url() : page.url();
    const csvUrl = new URL(csvHref ?? "", reportsUrl).toString();
    const csvResponse = await page.request.get(csvUrl, {
      headers: { Accept: "text/csv" },
    });

    expect(csvResponse.ok()).toBe(true);
    expect(csvResponse.headers()["content-type"]).toContain("text/csv");
    expect(await csvResponse.text()).toContain("Campaign");

    await exportButton.click();
    await expect(
      reports.getByText(/report export failed/i),
    ).toHaveCount(0);
    expect(campaignName).toContain("[PP-E2E]");
  });
});
