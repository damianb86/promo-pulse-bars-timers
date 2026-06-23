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
