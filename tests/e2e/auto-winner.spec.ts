import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  publishCurrentCampaign,
  test,
} from "./fixtures";

test("experiment results can auto-detect and apply a winning variant", async ({
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("auto-winner");
  await loginAsDemoShop("/app/campaigns");
  await page.getByRole("link", { name: "E2E Auto Winner Campaign" }).click();
  await page.getByRole("tab", { name: "Experiments" }).click();

  await expect(page.getByText("Experiment Results")).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Traffic split" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Treatment 50\.0% 100 40 40\.0%/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Control 50\.0% 100 10 10\.0%/ }),
  ).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Auto declare winner" }).click(),
  ]);
  const completedExperiment = page
    .locator(".counterpulse-experiment-history-card")
    .filter({ hasText: "E2E Auto Winner Test" });
  await expect(
    completedExperiment.getByText("Treatment won on CTR."),
  ).toBeVisible();
  await expect(
    completedExperiment.getByRole("button", { name: "Apply winner" }),
  ).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    completedExperiment.getByRole("button", { name: "Apply winner" }).click(),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Campaign" }).click();
  await page.getByRole("tab", { name: "Message" }).click();

  const campaignForm = page.locator("#campaign-basics-form");
  const messagePanel = campaignForm.getByRole("tabpanel", { name: "Message" });

  await expect(
    messagePanel.getByRole("textbox", { name: "Headline", exact: true }),
  ).toHaveValue("Winning headline");
  await expect(
    messagePanel.getByRole("textbox", { name: "Subheadline", exact: true }),
  ).toHaveValue("Winning treatment copy.");
  await page.getByRole("tab", { name: "Offers" }).click();
  await expect(page.getByLabel("Existing discount code or ID")).toHaveValue(
    "CONTROL10",
  );

  await publishCurrentCampaign(page);
  const publishedAuditResponse = await page.request.get(
    "/__test/stage2?resource=experiments-and-offers",
  );
  const publishedAudit = (await publishedAuditResponse.json()) as {
    campaigns: Array<{
      publishedSnapshot: {
        translations: Array<{ locale: string; headline: string | null }>;
      } | null;
    }>;
  };
  expect(
    publishedAudit.campaigns[0].publishedSnapshot?.translations.find(
      (translation) => translation.locale === "en",
    )?.headline,
  ).toBe("Winning headline");
  await page.goto(
    "/__test/storefront?visitorId=winner-fresh-visitor&sessionId=winner-fresh-session",
  );
  const storefrontSurface = page.locator(".pp-bar").first();
  await expect(storefrontSurface).toContainText("Winning headline");
  await expect(storefrontSurface).toContainText("Winning treatment copy.");

  const auditResponse = await page.request.get(
    "/__test/stage2?resource=experiments-and-offers",
  );
  expect(auditResponse.ok()).toBe(true);
  const audit = (await auditResponse.json()) as {
    campaigns: Array<{
      experiments: Array<{
        status: string;
        winnerAppliedAt: string | null;
        winnerVariantId: string | null;
      }>;
    }>;
  };
  expect(audit.campaigns[0].experiments[0]).toMatchObject({
    status: "COMPLETED",
    winnerVariantId: "e2e-auto-winner-treatment",
  });
  expect(audit.campaigns[0].experiments[0].winnerAppliedAt).toBeTruthy();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
