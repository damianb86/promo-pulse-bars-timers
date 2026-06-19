import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("advanced reports load filtered campaign data and export CSV", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("analytics");
  await page.goto("/__test/storefront");
  await expect(page.locator(".pp-bar").first()).toContainText("Sale ends soon");

  await page
    .locator(".pp-cta")
    .first()
    .evaluate((element) => {
      element.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      });
      (element as HTMLElement).click();
    });

  await expect
    .poll(async () => {
      const response = await page.request.get("/__test/analytics-summary");
      return response.json();
    })
    .toMatchObject({
      impressions: 1,
      clicks: 1,
    });

  await loginAsDemoShop("/app/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByText("Revenue overview")).toBeVisible();
  await expect(page.getByText("Performance by placement")).toBeVisible();
  await expect(page.getByRole("row", { name: /Top Bar 1 1/ })).toBeVisible();

  await page.getByLabel("Country").fill("US");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/country=US/);

  const csvHref = await page
    .getByRole("link", { name: "Export CSV" })
    .getAttribute("href");
  expect(csvHref).toContain("/app/reports/csv");

  const csvResponse = await page.request.get(csvHref!);
  expect(csvResponse.ok()).toBe(true);
  expect(csvResponse.headers()["content-type"]).toContain("text/csv");
  const csv = await csvResponse.text();
  expect(csv).toContain("Summary,All campaigns");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
