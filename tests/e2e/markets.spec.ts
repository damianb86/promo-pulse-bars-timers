import {
  confirmAction,
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  publishCurrentCampaign,
  test,
} from "./fixtures";

test("advanced market rules override storefront free shipping thresholds by market", async ({
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("free-shipping");
  await loginAsDemoShop("/app/campaigns");

  await page.getByRole("link", { name: "E2E Free Shipping Goal" }).click();
  await page.getByRole("tab", { name: "Markets" }).click();

  const marketForm = page.locator(
    'form:has(input[name="_action"][value="saveMarketRule"])',
  );
  await marketForm
    .locator('select[name="marketRuleMarketId"]')
    .selectOption("ES");
  await marketForm.getByLabel("Country").fill("ES");
  await marketForm.getByLabel("Locale").fill("es");
  await marketForm.getByLabel("Currency").fill("EUR");
  await marketForm.getByLabel("Free shipping threshold").fill("95");

  await marketForm.getByRole("button", { name: "Save market rule" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    confirmAction(page, "Save market rule"),
  ]);

  await expect(page.getByText("country: ES")).toBeVisible();
  await publishCurrentCampaign(page);

  const esResponse = await page.request.get("/api/storefront/campaigns", {
    params: {
      shop: "demo-shop.myshopify.com",
      placement: "CART_PAGE",
      market: "ES",
      country: "ES",
      locale: "es",
      currency: "EUR",
      cartSubtotal: "20",
    },
  });
  const esPayload = await esResponse.json();

  expect(esResponse.ok()).toBe(true);
  expect(esPayload.campaigns).toHaveLength(1);
  expect(esPayload.campaigns[0].texts.headline).toBe("Free shipping");
  expect(esPayload.campaigns[0].freeShipping.thresholdAmount).toBe("95.00");
  expect(esPayload.campaigns[0].freeShipping.currencyCode).toBe("EUR");

  const usResponse = await page.request.get("/api/storefront/campaigns", {
    params: {
      shop: "demo-shop.myshopify.com",
      placement: "CART_PAGE",
      market: "US",
      country: "US",
      locale: "en",
      currency: "USD",
      cartSubtotal: "20",
    },
  });
  const usPayload = await usResponse.json();

  expect(usResponse.ok()).toBe(true);
  expect(usPayload.campaigns[0].texts.headline).toBe("Free shipping");
  expect(usPayload.campaigns[0].freeShipping.thresholdAmount).toBe("100.00");
  expect(usPayload.campaigns[0].freeShipping.currencyCode).toBe("USD");

  const fallbackResponse = await page.request.get("/api/storefront/campaigns", {
    params: {
      shop: "demo-shop.myshopify.com",
      placement: "CART_PAGE",
      locale: "en",
      cartSubtotal: "20",
    },
  });
  const fallbackPayload = await fallbackResponse.json();

  expect(fallbackResponse.ok()).toBe(true);
  expect(fallbackPayload.campaigns[0].freeShipping.thresholdAmount).toBe(
    "100.00",
  );

  await page.goto(
    "/__test/storefront-cart?subtotal=20&market=ES&country=ES&locale=es&currency=EUR",
  );
  await expect(page.locator(".pp-cart-card").first()).toContainText(
    "Free shipping",
  );

  await page.goto(
    "/__test/storefront-cart?subtotal=20&market=US&country=US&locale=en&currency=USD",
  );
  await expect(page.locator(".pp-cart-card").first()).toContainText(
    "Free shipping",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
