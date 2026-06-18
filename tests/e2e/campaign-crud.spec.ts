import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("campaign CRUD actions work from the admin UI", async ({
  page,
  resetDb,
  loginAsDemoShop,
  createCampaignViaUI,
}) => {
  await resetDb();
  await loginAsDemoShop("/app");

  await createCampaignViaUI({
    name: "E2E CRUD Campaign",
    status: "DRAFT",
  });

  await page.getByLabel("Campaign name").fill("E2E CRUD Campaign Updated");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Update campaign" }).click(),
  ]);
  await page.waitForURL("/app/campaigns");

  let row = page.getByRole("row", { name: /E2E CRUD Campaign Updated/ });
  await expect(row).toContainText("Draft");

  await row.getByRole("button", { name: "Activate" }).click();
  row = page.getByRole("row", { name: /E2E CRUD Campaign Updated/ });
  await expect(row).toContainText("Active");

  await row.getByRole("button", { name: "Pause" }).click();
  row = page.getByRole("row", { name: /E2E CRUD Campaign Updated/ });
  await expect(row).toContainText("Paused");

  await row.getByRole("button", { name: "Duplicate" }).click();
  await expect(
    page.getByRole("row", { name: /E2E CRUD Campaign Updated copy/ }),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("row", { name: /E2E CRUD Campaign Updated copy/ })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(
    page.getByRole("row", { name: /E2E CRUD Campaign Updated copy/ }),
  ).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
