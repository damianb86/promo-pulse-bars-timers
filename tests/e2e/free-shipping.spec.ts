import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("cart free shipping goal updates progress and success message", async ({
  page,
  resetDb,
}) => {
  await resetDb("free-shipping");
  await page.goto("/__test/storefront-cart?subtotal=40");

  await expect(page.locator(".pp-cart-card").first()).toContainText(
    "You're $60.00 away from free shipping",
  );
  await expect(page.getByRole("progressbar").first()).toHaveAttribute(
    "aria-valuenow",
    "40",
  );

  await page.goto("/__test/storefront-cart?subtotal=120");
  await expect(page.locator(".pp-cart-card").first()).toContainText(
    "You've unlocked free shipping!",
  );
  await expect(page.getByRole("progressbar").first()).toHaveAttribute(
    "aria-valuenow",
    "100",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
