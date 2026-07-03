import { expect, test } from "./fixtures";

test("checkout campaign endpoint returns an eligible mock campaign", async ({
  page,
  resetDb,
}) => {
  await resetDb("free-shipping");

  const response = await page.request.get("/api/checkout/campaign", {
    params: {
      shop: "demo-shop.myshopify.com",
      cartSubtotal: "35",
      currency: "USD",
      locale: "en-US",
      mode: "AUTO_ELIGIBLE",
      showTimer: "true",
    },
  });
  const body = await response.json();

  expect(response.ok()).toBe(true);
  expect(body.campaign).toMatchObject({
    kind: "FREE_SHIPPING_REMINDER",
    tone: "info",
    progress: {
      currentAmount: 35,
      thresholdAmount: 100,
      remainingAmount: 65,
      percentComplete: 35,
      currencyCode: "USD",
    },
  });
});

test("checkout endpoint picks the highest-priority campaign when several are eligible", async ({
  page,
  resetDb,
}) => {
  // Sanity: with only discount countdowns seeded, the checkout surface serves
  // the discount expiration message...
  await resetDb("post-purchase");

  const discountOnly = await page.request.get("/api/checkout/campaign", {
    params: {
      shop: "demo-shop.myshopify.com",
      cartSubtotal: "35",
      currency: "USD",
      locale: "en-US",
      mode: "AUTO_ELIGIBLE",
      showTimer: "true",
    },
  });
  const discountOnlyBody = await discountOnly.json();

  expect(discountOnly.ok()).toBe(true);
  expect(discountOnlyBody.campaign).toMatchObject({
    kind: "DISCOUNT_CODE_EXPIRATION",
  });

  // ...but when a free shipping goal is also active, its reminder outranks the
  // discount message (FREE_SHIPPING_REMINDER has the highest kind priority).
  await resetDb("checkout-priority");

  const response = await page.request.get("/api/checkout/campaign", {
    params: {
      shop: "demo-shop.myshopify.com",
      cartSubtotal: "35",
      currency: "USD",
      locale: "en-US",
      mode: "AUTO_ELIGIBLE",
      showTimer: "true",
    },
  });
  const body = await response.json();

  expect(response.ok()).toBe(true);
  expect(body.campaign).toMatchObject({
    kind: "FREE_SHIPPING_REMINDER",
    tone: "info",
  });
});
