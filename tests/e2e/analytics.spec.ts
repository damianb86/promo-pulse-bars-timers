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
    .locator(".pp-cta")
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

  await loginAsDemoShop("/app/analytics");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByText("Campaign performance")).toBeVisible();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
