import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("storefront events are saved and visible in analytics admin", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("analytics");
  await page.goto("/__test/storefront");
  await expect(page.locator(".pp-bar").first()).toContainText("Sale ends soon");

  await page
    .locator(".pp-cta:not(.pp-cta--offer)")
    .first()
    .evaluate((element) => {
      element.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      });
      (element as HTMLElement).click();
    });
  await page.getByRole("button", { name: "SAVE20" }).click();

  await expect
    .poll(async () => {
      const response = await page.request.get("/__test/analytics-summary");
      return response.json();
    })
    .toMatchObject({
      impressions: 1,
      clicks: 1,
      copyCode: 1,
    });

  await page.waitForTimeout(500);
  await loginAsDemoShop("/app/analytics");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByText("Performance workspace")).toBeVisible();
  await expect(
    page.getByText("Track performance and engagement across your promotions."),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Campaign performance" }),
  ).toBeVisible();
  await expect(page.locator(".counterpulse-analytics-date-button")).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: /Daily/i })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Performance over time" }),
  ).toBeVisible();

  for (const metric of ["Impressions", "Clicks", "CTR"]) {
    await page.locator(`[data-info-label="${metric}"]`).click();
    const dialog = page.getByRole("dialog", { name: metric });

    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(metric);
    await dialog.getByRole("button", { name: "Close" }).click();
  }

  await page.getByRole("link", { name: "30 days" }).click();
  await expect(page).toHaveURL(/range=30/);
  await expect(page.getByRole("link", { name: "30 days" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();

  await page.getByRole("link", { name: "90 days" }).click();
  await expect(page).toHaveURL(/range=90/);
  await expect(page.getByRole("link", { name: "90 days" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const exportButton = page.getByTestId("analytics-export-csv");
  const exportHref = await exportButton.getAttribute("data-export-href");

  expect(exportHref).toBe("/app/analytics/csv?range=90");
  await expect(
    exportButton.locator("svg.counterpulse-analytics-export__icon"),
  ).toBeVisible();
  const csvResponse = await page.request.get(exportHref!);

  expect(csvResponse.ok()).toBe(true);
  expect(csvResponse.headers()["content-type"]).toContain("text/csv");
  const csv = await csvResponse.text();

  expect(csv).toContain("Summary,90 days");
  expect(csv).toContain("Campaign");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
