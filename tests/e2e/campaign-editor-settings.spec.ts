import {
  confirmAction,
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  saveCurrentCampaignDraft,
  selectTimezone,
  test,
} from "./fixtures";

test("free shipping settings persist from the campaign editor", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("free-shipping");
  await loginAsDemoShop("/app/campaigns");

  await page.getByRole("link", { name: "E2E Free Shipping Goal" }).click();
  await expect(
    page.getByRole("tab", { name: "Conversion modules" }),
  ).toHaveCount(0);
  const form = page.locator("#campaign-basics-form");

  await form.getByLabel("Threshold amount").fill("150");
  await form.getByLabel("Currency code").fill("eur");
  await form.getByLabel("Progress style").selectOption("COMPACT");
  await form
    .getByLabel("Empty cart message")
    .fill("Add items for free EU shipping");
  await form.getByLabel("Unlocked message").fill("EU free shipping unlocked");

  await saveCurrentCampaignDraft(page);
  await page.reload();

  await expect(form.getByLabel("Threshold amount")).toHaveValue("150");
  await expect(form.getByLabel("Currency code")).toHaveValue("EUR");
  await expect(form.getByLabel("Progress style")).toHaveValue("COMPACT");
  await expect(form.getByLabel("Empty cart message")).toHaveValue(
    "Add items for free EU shipping",
  );
  await expect(form.getByLabel("Unlocked message")).toHaveValue(
    "EU free shipping unlocked",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("delivery cutoff settings persist from the campaign editor", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("delivery-cutoff");
  await loginAsDemoShop("/app/campaigns");

  await page.getByRole("link", { name: "E2E Delivery Cutoff" }).click();
  await expect(
    page.getByRole("tab", { name: "Conversion modules" }),
  ).toHaveCount(0);
  const form = page.locator("#campaign-basics-form");

  await form.getByLabel("Cutoff hour").fill("16");
  await form.getByLabel("Cutoff minute").fill("30");
  await page.getByRole("tab", { name: "Schedule" }).click();
  await selectTimezone(form, "Timezone", "UTC-05", "America/New_York");
  await page.getByRole("tab", { name: "Setup" }).click();
  const deliveryRegion = form.getByRole("region", {
    name: "Delivery promise",
  });
  await deliveryRegion
    .getByLabel("After cutoff")
    .selectOption("SHOW_AFTER_CUTOFF_MESSAGE");
  await deliveryRegion.getByLabel("Processing days").fill("2");
  await deliveryRegion.getByLabel("Minimum delivery days").fill("3");
  await deliveryRegion.getByLabel("Maximum delivery days").fill("6");

  await saveCurrentCampaignDraft(page);
  await page.reload();

  await expect(deliveryRegion.getByLabel("Cutoff hour")).toHaveValue("16");
  await expect(deliveryRegion.getByLabel("Cutoff minute")).toHaveValue("30");
  await expect(deliveryRegion.getByLabel("After cutoff")).toHaveValue(
    "SHOW_AFTER_CUTOFF_MESSAGE",
  );
  await expect(deliveryRegion.getByLabel("Processing days")).toHaveValue("2");
  await expect(deliveryRegion.getByLabel("Minimum delivery days")).toHaveValue(
    "3",
  );
  await expect(deliveryRegion.getByLabel("Maximum delivery days")).toHaveValue(
    "6",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("URL page type targeting persists from the campaign editor", async ({
  page,
  resetDb,
  loginAsDemoShop,
  createCampaignViaUI,
}) => {
  await resetDb();
  await loginAsDemoShop("/app");

  await createCampaignViaUI({
    headline: "Page targeting",
    name: "E2E URL Page Targeting",
    placement: "TOP_BAR",
    status: "ACTIVE",
    type: "COUNTDOWN_BAR",
  });

  await page.getByRole("tab", { name: "Targeting" }).click();
  const form = page.locator("#campaign-targeting-form");
  const urlRegion = form.getByRole("region", { name: "URL eligibility" });
  const includeGroup = urlRegion.getByRole("group", {
    name: "Show only on page types",
  });
  const excludeGroup = urlRegion.getByRole("group", {
    name: "Exclude page types",
  });

  await includeGroup.getByLabel("Product pages").check();
  await includeGroup.getByLabel("Store pages").check();
  await excludeGroup.getByLabel("Cart page").check();
  await urlRegion
    .getByLabel("Show only on custom URLs containing")
    .fill("/products/special");
  await urlRegion
    .getByLabel("Exclude custom URLs containing")
    .fill("/pages/wholesale");

  await expect(form.locator('input[name="urlContains"]')).toHaveValue(
    "page:product\npage:page\n/products/special",
  );
  await expect(form.locator('input[name="excludedUrlContains"]')).toHaveValue(
    "page:cart\n/pages/wholesale",
  );

  await saveCurrentCampaignDraft(page);
  await page.reload();
  await page.getByRole("tab", { name: "Targeting" }).click();

  await expect(includeGroup.getByLabel("Product pages")).toBeChecked();
  await expect(includeGroup.getByLabel("Store pages")).toBeChecked();
  await expect(excludeGroup.getByLabel("Cart page")).toBeChecked();
  await expect(
    urlRegion.getByLabel("Show only on custom URLs containing"),
  ).toHaveValue("/products/special");
  await expect(
    urlRegion.getByLabel("Exclude custom URLs containing"),
  ).toHaveValue("/pages/wholesale");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("low stock, badge, and manual discount settings can be saved", async ({
  page,
  resetDb,
  loginAsDemoShop,
  createCampaignViaUI,
}) => {
  await resetDb();
  await loginAsDemoShop("/app");

  await createCampaignViaUI({
    goal: "Low stock urgency",
    headline: "Only a few left",
    name: "E2E Low Stock Settings",
    placement: "PRODUCT_PAGE",
    type: "LOW_STOCK",
  });

  await expect(
    page.getByRole("tab", { name: "Conversion modules" }),
  ).toHaveCount(0);
  const lowStockForm = page.locator("#campaign-basics-form");
  await lowStockForm.getByLabel("Inventory threshold").fill("7");
  await lowStockForm
    .getByLabel("Show exact quantity when Shopify provides it")
    .check();
  await lowStockForm.getByLabel("Fallback message").fill("Low stock E2E");

  await saveCurrentCampaignDraft(page);
  await page.reload();

  await expect(lowStockForm.getByLabel("Inventory threshold")).toHaveValue("7");
  await expect(
    lowStockForm.getByLabel("Show exact quantity when Shopify provides it"),
  ).toBeChecked();
  await expect(lowStockForm.getByLabel("Fallback message")).toHaveValue(
    "Low stock E2E",
  );

  await page.getByRole("tab", { name: "Offers" }).click();
  const discountForm = page.locator(
    'form:has(input[name="_action"][value="saveDiscount"])',
  );
  await discountForm.getByLabel("Discount mode").selectOption("LINK_EXISTING");
  await discountForm.getByLabel("Existing discount code or ID").fill("SAVE10");
  await discountForm.getByRole("button", { name: "Save discount" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    confirmAction(page, "Save discount"),
  ]);
  await expect(
    page.getByText(/manual discount reference was saved without date sync/i),
  ).toBeVisible();

  await page.goto("/app/campaigns");
  await createCampaignViaUI({
    goal: "Product badge",
    headline: "Limited offer",
    name: "E2E Badge Settings",
    placement: "COLLECTION_CARD",
    type: "PRODUCT_BADGE",
  });

  await expect(
    page.getByRole("tab", { name: "Conversion modules" }),
  ).toHaveCount(0);
  const badgeForm = page.locator("#campaign-basics-form");
  const badgeRegion = badgeForm.getByRole("region", { name: "Product badge" });
  await badgeRegion.getByLabel("Badge text").fill("New drop");
  await badgeRegion.getByLabel("Shape").selectOption("SQUARE");
  await badgeRegion.getByLabel("Position").selectOption("BOTTOM_LEFT");
  await saveCurrentCampaignDraft(page);
  await page.reload();

  await expect(badgeRegion.getByLabel("Badge text")).toHaveValue("New drop");
  await expect(badgeRegion.getByLabel("Shape")).toHaveValue("SQUARE");
  await expect(badgeRegion.getByLabel("Position")).toHaveValue("BOTTOM_LEFT");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("unique visitor discount settings issue reusable E2E codes", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("unique-discount");
  await loginAsDemoShop("/app/campaigns");

  await Promise.all([
    page.waitForURL((url) => {
      const segments = url.pathname.split("/").filter(Boolean);
      return (
        segments.length === 3 &&
        segments[0] === "app" &&
        segments[1] === "campaigns"
      );
    }),
    page.getByRole("link", { name: "E2E Unique Visitor Discount" }).click(),
  ]);
  await page.getByRole("tab", { name: "Offers" }).click();
  const campaignId = new URL(page.url()).pathname.split("/").pop() ?? "";
  await page.getByRole("tab", { name: "Unique codes" }).click();
  const uniqueCodesForm = page.locator(
    'form:has(input[name="_action"][value="generateUniqueCodes"])',
  );

  await uniqueCodesForm.getByLabel("Enable unique codes").check();
  await uniqueCodesForm.getByLabel("Discount title").fill("VIP E2E discount");
  await uniqueCodesForm.getByLabel("Discount type").selectOption("PERCENTAGE");
  await uniqueCodesForm.getByLabel("Discount value").fill("18");
  await uniqueCodesForm
    .locator('input[name="startsAt"]')
    .fill(toLocalDateTime(new Date(Date.now() - 60 * 60 * 1000)));
  await uniqueCodesForm
    .locator('input[name="endsAt"]')
    .fill(toLocalDateTime(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  await uniqueCodesForm.getByLabel("Prefix").fill("VIP");
  await uniqueCodesForm.getByLabel("Duration per visitor").fill("30");
  await uniqueCodesForm.getByLabel("Total codes to generate").fill("3");
  await uniqueCodesForm.getByLabel("Auto-apply visitor codes").check();

  await uniqueCodesForm.getByRole("button", { name: "Generate codes" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    confirmAction(page, "Generate codes"),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Offers" }).click();
  await page.getByRole("tab", { name: "Unique codes" }).click();

  await expect(uniqueCodesForm.getByLabel("Discount title")).toHaveValue(
    "VIP E2E discount",
  );
  await expect(uniqueCodesForm.getByLabel("Prefix")).toHaveValue("VIP");
  await expect(uniqueCodesForm.getByLabel("Duration per visitor")).toHaveValue(
    "30",
  );
  await expect(
    page.getByRole("columnheader", { name: "Total assigned" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Total used" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Total expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Conversion rate" }),
  ).toBeVisible();

  const firstResponse = await page.request.post("/api/discounts/unique-code", {
    data: {
      shop: "demo-shop.myshopify.com",
      campaignId,
      visitorId: "visitor-e2e-123",
      cartToken: "cart-e2e-123",
    },
  });
  const firstBody = await firstResponse.json();

  expect(firstResponse.status()).toBe(201);
  expect(firstBody).toMatchObject({
    ok: true,
    campaignId,
    autoApply: true,
    reused: false,
  });
  expect(firstBody.code).toMatch(/^VIP-[A-F0-9]{10}$/);
  expect(firstBody.autoApplyUrl).toBe(`/discount/${firstBody.code}`);

  const secondResponse = await page.request.post("/api/discounts/unique-code", {
    data: {
      shop: "demo-shop.myshopify.com",
      campaignId,
      visitorId: "visitor-e2e-123",
    },
  });
  const secondBody = await secondResponse.json();

  expect(secondResponse.status()).toBe(201);
  expect(secondBody).toMatchObject({
    code: firstBody.code,
    reused: true,
  });

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("advanced discount rules can be created from the campaign editor", async ({
  page,
  resetDb,
  loginAsDemoShop,
  createCampaignViaUI,
}) => {
  await resetDb();
  await loginAsDemoShop("/app");

  await createCampaignViaUI({
    headline: "Advanced deal",
    name: "E2E Advanced Discount Rule",
  });

  await page.getByRole("tab", { name: "Offers" }).click();
  await page.getByRole("tab", { name: "Advanced rules" }).click();
  const form = page.locator(
    'form:has(input[name="_action"][value="saveAdvancedDiscountRule"])',
  );

  await expect(form.getByLabel("Rule title")).toBeVisible();
  await form.getByLabel("Rule title").fill("E2E Tiered Advanced");
  await form.getByLabel("Rule type").selectOption("TIERED_DISCOUNT");
  await form.getByLabel("Status").selectOption("ACTIVE");
  await form.getByLabel("Discount value (%)").fill("10");
  await form.getByLabel("Tier 1 minimum subtotal").fill("100");
  await form.getByLabel("Tier 1 discount percent").fill("15");

  await form.getByRole("button", { name: "Save advanced rule" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    confirmAction(page, "Save advanced rule"),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Offers" }).click();
  await page.getByRole("tab", { name: "Advanced rules" }).click();

  await expect(
    page.getByRole("cell", { name: "E2E Tiered Advanced" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Tiered Discount" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "Active" })).toBeVisible();
  await expect(page.getByText(/e2e:\/\/advanced-discount\//)).toBeVisible();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

function toLocalDateTime(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  return localDate.toISOString().slice(0, 16);
}
