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
  await expect(bar.locator(".pp-countdown")).toHaveAttribute(
    "data-value",
    /\d{2} Hrs \d{2} Mins \d{2} Secs/,
  );

  await page
    .locator(".counterpulse-preview-cta")
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

test("storefront embed renders from embedded campaign configs without API fetch", async ({
  page,
  resetDb,
}) => {
  await resetDb("countdown");
  const payloadResponse = await page.request.get(
    "/apps/promo-pulse?shop=demo-shop.myshopify.com&path=/__test/storefront&locale=en&device=desktop&placement=ALL_FRONT_DEFAULT_PLACEMENTS&country=US&currency=USD",
  );
  expect(payloadResponse.ok()).toBe(true);
  const embeddedPayload = await payloadResponse.json();
  const embeddedBundle = {
    __promoPulseBundle: true,
    __promoPulseDefaultDevice: "desktop",
    __promoPulseDefaultLocale: "en",
    context: { shop: "demo-shop.myshopify.com" },
    payloads: {
      "en:desktop": embeddedPayload,
    },
  };
  let storefrontApiRequests = 0;

  await page.addInitScript((payload) => {
    (
      window as typeof window & { PromoPulseCampaignConfigs?: unknown }
    ).PromoPulseCampaignConfigs = payload;
  }, embeddedBundle);
  await page.route("**/apps/promo-pulse**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" || !url.searchParams.has("placement")) {
      await route.continue();
      return;
    }

    storefrontApiRequests += 1;
    await route.fulfill({
      body: JSON.stringify({ error: "Storefront API should not be required." }),
      contentType: "application/json",
      status: 503,
    });
  });

  await page.goto("/__test/storefront");

  await expect(page.locator(".pp-bar").first()).toContainText("Sale ends soon");
  expect(storefrontApiRequests).toBe(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("storefront embed fails closed when campaign API fails", async ({
  page,
  resetDb,
}) => {
  await page.route("**/apps/promo-pulse**", async (route) => {
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

test("app proxy aliases return storefront campaigns", async ({
  page,
  resetDb,
}) => {
  await resetDb("countdown");

  for (const proxyPath of [
    "/apps/counter-pulse",
    "/apps/default-app-home/apps/counter-pulse",
  ]) {
    const response = await page.request.get(
      `${proxyPath}?shop=demo-shop.myshopify.com&placement=TOP_BAR&locale=en&country=US`,
    );

    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.campaigns).toHaveLength(1);
    expect(payload.campaigns[0].texts.headline).toBe("Sale ends soon");
  }
});
