import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  publishCurrentCampaign,
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
  await page.getByRole("tab", { name: "Experiments" }).click();
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
  await createExperimentForm
    .getByRole("button", { name: "Edit Variant B" })
    .click();
  await createExperimentForm
    .getByRole("textbox", { name: /^Headline / })
    .fill("Variant headline");
  await createExperimentForm
    .getByLabel("Subheadline")
    .fill("A/B treatment copy.");
  await createExperimentForm.getByLabel("CTA text").fill("Shop variant");

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
  const savedExperiment = page
    .locator(".counterpulse-experiment-shell")
    .filter({ hasText: "E2E A/B Experiment" });
  await expect(
    savedExperiment.getByRole("heading", { name: "E2E A/B Experiment" }),
  ).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/app/campaigns/${campaignId}`) &&
        response.request().method() === "POST",
    ),
    savedExperiment.getByRole("button", { name: "Start" }).click(),
  ]);
  await expect(savedExperiment.getByText("Running")).toBeVisible();
  await publishCurrentCampaign(page);

  await page.goto(
    "/__test/storefront?visitorId=stage2-experiment-treatment-visitor&sessionId=stage2-experiment-session",
  );
  const bar = page.locator(".pp-bar").first();
  await expect(bar).toContainText("Variant headline");
  await expect(bar).toContainText("A/B treatment copy.");
  await expect(bar.locator(".pp-code")).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".pp-bar").first()).toContainText(
    "Variant headline",
  );
  await expect
    .poll(async () => readAnalyticsSummary(page))
    .toMatchObject({ attributedVariants: 1 });

  await loginAsDemoShop(`/app/campaigns/${campaignId}`);
  await page.getByRole("tab", { name: "Experiments" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/app/campaigns/${campaignId}`) &&
        response.request().method() === "POST",
    ),
    savedExperiment.getByRole("button", { name: "Pause" }).click(),
  ]);
  await expect(savedExperiment.getByText("Paused")).toBeVisible();
  await publishCurrentCampaign(page);

  await page.goto(
    "/__test/storefront?visitorId=stage2-experiment-treatment-visitor&sessionId=stage2-experiment-session",
  );
  await expect(page.locator(".pp-bar").first()).toContainText(
    "Experiment base headline",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
