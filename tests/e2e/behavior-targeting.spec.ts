import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("behavior targeting hides a new-visitor campaign after the first touch", async ({
  page,
  resetDb,
}) => {
  await resetDb("behavior-targeting");
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "counterpulse_visitor_id",
      "cpv_e2e_behavior",
    );
    window.sessionStorage.setItem(
      "counterpulse_session_id",
      "cps_e2e_behavior",
    );
  });

  await page.goto("/__test/storefront");
  await expect(page.locator(".pp-bar").first()).toContainText(
    "New visitor offer",
  );

  await expect
    .poll(async () => {
      const response = await page.request.get("/__test/analytics-summary");
      return (await response.json()).impressions;
    })
    .toBeGreaterThanOrEqual(1);

  await page.reload();
  await expect(page.locator(".pp-bar")).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
