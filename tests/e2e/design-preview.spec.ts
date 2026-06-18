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
  await page.getByRole("button", { name: "Premium Dark" }).click();
  await page.locator('input[name="backgroundColor"]').fill("#123456");
  await page.locator('input[name="fontSize"]').fill("18");
  await page.locator('input[name="borderRadius"]').fill("12");
  await page.getByRole("button", { name: "Mobile" }).click();

  const preview = page.locator(".counterpulse-preview-promo").first();
  await expect(preview).toContainText("Sale ends soon");
  await expect(preview).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save design" }).click(),
  ]);
  await page.reload();

  await expect(page.locator('input[name="backgroundColor"]')).toHaveValue(
    "#123456",
  );
  await expect(page.locator('input[name="fontSize"]')).toHaveValue("18");
  await expect(page.locator('input[name="borderRadius"]')).toHaveValue("12");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
