import {
  confirmAction,
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("help page sends contact requests and handles privacy actions", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("countdown");
  await loginAsDemoShop("/app/help");

  await expect(
    page.getByRole("heading", { exact: true, name: "Help and Contact" }),
  ).toBeVisible();
  await expect(page.getByText("demo-shop.myshopify.com")).toBeVisible();
  await expect(page.getByText("support@example.com")).toBeVisible();

  await page.getByRole("link", { name: "Contact support" }).click();
  await page.getByLabel("Message").fill("The cart timer is missing.");
  await page.getByLabel("Subject").fill("Cart timer missing");
  await page.getByLabel("Reply email").fill("merchant@example.com");

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/help") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Send message" }).click(),
  ]);
  await expect(page.getByText("Message sent.")).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/help") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Request data summary" }).click(),
  ]);
  await expect(page.getByText("Data summary sent to our team.")).toBeVisible();

  await page.getByRole("button", { name: "Delete all shop data" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/help") &&
        response.request().method() === "POST",
    ),
    confirmAction(page, "Delete permanently"),
  ]);
  await expect(
    page.getByText(
      "All Promo Pulse data for this shop has been permanently deleted.",
    ),
  ).toBeVisible();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
