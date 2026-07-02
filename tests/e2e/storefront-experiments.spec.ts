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
  const payloadResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());

    return (
      url.pathname === "/apps/promo-pulse" &&
      url.searchParams.get("placement") === "ALL_FRONT_DEFAULT_PLACEMENTS"
    );
  });
  await page.goto("/__test/storefront");
  const payload = await (await payloadResponse).json();
  const campaignPayload = payload.campaigns?.[0];

  expect(campaignPayload).not.toHaveProperty("experiment");
  expect(campaignPayload).toMatchObject({
    experimentId: "e2e-experiment-headline",
    variantId: "e2e-variant-treatment",
    design: { backgroundColor: "#064E3B" },
    texts: {
      headline: "Variant headline",
      subheadline: "A/B treatment copy.",
    },
  });

  const bar = page.locator(".pp-bar").first();
  await expect(bar).toContainText("Variant headline");
  await expect(bar).toContainText("A/B treatment copy.");
  await expect(bar.locator(".pp-discount-code__value")).toHaveText("CONTROL10");
  await expect(
    bar.getByRole("button", { name: "Copy code CONTROL10" }),
  ).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate(() =>
        Object.keys(window.localStorage).filter((key) =>
          key.startsWith("promo_pulse_experiment_assignment_"),
        ),
      ),
    )
    .toEqual([]);

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
