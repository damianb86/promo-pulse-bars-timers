import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

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

  await page.getByLabel("Campaign name").fill("E2E CRUD Campaign Updated");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Update campaign" }).click(),
  ]);
  await page.waitForURL("/app/campaigns");

  let row = page.getByRole("row", { name: /E2E CRUD Campaign Updated/ });
  await expect(row).toContainText("Draft");

  await row.getByRole("button", { name: "Activate" }).click();
  row = page.getByRole("row", { name: /E2E CRUD Campaign Updated/ });
  await expect(row).toContainText("Active");

  await row.getByRole("button", { name: "Pause" }).click();
  row = page.getByRole("row", { name: /E2E CRUD Campaign Updated/ });
  await expect(row).toContainText("Paused");

  await row.getByRole("button", { name: "Duplicate" }).click();
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
    form.getByRole("radio", { exact: true, name: "Flash sale" }),
  ).toHaveAttribute("aria-checked", "true");
  await form.getByRole("radio", { exact: true, name: "Free shipping" }).click();
  await expect(
    form.getByRole("radio", { exact: true, name: "Free shipping" }),
  ).toHaveAttribute("aria-checked", "true");

  await form.getByRole("tab", { name: "Message" }).click();
  await form
    .locator('input[name="headline"]')
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
  await form.getByRole("button", { name: /Product page/ }).click();
  await expect(form.getByLabel("Primary placement")).toHaveValue(
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
  await timezoneSelect.selectOption("UTC");
  await expect(timezoneSelect).toHaveValue("UTC");

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
  await page.waitForURL(/\/app\/campaigns\/[^/]+$/);
  await expect(page.getByRole("tab", { name: "Campaign" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "A/B testing" }).click();
  await expect(
    page.getByRole("heading", { name: "Experiments" }),
  ).toBeVisible();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
