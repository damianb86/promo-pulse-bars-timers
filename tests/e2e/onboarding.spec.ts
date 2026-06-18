import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("merchant can complete guided onboarding and see the campaign", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb();
  await loginAsDemoShop("/app");

  await page.getByRole("link", { name: "Start guided setup" }).click();
  await page.getByRole("button", { name: "Start setup" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Flash Sale" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByRole("textbox", { exact: true, name: "Headline" })
    .fill("E2E onboarding sale");
  await page.getByLabel("CTA text").fill("Shop now");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Top bar" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("E2E onboarding sale")).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/onboarding") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Activate campaign" }).click({
      force: true,
    }),
  ]);
  await expect(page.getByText("Campaign activated")).toBeVisible();

  await page.goto("/app/campaigns");
  const campaignRow = page
    .getByRole("row", { name: /Flash Sale Countdown/ })
    .first();
  await expect(campaignRow).toBeVisible();
  await expect(campaignRow).toContainText("Active");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
