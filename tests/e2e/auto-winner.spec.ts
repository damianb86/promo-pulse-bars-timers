import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
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
  await page.getByRole("tab", { name: "A/B testing" }).click();

  await expect(page.getByText("Experiment Results")).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Treatment 100 40 40\.0%/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Control 100 10 10\.0%/ }),
  ).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Auto declare winner" }).click(),
  ]);
  await expect(
    page.getByRole("cell", { name: "Treatment (winner)" }),
  ).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Apply winner" }).click(),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Campaign" }).click();
  await page.getByRole("tab", { name: "Message" }).click();

  await expect(page.locator('input[name="headline"]')).toHaveValue(
    "Winning headline",
  );
  await expect(page.locator('textarea[name="subheadline"]')).toHaveValue(
    "Winning treatment copy.",
  );
  await page.getByRole("tab", { name: "Offers" }).click();
  await expect(page.getByLabel("Existing discount code or ID")).toHaveValue(
    "WINNER20",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
