import {
  confirmAction,
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
  const freeShippingQuickStart = aiBuilder
    .getByRole("button", { name: "Free shipping threshold" })
    .first();
  await freeShippingQuickStart.click();
  await expect(freeShippingQuickStart).toHaveAttribute("aria-pressed", "true");
  await expect(aiBuilder.getByLabel("Offer details")).toHaveValue(
    /Free shipping threshold/,
  );
  await freeShippingQuickStart.click();
  await expect(freeShippingQuickStart).toHaveAttribute("aria-pressed", "false");
  await aiBuilder.getByLabel("Offer details").fill("20% off");
  await aiBuilder
    .getByLabel("Target URL")
    .first()
    .fill("/collections/trail-running");
  await aiBuilder.getByRole("button", { name: "Generate with AI" }).click();

  await expect(page.getByText("AI suggestion preview")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "AI suggestion preview" }),
  ).toBeVisible();
  await expect(
    page.getByText("20% off on trail running shoes").first(),
  ).toBeVisible();
  const campaignNameInput = page.getByTestId("campaign-name-input");
  await expect(campaignNameInput).toHaveValue("");
  await expect(page.locator('input[name="headline"]')).toHaveValue("");

  await page.getByRole("button", { name: "Apply suggestion" }).click();
  await expect(campaignNameInput).toHaveValue(
    /Summer launch - trail running shoes/,
  );
  await expect(page.locator('input[name="headline"]')).toHaveValue(/20% off/);
  await expect(page.locator('select[name="status"]')).toHaveValue("DRAFT");

  await page.getByRole("button", { name: "Save campaign" }).click();
  await confirmAction(page, "Save campaign");
  await page.waitForURL(/\/app\/campaigns\/[^/]+$/);
  await expect(page.locator('select[name="status"]')).toHaveValue("DRAFT");
  await page.getByRole("tab", { name: "A/B testing" }).click();
  await expect(page.getByText("AI suggested variants")).toBeVisible();
  await expect(
    page.getByRole("row", { name: /AI suggested variants/ }),
  ).toContainText("Draft");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("AI builder asks one optional follow-up batch before generation", async ({
  loginAsDemoShop,
  page,
  resetDb,
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
    .fill("jackets");
  await aiBuilder.getByLabel("Event or season").first().fill("Weekend sale");
  await aiBuilder.getByRole("button", { name: "Generate with AI" }).click();

  await expect(
    page.getByText("Optional refinements before generating"),
  ).toBeVisible();
  const followUpOption = aiBuilder
    .getByRole("button", { name: /20% off/ })
    .first();
  await followUpOption.click();
  await expect(followUpOption).toHaveAttribute("aria-pressed", "true");
  await aiBuilder
    .getByRole("button", { name: "Generate campaign with these answers" })
    .click();

  await expect(page.getByText("AI suggestion preview")).toBeVisible();
  await expect(page.getByText("20% off on jackets").first()).toBeVisible();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
