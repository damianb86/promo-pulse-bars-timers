import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("storefront assigns a stable experiment variant and tracks variant attribution", async ({
  page,
  resetDb,
}) => {
  await resetDb("ab-test");
  await page.addInitScript(() => {
    window.localStorage.setItem("promo_pulse_visitor_id", "cpv_e2e_variant");
  });
  await page.goto("/__test/storefront");

  const bar = page.locator(".pp-bar").first();
  await expect(bar).toContainText("Variant headline");
  await expect(bar).toContainText("A/B treatment copy.");
  await expect(bar.locator(".pp-code")).toHaveText("VARIANT20");

  await expect
    .poll(async () =>
      page.evaluate(() =>
        window.localStorage.getItem(
          "promo_pulse_experiment_assignment_e2e-experiment-headline",
        ),
      ),
    )
    .toBe("e2e-variant-treatment");

  await page.reload();
  await expect(page.locator(".pp-bar").first()).toContainText(
    "Variant headline",
  );

  await expect
    .poll(async () => {
      const response = await page.request.get("/__test/analytics-summary");
      return (await response.json()).attributedVariants;
    })
    .toBeGreaterThanOrEqual(1);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("storefront campaigns without experiments render unchanged", async ({
  page,
  resetDb,
}) => {
  await resetDb("countdown");
  await page.goto("/__test/storefront");

  await expect(page.locator(".pp-bar").first()).toContainText("Sale ends soon");

  const experimentAssignments = await page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) =>
      key.startsWith("promo_pulse_experiment_assignment_"),
    ),
  );

  expect(experimentAssignments).toEqual([]);
  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
