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
    "/app/templates?country=MX&locale=es&eventName=Buen+Fin&type=COUNTDOWN_BAR",
  );

  await expect(
    page.getByRole("heading", { exact: true, name: "Template Library" }),
  ).toBeVisible();
  const buenFinTemplate = page
    .locator(".counterpulse-template-card")
    .filter({ hasText: "MX / es" })
    .first();

  await expect(buenFinTemplate).toContainText("Buen Fin");
  await buenFinTemplate.getByRole("button", { name: "Use template" }).click();

  await page.waitForURL(/\/app\/campaigns\/[^/]+$/);
  await expect(page.getByLabel("Campaign name")).toHaveValue(/Buen Fin/);
  await expect(page.locator('select[name="status"]')).toHaveValue("DRAFT");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
