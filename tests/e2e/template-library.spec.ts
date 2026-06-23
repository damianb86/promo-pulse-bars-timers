import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("merchant filters templates and creates a draft campaign", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("template-library");
  await loginAsDemoShop(
    "/app/templates?country=US&locale=en&eventName=Black+Friday&type=COUNTDOWN_BAR",
  );

  await expect(
    page.getByRole("heading", { exact: true, name: "Template Library" }),
  ).toBeVisible();
  const blackFridayTemplate = page
    .locator(".counterpulse-template-card")
    .filter({ hasText: "US / en" })
    .first();

  await expect(blackFridayTemplate).toContainText("Black Friday");
  await blackFridayTemplate
    .getByRole("button", { name: "Use template" })
    .click();

  await page.waitForURL(/\/app\/campaigns\/[^/]+$/);
  await expect(
    page.locator("#campaign-basics-form").getByTestId("campaign-name-input"),
  ).toHaveValue(/Black Friday/);
  await expect(
    page.locator("#campaign-basics-form").getByTestId("campaign-status-select"),
  ).toHaveValue("DRAFT");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("template cards render real and distinct campaign previews", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("template-library-previews");
  await loginAsDemoShop("/app/templates?country=US&locale=en");

  const cards = page.locator(".counterpulse-template-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(4);

  await expect(
    cards.first().locator(".counterpulse-template-card__preview--real"),
  ).toBeVisible();
  await expect(
    cards.first().locator(".counterpulse-preview-shell"),
  ).toBeVisible();

  const previewSignatures = await page
    .locator(
      ".counterpulse-template-card .counterpulse-preview-promo, .counterpulse-template-card .counterpulse-preview-badge",
    )
    .evaluateAll((elements) =>
      elements.slice(0, 8).map((element) => {
        const style = window.getComputedStyle(element);

        return [
          style.backgroundColor,
          style.backgroundImage,
          style.color,
          element.className,
          element.textContent?.trim() ?? "",
        ].join("|");
      }),
    );

  expect(previewSignatures.length).toBeGreaterThan(4);
  expect(new Set(previewSignatures).size).toBeGreaterThan(3);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
