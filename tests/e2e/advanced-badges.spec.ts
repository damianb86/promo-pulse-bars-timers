import { expect, test } from "./fixtures";

test("advanced badge rules can be created and evaluated for storefront products", async ({
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
  const simpleBadgeForm = page.locator(
    'form:has(input[name="_action"][value="saveBadgeSettings"])',
  );
  const advancedBadgeForm = page.locator(
    'form:has(input[name="_action"][value="saveAdvancedBadgeRule"])',
  );

  await simpleBadgeForm.getByLabel("Badge text").fill("Simple badge");
  await simpleBadgeForm
    .getByRole("button", { name: "Save badge settings" })
    .click();
  await page.waitForURL(`/app/campaigns/${campaignId}`);

  await advancedBadgeForm.getByLabel("Badge text").fill("VIP drop");
  await advancedBadgeForm.getByLabel("Priority").fill("25");
  await advancedBadgeForm.getByLabel("Product tags").fill("vip");
  await advancedBadgeForm.getByLabel("Inventory below").fill("5");
  await advancedBadgeForm
    .getByRole("button", { name: "Save badge rule" })
    .click();
  await page.waitForURL(`/app/campaigns/${campaignId}`);

  await expect(page.getByText("VIP drop")).toBeVisible();

  const response = await page.request.get("/api/storefront/badges", {
    params: {
      shop: "demo-shop.myshopify.com",
      placement: "COLLECTION_CARD",
      productId: "gid://shopify/Product/e2e-advanced-badge",
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
        ruleId: expect.any(String),
        text: "VIP drop",
      }),
    ]),
  );
});
