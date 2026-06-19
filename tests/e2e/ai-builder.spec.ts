import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("mock AI builder generates a reviewed draft without auto-publishing", async ({
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("premium");
  await loginAsDemoShop("/app/campaigns/new");

  await page.getByLabel("Product or category").fill("trail running shoes");
  await page.getByLabel("Event or season").fill("Summer launch");
  await page.getByLabel("Country").fill("US");
  await page.getByLabel("Language").selectOption("es");
  await page.getByLabel("Brand tone").selectOption("urgent");
  await page.getByLabel("Real offer or discount").fill("20% off");
  await page.getByLabel("Target URL").fill("/collections/trail-running");
  await page.getByRole("button", { name: "Generate with AI" }).click();

  await expect(page.getByText("AI suggestion preview")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "AI suggestion preview" }),
  ).toBeVisible();
  await expect(
    page.getByText("20% off on trail running shoes").first(),
  ).toBeVisible();
  await expect(page.getByLabel("Campaign name")).toHaveValue("");
  await expect(page.locator('input[name="headline"]')).toHaveValue("");

  await page.getByRole("button", { name: "Apply suggestion" }).click();
  await expect(page.getByLabel("Campaign name")).toHaveValue(
    /Summer launch - trail running shoes/,
  );
  await expect(page.locator('input[name="headline"]')).toHaveValue(/20% off/);
  await expect(page.locator('select[name="status"]')).toHaveValue("DRAFT");

  await page.getByRole("button", { name: "Save campaign" }).click();
  await page.waitForURL(/\/app\/campaigns\/[^/]+$/);
  await expect(page.locator('select[name="status"]')).toHaveValue("DRAFT");
  await expect(page.getByText("AI suggested variants")).toBeVisible();
  await expect(
    page.getByRole("row", { name: /AI suggested variants/ }),
  ).toContainText("Draft");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
