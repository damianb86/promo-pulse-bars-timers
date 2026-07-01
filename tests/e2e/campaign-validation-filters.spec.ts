import {
  confirmAction,
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("campaign creation shows server validation errors", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb();
  await loginAsDemoShop("/app/campaigns/new");

  await page.getByRole("combobox", { name: /^Status$/ }).selectOption("ACTIVE");
  await page.getByRole("tab", { name: "Message" }).click();
  await page.getByLabel("CTA URL").fill("ftp://example.com");

  await page.getByRole("tab", { name: "Design" }).click();
  const editor = page.locator(".counterpulse-design-section");
  await editor.getByRole("button", { name: "Layout options" }).click();
  await editor.getByRole("option", { name: /^Action left\b/ }).click();
  await editor.locator('input[name="titleFontSize"]').fill("31");
  await editor.getByLabel("Separate desktop and mobile design").check();
  await editor
    .locator(".counterpulse-design-editor__controls")
    .getByLabel("Preview device")
    .getByRole("button", { name: "Mobile" })
    .click();
  await editor.getByRole("button", { name: "Layout options" }).click();
  await editor.getByRole("option", { name: /^Mobile card\b/ }).click();

  await page.getByRole("button", { name: "Save campaign" }).click();
  await confirmAction(page, "Save campaign");

  await page.getByRole("tab", { name: "Campaign" }).click();
  await page.getByRole("tab", { name: "Setup" }).click();
  await expect(
    page.getByText("Campaign name is required.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Message" }).click();
  await expect(
    page.getByText("CTA URL must be a valid absolute URL or storefront path.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app\/campaigns\/new$/);

  await page.getByRole("tab", { name: "Design" }).click();
  const restoredEditor = page.locator(".counterpulse-design-section");
  await expect(restoredEditor.locator('input[name="layout"]')).toHaveValue(
    "CTA_LEFT",
  );
  await expect(
    restoredEditor.locator('input[name="titleFontSize"]'),
  ).toHaveValue("31");
  await expect(
    restoredEditor.getByLabel("Separate desktop and mobile design"),
  ).toBeChecked();
  await restoredEditor
    .locator(".counterpulse-design-editor__controls")
    .getByLabel("Preview device")
    .getByRole("button", { name: "Mobile" })
    .click();
  await expect(restoredEditor.locator('input[name="layout"]')).toHaveValue(
    "MOBILE_CARD",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("campaign list filters by search, status, and type", async ({
  page,
  resetDb,
  loginAsDemoShop,
  createCampaignViaUI,
}) => {
  await resetDb();
  await loginAsDemoShop("/app");

  await createCampaignViaUI({
    headline: "Countdown headline",
    name: "E2E Filter Countdown",
    status: "ACTIVE",
    type: "COUNTDOWN_BAR",
  });
  await createCampaignViaUI({
    goal: "Free shipping",
    headline: "Shipping headline",
    name: "E2E Filter Shipping",
    placement: "CART_PAGE",
    status: "DRAFT",
    type: "FREE_SHIPPING_GOAL",
  });

  await page.goto("/app/campaigns");
  await page.getByLabel("Search by name").fill("Shipping");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByRole("row", { name: /E2E Filter Shipping/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /E2E Filter Countdown/ }),
  ).toHaveCount(0);

  await page.getByLabel("Search by name").fill("");
  await page.getByRole("combobox", { name: /^Status$/ }).selectOption("ACTIVE");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByRole("row", { name: /E2E Filter Countdown/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /E2E Filter Shipping/ }),
  ).toHaveCount(0);

  await page.getByRole("combobox", { name: /^Status$/ }).selectOption("");
  await page.getByLabel("Type").selectOption("FREE_SHIPPING_GOAL");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByRole("row", { name: /E2E Filter Shipping/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /E2E Filter Countdown/ }),
  ).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("campaign list shows all placements with a hover summary", async ({
  page,
  resetDb,
  loginAsDemoShop,
  createCampaignViaUI,
}) => {
  await resetDb();
  await loginAsDemoShop("/app");

  await createCampaignViaUI({
    name: "E2E Placement Matrix",
    placements: ["TOP_BAR", "BOTTOM_BAR", "CART_PAGE"],
  });

  await page.goto("/app/campaigns");
  const row = page.getByRole("row", { name: /E2E Placement Matrix/ });

  await expect(row).toContainText("Top Bar");
  await expect(row).toContainText("Bottom Bar");
  await expect(row).toContainText("Cart Page");
  await expect(row).toContainText("No experiment");
  await expect(row).toContainText("No data yet");

  await row.locator(".counterpulse-placement-chips--has-popover").hover();
  await expect(row.getByRole("tooltip")).toContainText("3 placements");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("campaign list surfaces experiments and campaign performance", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("ab-test");
  await loginAsDemoShop("/app/campaigns");

  const experimentRow = page.getByRole("row", {
    name: /E2E Flash Sale Countdown/,
  });

  await expect(experimentRow).toContainText("Experiment running");
  await expect(experimentRow).toContainText("2 variants");

  await resetDb("reports");
  await loginAsDemoShop("/app/campaigns");

  const reportsRow = page.getByRole("row", {
    name: /E2E Reports US Campaign/,
  });

  await expect(reportsRow).toContainText("30");
  await expect(reportsRow).toContainText("impressions");
  await expect(reportsRow).toContainText("20% CTR");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
