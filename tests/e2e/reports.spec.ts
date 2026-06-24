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
  await resetDb("reports");
  await loginAsDemoShop("/app/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByText("Reporting workspace")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Performance trend" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Performance by placement" }),
  ).toBeVisible();
  await expect(page.locator(".counterpulse-reports-metric__icon")).toHaveCount(
    10,
  );
  await expect(
    page.getByRole("row", { name: /US 30 6 20\.0%/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /ES 20 5 25\.0%/ }).first(),
  ).toBeVisible();

  await page
    .getByLabel("Campaign")
    .selectOption({ label: "E2E Reports ES Campaign" });
  await page.getByLabel("Country").fill("ES");
  await page.getByLabel("Market").selectOption("ES");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/country=ES/);
  await expect(page).toHaveURL(/market=ES/);
  await expect(
    page.getByRole("row", { name: /ES 20 5 25\.0%/ }).first(),
  ).toBeVisible();
  await expect(page.getByRole("row", { name: /US 30 6/ })).toHaveCount(0);

  const csvHref = await page
    .getByTestId("reports-export-csv")
    .getAttribute("data-export-href");
  expect(csvHref).toContain("/app/reports/csv");
  await expect(
    page
      .getByTestId("reports-export-csv")
      .locator("svg.counterpulse-reports-export__icon"),
  ).toBeVisible();

  const csvResponse = await page.request.get(csvHref!);
  expect(csvResponse.ok()).toBe(true);
  expect(csvResponse.headers()["content-type"]).toContain("text/csv");
  const csv = await csvResponse.text();
  expect(csv).toContain("Summary,All campaigns");
  expect(csv).toContain("Country,ES");
  expect(csv).toContain("Market,ES");
  expect(csv).not.toContain("Market,US");
  await expect(
    page.getByRole("link", { name: "View full report" }),
  ).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
