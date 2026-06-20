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
  await expect(bar.locator(".pp-countdown")).toHaveText(
    /\d{2} Hrs \d{2} Mins \d{2} Secs/,
  );

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

test("storefront embed does not record analytics when strict consent is denied", async ({
  page,
  resetDb,
}) => {
  await resetDb("countdown-consent-strict");
  await page.goto("/__test/storefront?consent=denied");

  await expect(page.locator(".pp-bar").first()).toContainText("Sale ends soon");
  await page.waitForTimeout(500);

  const response = await page.request.get("/__test/analytics-summary");
  expect((await response.json()).impressions).toBe(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("storefront embed handles unavailable browser storage", async ({
  page,
  resetDb,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("localStorage unavailable");
      },
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("sessionStorage unavailable");
      },
    });
  });

  await resetDb("countdown");
  await page.goto("/__test/storefront");

  await expect(page.locator(".pp-bar").first()).toContainText("Sale ends soon");
  await expect(page.locator(".pp-bar")).toHaveCount(1);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("storefront embed fails closed when campaign API fails", async ({
  page,
  resetDb,
}) => {
  await page.route("**/apps/counterpulse-campaigns**", async (route) => {
    await route.fulfill({
      body: "not-json",
      contentType: "application/json",
      status: 200,
    });
  });

  await resetDb("countdown");
  await page.goto("/__test/storefront");

  await expect(page.locator(".pp-bar")).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
