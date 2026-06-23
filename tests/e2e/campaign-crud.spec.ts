import {
  confirmAction,
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  selectCampaignTypeCard,
  selectOnlyCampaignPlacement,
  selectTimezone,
  test,
} from "./fixtures";

test("campaigns page owns the create campaign action", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb();
  await loginAsDemoShop("/app/campaigns");

  const createButton = page.getByTestId("campaign-create-button");
  await expect(createButton).toBeVisible();
  await expect(createButton).toHaveAttribute("href", "/app/campaigns/new");
  await expect(page.getByRole("link", { name: "Create campaign" })).toHaveCount(
    1,
  );

  await createButton.click();
  await page.waitForURL("/app/campaigns/new");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("campaign CRUD actions work from the admin UI", async ({
  page,
  resetDb,
  loginAsDemoShop,
  createCampaignViaUI,
}) => {
  await resetDb();
  await loginAsDemoShop("/app");

  await createCampaignViaUI({
    name: "E2E CRUD Campaign",
    status: "DRAFT",
  });

  await page
    .locator("#campaign-basics-form")
    .getByTestId("campaign-name-input")
    .fill("E2E CRUD Campaign Updated");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.locator("ui-save-bar").getByRole("button", { name: "Save" }).click(),
  ]);
  await page.goto("/app/campaigns");

  let row = page.getByRole("row", { name: /E2E CRUD Campaign Updated/ });
  await expect(row).toContainText("Draft");

  await row.getByRole("button", { name: "Activate" }).click();
  await confirmAction(page, "Activate campaign");
  row = page.getByRole("row", { name: /E2E CRUD Campaign Updated/ });
  await expect(row).toContainText("Active");

  await row.getByRole("button", { name: "Pause" }).click();
  await confirmAction(page, "Pause campaign");
  row = page.getByRole("row", { name: /E2E CRUD Campaign Updated/ });
  await expect(row).toContainText("Paused");

  await row.getByRole("button", { name: "Duplicate" }).click();
  await confirmAction(page, "Duplicate campaign");
  await expect(
    page.getByRole("row", { name: /E2E CRUD Campaign Updated copy/ }),
  ).toBeVisible();

  await page
    .getByRole("row", { name: /E2E CRUD Campaign Updated copy/ })
    .getByRole("button", { name: "Delete" })
    .click();
  const confirmDialog = page.getByRole("dialog", { name: "Delete campaign?" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Delete campaign" }).click();
  await expect(
    page.getByRole("row", { name: /E2E CRUD Campaign Updated copy/ }),
  ).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("campaign builder tabs preview and layout are interactive", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb();
  await loginAsDemoShop("/app/campaigns/new");

  const form = page.locator("[data-campaign-form]");
  const preview = form.getByLabel("Live campaign preview");

  await expect(form.getByRole("tab", { name: "Setup" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    form.locator(".counterpulse-campaign-type-current"),
  ).toContainText("Flash sale");

  await form.getByTitle("About Campaign type").click();
  let infoDialog = page.getByRole("dialog", { name: "Campaign types" });
  await expect(infoDialog).toContainText("Flash sale");
  await expect(infoDialog).toContainText("Free shipping");
  await infoDialog.getByRole("button", { name: "Close" }).click();

  await selectCampaignTypeCard(form, "Free shipping");
  await expect(
    form.locator(".counterpulse-campaign-type-current"),
  ).toContainText("Free shipping");

  await form.getByRole("tab", { name: "Message" }).click();
  await form
    .getByRole("tabpanel", { name: "Message" })
    .getByRole("textbox", { name: "Headline", exact: true })
    .fill("Interactive preview headline");
  await expect(preview).toContainText("Interactive preview headline");

  await form.getByRole("button", { name: "Mobile" }).click();
  await expect(form.getByRole("button", { name: "Mobile" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await form.getByRole("button", { name: "Desktop" }).click();
  await expect(form.getByRole("button", { name: "Desktop" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const previewBox = await preview.boundingBox();
  const formPanelBox = await form
    .locator(".counterpulse-create-panel")
    .boundingBox();
  expect(previewBox).not.toBeNull();
  expect(formPanelBox).not.toBeNull();
  expect(previewBox!.x).toBeGreaterThan(formPanelBox!.x + formPanelBox!.width);

  await form.getByRole("tab", { name: "Placement" }).click();
  await expect(form.getByRole("tab", { name: "Placement" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Storefront placement" }),
  ).toBeVisible();
  await selectOnlyCampaignPlacement(form, "PRODUCT_PAGE");
  await expect(form.locator('input[name="placementType"]')).toHaveValue(
    "PRODUCT_PAGE",
  );
  await expect(preview).toContainText("Product page");

  await form.getByRole("tab", { name: "Schedule" }).click();
  await expect(form.getByRole("tab", { name: "Schedule" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const timezoneSelect = form.getByRole("combobox", { name: "Timezone" });
  await expect(timezoneSelect).not.toHaveValue("");
  await selectTimezone(form, "Timezone", "UTC+00", "UTC");
  await expect(form.locator('input[name="timezone"]')).toHaveValue("UTC");

  await form.getByRole("button", { name: "Review" }).click();
  await expect(form.getByRole("tab", { name: "Review" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Review before saving" }),
  ).toBeVisible();

  await page.goto("/app/campaigns/new");
  await expect(page.getByRole("tab", { name: "Campaign" })).not.toBeVisible();

  await page.goto("/app/campaigns/new");
  await form.getByLabel("Campaign name").fill("E2E Editor Tabs");
  await form.getByRole("button", { name: "Save campaign" }).click();
  await confirmAction(page, "Save campaign");
  await page.waitForURL(/\/app\/campaigns\/[^/]+$/);
  await expect(page.getByRole("tab", { name: "Campaign" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Offers" }).click();
  await page.getByTitle("About Discount mode").click();
  infoDialog = page.getByRole("dialog", { name: "Discount modes" });
  await expect(infoDialog).toContainText("Create new discount");
  await expect(infoDialog).toContainText("Unique codes");
  await infoDialog.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("tab", { name: "Unique codes" })).toBeVisible();

  await page.getByRole("tab", { name: "Experiments" }).click();
  const experimentsPanel = page.locator("#campaign-editor-panel-experiments");
  await expect(
    experimentsPanel.getByRole("heading", { name: "Campaign experiments" }),
  ).toBeVisible();
  await experimentsPanel.getByTitle("About Primary metric").click();
  infoDialog = page.getByRole("dialog", {
    name: "Experiment primary metric",
  });
  await expect(infoDialog).toContainText("Revenue per visitor");
  await infoDialog.getByRole("button", { name: "Close" }).click();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("campaign type keeps announcement selected and exposes timer basics", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb();
  await loginAsDemoShop("/app/campaigns/new");

  const form = page.locator("[data-campaign-form]");

  await selectCampaignTypeCard(form, "Announcement");
  await expect(form.locator('input[name="goal"]')).toHaveValue("ANNOUNCEMENT");
  await expect(form.locator('input[name="type"]')).toHaveValue("COUNTDOWN_BAR");
  await expect(
    form.locator(".counterpulse-campaign-type-current"),
  ).toContainText("Announcement");
  await expect(
    form.locator(".counterpulse-campaign-type-current"),
  ).not.toContainText("Flash sale");

  const announcementTiming = form.locator(
    ".counterpulse-campaign-quick-setup-card",
  );
  await expect(
    announcementTiming.getByRole("heading", { name: "Announcement timing" }),
  ).toBeVisible();
  await expect(
    announcementTiming.getByRole("combobox", { name: "Timer type" }),
  ).toBeVisible();
  await expect(
    announcementTiming.getByRole("textbox", { name: "End date" }),
  ).toBeVisible();
  await expect(
    announcementTiming.getByRole("combobox", { name: "Once it ends" }),
  ).toBeVisible();

  await selectCampaignTypeCard(form, "Product timer");
  await expect(form.locator('input[name="goal"]')).toHaveValue("FLASH_SALE");
  await expect(form.locator('input[name="type"]')).toHaveValue("PRODUCT_TIMER");
  await expect(
    form
      .locator(".counterpulse-campaign-quick-setup-card")
      .getByRole("heading", { name: "Product timer basics" }),
  ).toBeVisible();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
