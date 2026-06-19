import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("merchant can apply and dismiss recommendations", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("recommendations");
  await loginAsDemoShop("/app/recommendations");

  await expect(
    page.getByRole("heading", { exact: true, name: "Recommendations" }),
  ).toBeVisible();

  const abTestRecommendation = page
    .locator(".counterpulse-recommendation")
    .filter({ hasText: "Run an A/B test" })
    .first();
  await expect(abTestRecommendation).toBeVisible();
  await abTestRecommendation
    .getByRole("button", { name: "Create draft experiment" })
    .click();
  await expect(
    page.getByText("Draft experiment created from recommendation."),
  ).toBeVisible();

  const copyRecommendation = page
    .locator(".counterpulse-recommendation")
    .filter({ hasText: "Refresh copy" })
    .first();
  await expect(copyRecommendation).toBeVisible();
  await copyRecommendation.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("Recommendation dismissed.")).toBeVisible();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
