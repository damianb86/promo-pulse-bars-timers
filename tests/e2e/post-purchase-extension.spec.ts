import { expect, test } from "./fixtures";

test("post-purchase endpoint returns eligible mock campaigns by surface", async ({
  page,
  resetDb,
}) => {
  await resetDb("post-purchase");

  const thankYouResponse = await page.request.get(
    "/api/post-purchase/campaign",
    {
      params: {
        shop: "demo-shop.myshopify.com",
        surface: "THANK_YOU_PAGE",
        appliedDiscountCodes: "SAVE20",
        currency: "USD",
        locale: "en-US",
        mode: "AUTO_ELIGIBLE",
        showTimer: "true",
      },
    },
  );
  const thankYouBody = await thankYouResponse.json();

  expect(thankYouResponse.ok()).toBe(true);
  expect(thankYouBody.campaign).toMatchObject({
    kind: "OFFER_USED_SUCCESSFULLY",
    tone: "success",
    discountCode: "SAVE20",
  });

  const orderStatusResponse = await page.request.get(
    "/api/post-purchase/campaign",
    {
      params: {
        shop: "demo-shop.myshopify.com",
        surface: "ORDER_STATUS_PAGE",
        currency: "USD",
        locale: "en-US",
        mode: "AUTO_ELIGIBLE",
        showTimer: "true",
      },
    },
  );
  const orderStatusBody = await orderStatusResponse.json();

  expect(orderStatusResponse.ok()).toBe(true);
  expect(orderStatusBody.campaign).toMatchObject({
    kind: "LIMITED_TIME_REORDER_DISCOUNT",
    tone: "info",
    discountCode: "REORDER10",
  });
});

test("post-purchase endpoint returns null when no campaign is eligible", async ({
  page,
  resetDb,
}) => {
  await resetDb("free-shipping");

  const response = await page.request.get("/api/post-purchase/campaign", {
    params: {
      shop: "demo-shop.myshopify.com",
      surface: "THANK_YOU_PAGE",
      mode: "AUTO_ELIGIBLE",
    },
  });
  const body = await response.json();

  expect(response.ok()).toBe(true);
  expect(body.campaign).toBeNull();
});

test("campaign editor can configure post-purchase placements", async ({
  page,
  resetDb,
  loginAsDemoShop,
  createCampaignViaUI,
}) => {
  await resetDb();
  await loginAsDemoShop("/app/campaigns");

  const campaignId = await createCampaignViaUI({
    name: "E2E Order Status Placement",
    placement: "ORDER_STATUS_PAGE",
    status: "DRAFT",
  });

  await page.goto(`/app/campaigns/${campaignId}`);
  await page.getByRole("tab", { exact: true, name: "Placement" }).click();
  await expect(page.getByLabel("Primary placement")).toHaveValue(
    "ORDER_STATUS_PAGE",
  );
});
