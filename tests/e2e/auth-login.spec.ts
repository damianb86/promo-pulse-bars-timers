import { expect, test } from "./fixtures";

test("login route shows reconnect state instead of a shop form", async ({
  page,
}) => {
  await page.goto("/auth/login");

  await expect(
    page.getByRole("heading", { name: "Connecting to Shopify" }),
  ).toBeVisible();
  await expect(page.getByText("Shop domain")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Log in" })).toHaveCount(0);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Connecting to Shopify" }),
  ).toBeVisible();
  await expect(page.getByText("Shop domain")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Log in" })).toHaveCount(0);
});
