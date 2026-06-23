import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("cart drawer support inserts one widget without duplicates", async ({
  page,
  resetDb,
}) => {
  let drawerAppProxyRequests = 0;
  let cartJsonRequests = 0;

  page.on("request", (request) => {
    const url = new URL(request.url());

    if (
      url.pathname === "/apps/promo-pulse" &&
      url.searchParams.get("placement") === "CART_DRAWER"
    ) {
      drawerAppProxyRequests += 1;
    }

    if (url.pathname === "/cart.js") {
      cartJsonRequests += 1;
    }
  });

  await resetDb("cart-drawer");
  await page.goto("/__test/storefront-cart?subtotal=50");

  await page.getByRole("button", { name: "Open cart drawer" }).click();
  await expect(page.locator(".pp-cart-card--drawer")).toHaveCount(1);
  await expect(
    page.locator(".pp-cart-card--drawer .pp-message-copy"),
  ).toContainText("Complete checkout before the timer ends.");
  await expect(
    page.locator(".pp-cart-card--drawer").locator(":scope > .pp-countdown"),
  ).toHaveCount(1);
  await expect(
    page.locator(".pp-cart-card--drawer .pp-message-copy > .pp-countdown"),
  ).toHaveCount(0);
  await expect(
    page.locator(".pp-cart-card--drawer .pp-countdown"),
  ).toHaveAttribute("data-value", /\d{2} Hrs \d{2} Mins \d{2} Secs/);

  drawerAppProxyRequests = 0;
  cartJsonRequests = 0;

  await page.getByRole("button", { name: "Open cart drawer" }).click();
  await page.getByRole("button", { name: "Open cart drawer" }).click();
  await expect(page.locator(".pp-cart-card--drawer")).toHaveCount(1);
  await expect(page.locator(".pp-cart-card--drawer")).toContainText(
    "Your cart is reserved",
  );
  await page.waitForTimeout(1200);
  expect(drawerAppProxyRequests).toBeLessThanOrEqual(3);
  expect(cartJsonRequests).toBeLessThanOrEqual(6);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("cart drawer pauses retries when Shopify returns password HTML", async ({
  page,
  resetDb,
}) => {
  let appProxyRequests = 0;

  await page.route("**/apps/promo-pulse**", async (route) => {
    appProxyRequests += 1;
    await route.fulfill({
      body: "<html>Password</html>",
      contentType: "text/html",
      status: 200,
    });
  });

  await resetDb("cart-drawer");
  await page.goto("/__test/storefront-cart?subtotal=50&badCart=1");
  await page.getByRole("button", { name: "Open cart drawer" }).click();
  await page.waitForTimeout(1600);

  const cartFetches = await page.evaluate(
    () =>
      (
        window as Window & {
          __promoPulseFetchCounts?: { cart?: number };
        }
      ).__promoPulseFetchCounts?.cart ?? 0,
  );

  expect(appProxyRequests).toBeLessThanOrEqual(5);
  expect(cartFetches).toBeLessThanOrEqual(3);
  await expect(page.locator(".pp-cart-card--drawer")).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
