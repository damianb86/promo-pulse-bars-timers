import {
  confirmAction,
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
  await page.getByRole("button", { name: "Button right" }).click();
  await page.getByRole("button", { name: "Dawn" }).click();
  await expect(page.locator('input[name="layout"]')).toHaveValue("CTA_RIGHT");
  await page.getByRole("button", { name: "Plain" }).click();
  await page.getByRole("button", { name: "Colon" }).click();
  await page.getByLabel("Show timer labels").uncheck();
  await page.locator('select[name="icon"]').selectOption("CUSTOM");
  await page.getByLabel("Upload custom icon").setInputFiles({
    name: "timer-icon.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>',
    ),
  });
  await page.locator('input[name="gradientStartColor"]').fill("#123456");
  await page.locator('input[name="titleFontSize"]').fill("30");
  await page.locator('input[name="borderRadius"]').fill("12");
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
    preview.locator(".counterpulse-preview-timer small"),
  ).toHaveCount(0);
  await expect(
    preview.locator(".counterpulse-preview-icon img"),
  ).toHaveAttribute("src", /^data:image\/svg\+xml/);
  await expect(preview).toHaveCSS(
    "background-image",
    /linear-gradient.*rgb\(18, 52, 86\)/,
  );
  await page.getByRole("button", { name: "Save design" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    confirmAction(page, "Save design"),
  ]);
  await page.reload();
  await page.getByRole("tab", { name: "Design" }).click();

  await expect(page.locator('input[name="gradientStartColor"]')).toHaveValue(
    "#123456",
  );
  await expect(page.locator('input[name="layout"]')).toHaveValue("CTA_RIGHT");
  await expect(page.locator('input[name="timerStyle"]')).toHaveValue("PLAIN");
  await expect(page.locator('input[name="timerFormat"]')).toHaveValue("COLON");
  await expect(page.getByLabel("Show timer labels")).not.toBeChecked();
  await expect(page.locator('select[name="icon"]')).toHaveValue("CUSTOM");
  await expect(page.locator('input[name="customIconUrl"]')).toHaveValue(
    /^data:image\/svg\+xml/,
  );
  await expect(page.locator('input[name="titleFontSize"]')).toHaveValue("30");
  await expect(page.locator('input[name="borderRadius"]')).toHaveValue("12");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
