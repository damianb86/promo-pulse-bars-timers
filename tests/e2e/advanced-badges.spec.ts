import {
  expect,
  publishCurrentCampaign,
  saveCurrentCampaignDraft,
  test,
} from "./fixtures";

test("product badges are configured from campaign setup and evaluated for storefront products", async ({
  createCampaignViaUI,
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("empty");
  await loginAsDemoShop();

  const campaignId = await createCampaignViaUI({
    goal: "Product badge",
    headline: "Badge campaign",
    name: "E2E Advanced Badge",
    placement: "COLLECTION_CARD",
    status: "ACTIVE",
    type: "PRODUCT_BADGE",
  });

  await page.goto(`/app/campaigns/${campaignId}`);
  await expect(
    page.getByRole("tab", { name: "Conversion modules" }),
  ).toHaveCount(0);
  const form = page.locator("#campaign-basics-form");
  const badgeRegion = form.getByRole("region", { name: "Product badge" });

  await badgeRegion.getByLabel("Badge text").fill("Simple badge");
  await badgeRegion.getByLabel("Shape").selectOption("SQUARE");
  await badgeRegion.getByLabel("Position").selectOption("BOTTOM_LEFT");
  await saveCurrentCampaignDraft(page);
  await page.waitForURL(`/app/campaigns/${campaignId}`);
  await publishCurrentCampaign(page);

  await expect(badgeRegion.getByLabel("Badge text")).toHaveValue(
    "Simple badge",
  );
  await expect(badgeRegion.getByLabel("Shape")).toHaveValue("SQUARE");
  await expect(badgeRegion.getByLabel("Position")).toHaveValue("BOTTOM_LEFT");

  const response = await page.request.get("/api/storefront/badges", {
    params: {
      shop: "demo-shop.myshopify.com",
      placement: "COLLECTION_CARD",
      productId: "gid://shopify/Product/e2e-simple-badge",
      productTags: "vip,summer",
      inventoryQuantity: "3",
      locale: "en",
    },
  });
  const body = await response.json();

  expect(response.ok()).toBe(true);
  expect(body.badges).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        campaignId,
        text: "Simple badge",
        badge: expect.objectContaining({
          badgePosition: "BOTTOM_LEFT",
          badgeShape: "SQUARE",
          badgeText: "Simple badge",
        }),
      }),
    ]),
  );

  const batchResponse = await page.request.get("/api/storefront/badges", {
    params: {
      shop: "demo-shop.myshopify.com",
      placement: "COLLECTION_CARD",
      locale: "en",
      badgeContexts: JSON.stringify([
        {
          key: "card-1",
          productId: "gid://shopify/Product/e2e-simple-badge",
          productTags: ["vip", "summer"],
          inventoryQuantity: "3",
        },
        {
          key: "card-2",
          productId: "gid://shopify/Product/e2e-other",
          productTags: ["other"],
          inventoryQuantity: "12",
        },
      ]),
    },
  });
  const batchBody = await batchResponse.json();

  expect(batchResponse.ok()).toBe(true);
  expect(batchBody.badgeGroups).toEqual([
    expect.objectContaining({
      key: "card-1",
      badges: expect.arrayContaining([
        expect.objectContaining({
          campaignId,
          text: "Simple badge",
        }),
      ]),
    }),
    expect.objectContaining({
      key: "card-2",
      badges: expect.arrayContaining([
        expect.objectContaining({
          campaignId,
          text: "Simple badge",
        }),
      ]),
    }),
  ]);
});
