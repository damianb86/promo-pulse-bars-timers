import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";
import { readAnalyticsSummary } from "./stage2-helpers";

test("campaign experiments assign stable variants and can be paused", async ({
  createCampaignViaUI,
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("premium");
  await loginAsDemoShop();
  const campaignId = await createCampaignViaUI({
    name: "E2E Stage 2 Experiment",
    status: "ACTIVE",
    headline: "Experiment base headline",
    subheadline: "Base campaign copy.",
  });

  await page.goto(`/app/campaigns/${campaignId}`);
  const createExperimentForm = page.locator(
    'form:has(input[name="_action"][value="createExperiment"])',
  );
  await createExperimentForm
    .getByLabel("Experiment name")
    .fill("E2E A/B Experiment");
  await createExperimentForm
    .getByLabel("Primary metric")
    .selectOption("CLICK_RATE");
  await createExperimentForm.getByLabel("Variant 1 weight").fill("1");
  await createExperimentForm.getByLabel("Variant 2 weight").fill("100");
  await createExperimentForm.getByLabel("Variant 2 text override JSON").fill(
    JSON.stringify({
      headline: "Variant headline",
      subheadline: "A/B treatment copy.",
      ctaText: "Shop variant",
    }),
  );
  await createExperimentForm
    .getByLabel("Variant 2 discount override JSON")
    .fill(JSON.stringify({ discountCode: "VARIANT20" }));

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/app/campaigns/${campaignId}`) &&
        response.request().method() === "POST",
    ),
    createExperimentForm
      .getByRole("button", { name: "Create experiment" })
      .click(),
  ]);
  await expect(
    page.getByRole("row", { name: /E2E A\/B Experiment/ }),
  ).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/app/campaigns/${campaignId}`) &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Start" }).click(),
  ]);
  await expect(
    page.getByRole("row", { name: /E2E A\/B Experiment Running/ }),
  ).toBeVisible();

  await page.goto(
    "/__test/storefront?visitorId=stage2-experiment-treatment-visitor&sessionId=stage2-experiment-session",
  );
  const bar = page.locator(".pp-bar").first();
  await expect(bar).toContainText("Variant headline");
  await expect(bar).toContainText("A/B treatment copy.");
  await expect(bar.locator(".pp-code")).toHaveText("VARIANT20");

  await page.reload();
  await expect(page.locator(".pp-bar").first()).toContainText(
    "Variant headline",
  );
  await expect
    .poll(async () => readAnalyticsSummary(page))
    .toMatchObject({ attributedVariants: 1 });

  await loginAsDemoShop(`/app/campaigns/${campaignId}`);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/app/campaigns/${campaignId}`) &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Pause" }).click(),
  ]);
  await expect(
    page.getByRole("row", { name: /E2E A\/B Experiment Paused/ }),
  ).toBeVisible();

  await page.goto(
    "/__test/storefront?visitorId=stage2-experiment-treatment-visitor&sessionId=stage2-experiment-session",
  );
  await expect(page.locator(".pp-bar").first()).toContainText(
    "Experiment base headline",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
