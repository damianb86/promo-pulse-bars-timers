import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("agency dashboard shows assigned shops and copies a campaign as draft", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("agency");
  await loginAsDemoShop("/app/agency");

  await expect(
    page.getByRole("heading", { exact: true, name: "Agency" }),
  ).toBeVisible();
  await expect(page.getByLabel("Agency workspace")).toHaveValue(
    "E2E Promo Agency",
  );
  await expect(
    page.getByRole("link", { name: "demo-shop.myshopify.com" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "agency-second.myshopify.com" }),
  ).toBeVisible();
  await expect(page.getByText("agency-hidden.myshopify.com")).toHaveCount(0);
  await expect(page.getByText("$320.00")).toBeVisible();
  await expect(page.getByText("$540.00")).toBeVisible();

  await page.goto("/app/agency?shopId=e2e-agency-hidden-shop");
  await expect(page.getByText("Selected shop is not connected")).toBeVisible();
  await expect(page.getByText("E2E Hidden Shop Campaign")).toHaveCount(0);
  await expect(page.getByText("$999.00")).toHaveCount(0);

  await page
    .getByLabel("Current shop")
    .selectOption({ label: "agency-second.myshopify.com" });
  await page.getByRole("button", { name: "Switch shop" }).click();
  await expect(page).toHaveURL(/shopId=/);
  await expect(page.getByText("E2E Second Shop Campaign")).toBeVisible();

  const campaignRow = page
    .getByRole("row")
    .filter({ hasText: "E2E Second Shop Campaign" });
  await campaignRow.getByRole("button", { name: "Copy as draft" }).click();
  await expect(
    page.getByText("Campaign copied as a draft in the destination shop."),
  ).toBeVisible();

  await page.getByRole("link", { name: "Open draft" }).click();
  await page.waitForURL(/\/app\/campaigns\/[^/]+$/);
  await expect(page.getByLabel("Campaign name")).toHaveValue(
    "E2E Second Shop Campaign agency copy",
  );
  await expect(page.locator('select[name="status"]')).toHaveValue("DRAFT");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
