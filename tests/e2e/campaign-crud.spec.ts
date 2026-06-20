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

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("row", { name: /E2E CRUD Campaign Updated copy/ })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(
    page.getByRole("row", { name: /E2E CRUD Campaign Updated copy/ }),
  ).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("campaign builder tabs switches preview and layout are interactive", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb();
  await loginAsDemoShop("/app/campaigns/new");

  const form = page.locator("[data-campaign-form]");
  const preview = form.getByLabel("Campaign preview");
  const premiumControls = form.getByLabel("Premium features");

  await expect(form.getByRole("tab", { name: "Basics" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

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
  const premiumBox = await premiumControls.boundingBox();
  expect(previewBox).not.toBeNull();
  expect(premiumBox).not.toBeNull();
  expect(premiumBox!.y).toBeGreaterThan(previewBox!.y + previewBox!.height - 4);
  expect(Math.abs(premiumBox!.x - previewBox!.x)).toBeLessThan(2);
  expect(premiumBox!.width).toBeCloseTo(previewBox!.width, 0);

  await form.getByRole("tab", { name: "Placement" }).click();
  await expect(form.getByRole("tab", { name: "Placement" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Surface coverage" }),
  ).toBeVisible();
  await form.getByRole("button", { name: /Product page/ }).click();
  await expect(form.getByLabel("Primary placement")).toHaveValue(
    "PRODUCT_PAGE",
  );
  await expect(preview).toContainText("Product page");

  const uniqueCodesSwitch = form.getByRole("switch", {
    name: /Unique discount codes/,
  });
  await expect(uniqueCodesSwitch).toHaveAttribute("aria-checked", "false");
  await uniqueCodesSwitch.click();
  await expect(uniqueCodesSwitch).toHaveAttribute("aria-checked", "true");
  await expect(form.getByRole("tab", { name: "Discount" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Offer controls" }),
  ).toBeVisible();
  await expect(form.getByText("Selected")).toBeVisible();

  await form.getByRole("switch", { name: /A\/B testing/ }).click();
  await expect(form.getByRole("tab", { name: "Experiments" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "A/B testing" }),
  ).toBeVisible();

  await form.getByRole("button", { name: "Preview" }).click();
  await expect(form.getByRole("tab", { name: "Review" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Launch review" }),
  ).toBeVisible();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
