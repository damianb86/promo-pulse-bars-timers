import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("storefront embed renders countdown and records CTA click", async ({
  page,
  resetDb,
}) => {
  await resetDb("countdown");
  await page.goto("/__test/storefront");

  const bar = page.locator(".pp-bar").first();
  await expect(bar).toContainText("Sale ends soon");
  await expect(bar.locator(".pp-countdown")).toHaveText(/\d{2}:\d{2}:\d{2}/);

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
      return (await response.json()).clicks;
    })
    .toBeGreaterThanOrEqual(1);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
