import {
  confirmAction,
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

  await page.getByRole("button", { name: "AI campaign" }).click();
  const aiBuilder = page.locator(".counterpulse-ai-builder");
  await expect(
    aiBuilder.getByText("Start with intent, not copywriting"),
  ).toBeVisible();
  await aiBuilder
    .getByLabel("Product, collection, or audience")
    .fill("trail running shoes");
  await aiBuilder.getByLabel("Event or season").first().fill("Summer launch");
  await aiBuilder.getByLabel("Country").first().fill("US");
  await aiBuilder.getByLabel("Language").first().selectOption("es");
  await aiBuilder.getByRole("button", { name: /^Urgent$/ }).click();
  await aiBuilder.getByLabel("Offer details").fill("20% off");
  await aiBuilder
    .getByLabel("Target URL")
    .first()
    .fill("/collections/trail-running");
  await aiBuilder.getByRole("button", { name: "Generate with AI" }).click();

  await expect(page.getByText("AI suggestion preview")).toBeVisible();
  const campaignNameInput = page.getByTestId("campaign-name-input");
  await expect(campaignNameInput).toHaveValue("");
  await expect(page.locator('input[name="headline"]')).toHaveValue(
    "Flash sale ends soon",
  );

  await page.getByRole("button", { name: "Apply suggestion" }).click();
  await expect(campaignNameInput).toHaveValue(
    /Summer launch - trail running shoes/,
  );
  await expect(page.locator('input[name="headline"]')).toHaveValue(/20% off/);
  await expect(page.getByLabel("CTA URL")).toHaveValue(
    "/collections/trail-running",
  );
  await expect(page.locator(".counterpulse-ai-drawer")).toBeHidden();

  await page.getByRole("button", { name: "Save campaign" }).click();
  await confirmAction(page, "Save campaign");
  await page.waitForURL((url) => {
    const segments = url.pathname.split("/").filter(Boolean);
    return (
      segments.length === 3 &&
      segments[0] === "app" &&
      segments[1] === "campaigns" &&
      segments[2] !== "new"
    );
  });

  await expect(campaignNameInput).toHaveValue(
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
