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
