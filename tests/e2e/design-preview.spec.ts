import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("design changes update live preview and persist", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("countdown");
  await loginAsDemoShop("/app/campaigns");

  await page.getByRole("link", { name: "E2E Flash Sale Countdown" }).click();
  await page.getByRole("tab", { name: "Design" }).click();
  const editor = page.getByRole("tabpanel", { name: "Design" });

  await page.getByRole("button", { name: "Button right" }).click();
  await page.getByRole("button", { name: "Dawn" }).click();
  await expect(editor.locator('input[name="layout"]')).toHaveValue("CTA_RIGHT");
  await page.getByRole("button", { name: "Plain" }).click();
  await page.getByRole("button", { name: "Colon" }).click();
  await page.getByLabel("Show timer labels").uncheck();
  await editor.locator('select[name="icon"]').selectOption("FIRE");
  await editor.locator('input[name="gradientStartColor"]').fill("#123456");
  await editor.locator('input[name="closeButtonColor"]').fill("#00FF88");
  await editor.locator('input[name="titleFontSize"]').fill("30");
  await editor.locator('input[name="borderRadius"]').fill("12");
  await editor
    .locator('select[name="entranceAnimation"]')
    .selectOption("SLIDE");
  await editor.locator('select[name="exitAnimation"]').selectOption("POP");
  await editor.locator('input[name="animationDurationMs"]').fill("480");
  await editor
    .locator('select[name="timerTickAnimation"]')
    .selectOption("PULSE");
  await page
    .getByLabel("Preview device")
    .getByRole("button", { name: "Mobile" })
    .click();

  const preview = page
    .locator(".counterpulse-design-editor__preview .counterpulse-preview-promo")
    .first();
  await expect(preview).toContainText("Sale ends soon");
  await expect(preview).toHaveClass(
    /counterpulse-preview-promo--layout-cta_right/,
  );
  await expect(
    preview.locator(".counterpulse-preview-timer--colon"),
  ).toHaveText(/\d{2}:\d{2}:\d{2}/);
  await expect(
    preview.locator(".counterpulse-preview-timer--tick-pulse"),
  ).toBeVisible();
  await expect(
    preview.locator(".counterpulse-preview-timer small"),
  ).toHaveCount(0);
  await expect(preview.locator(".counterpulse-preview-icon svg")).toBeVisible();
  await expect(preview.locator(".counterpulse-preview-close")).toHaveCSS(
    "color",
    "rgb(0, 255, 136)",
  );
  await expect(preview).toHaveCSS(
    "background-image",
    /linear-gradient.*rgb\(18, 52, 86\)/,
  );
  await expect(preview).toHaveClass(/counterpulse-preview-promo--enter-slide/);
  await expect(preview).toHaveClass(/counterpulse-preview-promo--exit-pop/);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.locator("ui-save-bar").getByRole("button", { name: "Save" }).click(),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Design" }).click();
  const reloadedEditor = page.getByRole("tabpanel", { name: "Design" });

  await expect(
    reloadedEditor.locator('input[name="gradientStartColor"]'),
  ).toHaveValue("#123456");
  await expect(
    reloadedEditor.locator('input[name="closeButtonColor"]'),
  ).toHaveValue("#00FF88");
  await expect(reloadedEditor.locator('input[name="layout"]')).toHaveValue(
    "CTA_RIGHT",
  );
  await expect(reloadedEditor.locator('input[name="timerStyle"]')).toHaveValue(
    "PLAIN",
  );
  await expect(reloadedEditor.locator('input[name="timerFormat"]')).toHaveValue(
    "COLON",
  );
  await expect(page.getByLabel("Show timer labels")).not.toBeChecked();
  await expect(reloadedEditor.locator('select[name="icon"]')).toHaveValue(
    "FIRE",
  );
  await expect(
    reloadedEditor.locator('input[name="titleFontSize"]'),
  ).toHaveValue("30");
  await expect(
    reloadedEditor.locator('input[name="borderRadius"]'),
  ).toHaveValue("12");
  await expect(
    reloadedEditor.locator('select[name="entranceAnimation"]'),
  ).toHaveValue("SLIDE");
  await expect(
    reloadedEditor.locator('select[name="exitAnimation"]'),
  ).toHaveValue("POP");
  await expect(
    reloadedEditor.locator('input[name="animationDurationMs"]'),
  ).toHaveValue("480");
  await expect(
    reloadedEditor.locator('select[name="timerTickAnimation"]'),
  ).toHaveValue("PULSE");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("top and bottom bar placement defaults to full width without rounded corners", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("countdown");
  await loginAsDemoShop("/app/campaigns");

  await page.getByRole("link", { name: "E2E Flash Sale Countdown" }).click();
  await page.getByRole("tab", { name: "Design" }).click();
  const editor = page.getByRole("tabpanel", { name: "Design" });
  await editor.locator('input[name="borderRadius"]').fill("14");

  await page.getByRole("tab", { name: "Campaign" }).click();
  await page.getByRole("tab", { name: "Placement" }).click();
  await page.getByRole("button", { name: /^Bottom bar\b/ }).click();
  await page.getByRole("tab", { name: "Design" }).click();

  const updatedEditor = page.getByRole("tabpanel", { name: "Design" });
  await expect(updatedEditor.locator('input[name="borderRadius"]')).toHaveValue(
    "0",
  );
  await expect(updatedEditor.locator('input[name="fullWidth"]')).toBeChecked();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
