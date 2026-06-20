import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("AI Campaign Builder generates a reviewed draft before saving", async ({
  page,
  resetDb,
  loginAsDemoShop,
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
  await expect(page.getByLabel("Campaign name")).toHaveValue("");
  await expect(page.locator('input[name="headline"]')).toHaveValue("");

  await page.getByRole("button", { name: "Apply suggestion" }).click();
  await expect(page.getByLabel("Campaign name")).toHaveValue(
    /Summer launch - trail running shoes/,
  );
  await expect(page.locator('input[name="headline"]')).toHaveValue(/20% off/);
  await expect(page.getByLabel("CTA URL")).toHaveValue(
    "/collections/trail-running",
  );
  await expect(
    page.getByText("Review the campaign fields before saving."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save campaign" }).click();
  await page.waitForURL((url) => {
    const segments = url.pathname.split("/").filter(Boolean);
    return (
      segments.length === 3 &&
      segments[0] === "app" &&
      segments[1] === "campaigns" &&
      segments[2] !== "new"
    );
  });

  await expect(page.getByLabel("Campaign name")).toHaveValue(
    /Summer launch - trail running shoes/,
  );
  await page.getByRole("tab", { name: "A/B testing" }).click();
  await expect(page.getByText("AI suggested variants")).toBeVisible();
  await expect(
    page.getByRole("row", { name: /AI suggested variants/ }),
  ).toContainText("Draft");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
