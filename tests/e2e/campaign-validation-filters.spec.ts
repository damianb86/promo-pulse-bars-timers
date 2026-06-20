import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("campaign creation shows server validation errors", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb();
  await loginAsDemoShop("/app/campaigns/new");

  await page.getByRole("combobox", { name: /^Status$/ }).selectOption("ACTIVE");
  await page.getByRole("tab", { name: "Message" }).click();
  await page.getByLabel("CTA URL").fill("ftp://example.com");
  await page.getByRole("button", { name: "Save campaign" }).click();

  await page.getByRole("tab", { name: "Setup" }).click();
  await expect(page.getByText("Campaign name is required.")).toBeVisible();
  await page.getByRole("tab", { name: "Message" }).click();
  await expect(
    page.getByText("An active campaign needs a basic headline translation."),
  ).toBeVisible();
  await expect(
    page.getByText("CTA URL must be a valid absolute URL or storefront path."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app\/campaigns\/new$/);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("campaign list filters by search, status, and type", async ({
  page,
  resetDb,
  loginAsDemoShop,
  createCampaignViaUI,
}) => {
  await resetDb();
  await loginAsDemoShop("/app");

  await createCampaignViaUI({
    headline: "Countdown headline",
    name: "E2E Filter Countdown",
    status: "ACTIVE",
    type: "COUNTDOWN_BAR",
  });
  await createCampaignViaUI({
    goal: "Free shipping",
    headline: "Shipping headline",
    name: "E2E Filter Shipping",
    placement: "CART_PAGE",
    status: "DRAFT",
    type: "FREE_SHIPPING_GOAL",
  });

  await page.goto("/app/campaigns");
  await page.getByLabel("Search by name").fill("Shipping");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByRole("row", { name: /E2E Filter Shipping/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /E2E Filter Countdown/ }),
  ).toHaveCount(0);

  await page.getByLabel("Search by name").fill("");
  await page.getByRole("combobox", { name: /^Status$/ }).selectOption("ACTIVE");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByRole("row", { name: /E2E Filter Countdown/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /E2E Filter Shipping/ }),
  ).toHaveCount(0);

  await page.getByRole("combobox", { name: /^Status$/ }).selectOption("");
  await page.getByLabel("Type").selectOption("FREE_SHIPPING_GOAL");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByRole("row", { name: /E2E Filter Shipping/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /E2E Filter Countdown/ }),
  ).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
