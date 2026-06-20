import {
  confirmAction,
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  selectTimezone,
  test,
} from "./fixtures";

test("shop settings can be saved and persist after reload", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb();
  await loginAsDemoShop("/app/settings");

  await page.getByLabel("Default locale").selectOption("es");
  await selectTimezone(
    page,
    "Default timezone",
    "UTC-03",
    "America/Argentina/Cordoba",
  );
  await page.getByLabel("Default currency").fill("ars");
  await page.getByLabel("Default country").fill("ar");
  await page.getByLabel("Brand name").fill("Promo Pulse E2E");
  await page.getByLabel("Support email").fill("support@example.com");
  await page
    .getByLabel("Cart drawer selector")
    .fill("#CartDrawer .drawer__contents");
  await page.getByLabel("Debug mode").check();
  await page.getByLabel("Consent mode").selectOption("STRICT");

  await page.getByRole("button", { name: "Save settings" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/settings") &&
        response.request().method() === "POST",
    ),
    confirmAction(page, "Save settings"),
  ]);

  await expect(page.getByText("Settings saved.")).toBeVisible();
  await page.reload();

  await expect(page.getByLabel("Default locale")).toHaveValue("es");
  await expect(page.locator('input[name="defaultTimezone"]')).toHaveValue(
    "America/Argentina/Cordoba",
  );
  await expect(page.getByLabel("Default currency")).toHaveValue("ARS");
  await expect(page.getByLabel("Default country")).toHaveValue("AR");
  await expect(page.getByLabel("Brand name")).toHaveValue("Promo Pulse E2E");
  await expect(page.getByLabel("Support email")).toHaveValue(
    "support@example.com",
  );
  await expect(page.getByLabel("Cart drawer selector")).toHaveValue(
    "#CartDrawer .drawer__contents",
  );
  await expect(page.getByLabel("Debug mode")).toBeChecked();
  await expect(page.getByLabel("Consent mode")).toHaveValue("STRICT");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("billing page shows plan cards and local billing placeholder", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb();
  await loginAsDemoShop("/app/billing");

  await expect(
    page.getByRole("heading", { exact: true, name: "Billing" }),
  ).toBeVisible();
  await expect(page.getByText("Current: Agency")).toBeVisible();
  await expect(page.getByText("Free", { exact: true })).toBeVisible();
  await expect(page.getByText("Starter", { exact: true })).toBeVisible();
  await expect(page.getByText("Growth", { exact: true })).toBeVisible();
  await expect(page.getByText("Pro", { exact: true })).toBeVisible();
  await expect(page.getByText("Premium", { exact: true })).toBeVisible();
  await expect(
    page.locator(".counterpulse-plan-card__name").filter({ hasText: "Agency" }),
  ).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/billing") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Select" }).first().click(),
  ]);

  await expect(
    page.getByText(/Shopify Billing creation is not connected/),
  ).toBeVisible();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
