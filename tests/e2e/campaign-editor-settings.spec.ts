import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
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
  await page.getByRole("tab", { name: "Merchandising" }).click();
  const form = page.locator(
    'form:has(input[name="_action"][value="saveFreeShippingSettings"])',
  );

  await form.getByLabel("Threshold amount").fill("150");
  await form.getByLabel("Currency code").fill("eur");
  await form.getByLabel("Progress style").selectOption("COMPACT");
  await form
    .getByLabel("Empty cart fallback message")
    .fill("Add items for free EU shipping");
  await form
    .getByLabel("Success fallback message")
    .fill("EU free shipping unlocked");
  await form.getByLabel("Country/market threshold JSON").fill('{"DE":150}');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    form.getByRole("button", { name: "Save free shipping settings" }).click(),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Merchandising" }).click();

  await expect(form.getByLabel("Threshold amount")).toHaveValue("150");
  await expect(form.getByLabel("Currency code")).toHaveValue("EUR");
  await expect(form.getByLabel("Progress style")).toHaveValue("COMPACT");
  await expect(form.getByLabel("Empty cart fallback message")).toHaveValue(
    "Add items for free EU shipping",
  );
  await expect(form.getByLabel("Success fallback message")).toHaveValue(
    "EU free shipping unlocked",
  );
  await expect
    .poll(async () =>
      JSON.parse(
        await form.getByLabel("Country/market threshold JSON").inputValue(),
      ),
    )
    .toEqual({ DE: 150 });

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
  await page.getByRole("tab", { name: "Merchandising" }).click();
  const form = page.locator(
    'form:has(input[name="_action"][value="saveDeliveryCutoffSettings"])',
  );

  await form.getByLabel("Cutoff hour").fill("16");
  await form.getByLabel("Cutoff minute").fill("30");
  await form.getByLabel("Timezone").fill("America/New_York");
  await form
    .getByLabel("After cutoff behavior")
    .selectOption("SHOW_AFTER_CUTOFF_MESSAGE");
  await form.getByLabel("Processing days").fill("2");
  await form.getByLabel("Minimum delivery days").fill("3");
  await form.getByLabel("Maximum delivery days").fill("6");
  await form.getByLabel("Working days JSON").fill("[1,2,3,4,5]");
  await form.getByLabel("Holidays JSON").fill('["2026-12-25"]');
  await form.getByLabel("Country rules JSON").fill('{"US":{"cutoffHour":15}}');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    form.getByRole("button", { name: "Save delivery cutoff settings" }).click(),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Merchandising" }).click();

  await expect(form.getByLabel("Cutoff hour")).toHaveValue("16");
  await expect(form.getByLabel("Cutoff minute")).toHaveValue("30");
  await expect(form.getByLabel("After cutoff behavior")).toHaveValue(
    "SHOW_AFTER_CUTOFF_MESSAGE",
  );
  await expect(form.getByLabel("Processing days")).toHaveValue("2");
  await expect(form.getByLabel("Minimum delivery days")).toHaveValue("3");
  await expect(form.getByLabel("Maximum delivery days")).toHaveValue("6");
  await expect
    .poll(async () =>
      JSON.parse(await form.getByLabel("Holidays JSON").inputValue()),
    )
    .toEqual(["2026-12-25"]);

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

  await page.getByRole("tab", { name: "Merchandising" }).click();
  const lowStockForm = page.locator(
    'form:has(input[name="_action"][value="saveLowStockSettings"])',
  );
  await lowStockForm.getByLabel("Inventory threshold").fill("7");
  await lowStockForm.getByLabel("Show exact quantity").check();
  await lowStockForm.getByLabel("Fallback message").fill("Low stock E2E");

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    lowStockForm
      .getByRole("button", { name: "Save low stock settings" })
      .click(),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Merchandising" }).click();

  await expect(lowStockForm.getByLabel("Inventory threshold")).toHaveValue("7");
  await expect(lowStockForm.getByLabel("Show exact quantity")).toBeChecked();
  await expect(lowStockForm.getByLabel("Fallback message")).toHaveValue(
    "Low stock E2E",
  );

  await page.getByRole("tab", { name: "Offers" }).click();
  const discountForm = page.locator(
    'form:has(input[name="_action"][value="saveDiscount"])',
  );
  await discountForm.getByLabel("Discount mode").selectOption("LINK_EXISTING");
  await discountForm.getByLabel("Existing discount code or ID").fill("SAVE10");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    discountForm.getByRole("button", { name: "Save discount" }).click(),
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

  await page.getByRole("tab", { name: "Merchandising" }).click();
  const badgeForm = page.locator(
    'form:has(input[name="_action"][value="saveBadgeSettings"])',
  );
  await badgeForm.getByLabel("Badge text").fill("New drop");
  await badgeForm.getByLabel("Badge shape").selectOption("SQUARE");
  await badgeForm.getByLabel("Badge position").selectOption("BOTTOM_LEFT");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    badgeForm.getByRole("button", { name: "Save badge settings" }).click(),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Merchandising" }).click();

  await expect(badgeForm.getByLabel("Badge text")).toHaveValue("New drop");
  await expect(badgeForm.getByLabel("Badge shape")).toHaveValue("SQUARE");
  await expect(badgeForm.getByLabel("Badge position")).toHaveValue(
    "BOTTOM_LEFT",
  );

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
  const discountForm = page.locator(
    'form:has(input[name="_action"][value="saveDiscount"])',
  );

  await discountForm.getByLabel("Discount mode").selectOption("UNIQUE_CODES");
  await discountForm.getByLabel("New discount title").fill("VIP E2E discount");
  await discountForm.getByLabel("Discount type").selectOption("PERCENTAGE");
  await discountForm.getByLabel("Discount value").fill("18");
  await discountForm
    .locator('input[name="startsAt"]')
    .fill(toLocalDateTime(new Date(Date.now() - 60 * 60 * 1000)));
  await discountForm
    .locator('input[name="endsAt"]')
    .fill(toLocalDateTime(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  await discountForm.getByLabel("Unique code prefix").fill("VIP");
  await discountForm.getByLabel("Unique code expiration minutes").fill("30");
  await discountForm.getByLabel("Limit created discount").check();
  await discountForm.getByLabel("Auto-apply unique visitor codes").check();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    discountForm.getByRole("button", { name: "Save discount" }).click(),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Offers" }).click();

  await expect(discountForm.getByLabel("Discount mode")).toHaveValue(
    "UNIQUE_CODES",
  );
  await expect(discountForm.getByLabel("New discount title")).toHaveValue(
    "VIP E2E discount",
  );
  await expect(discountForm.getByLabel("Unique code prefix")).toHaveValue(
    "VIP",
  );
  await expect(
    discountForm.getByLabel("Unique code expiration minutes"),
  ).toHaveValue("30");
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
  const form = page.locator(
    'form:has(input[name="_action"][value="saveAdvancedDiscountRule"])',
  );

  await expect(form.getByLabel("Rule title")).toBeVisible();
  await form.getByLabel("Rule title").fill("E2E Tiered Advanced");
  await form.getByLabel("Rule type").selectOption("TIERED_DISCOUNT");
  await form.getByLabel("Status").selectOption("ACTIVE");
  await form.getByLabel("Discount value (%)").fill("10");
  await form
    .getByLabel("Thresholds JSON")
    .fill('[{"minimumSubtotal":100,"discountValue":15}]');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    form.getByRole("button", { name: "Save advanced rule" }).click(),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Offers" }).click();

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
