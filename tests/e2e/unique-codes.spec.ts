import {
  confirmAction,
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  publishCurrentCampaign,
  test,
} from "./fixtures";
import type { Page, Response } from "@playwright/test";
import {
  demoShopDomain,
  escapeRegExp,
  readAnalyticsSummary,
} from "./stage2-helpers";

test("unique codes can be generated and assigned per visitor", async ({
  createCampaignViaUI,
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("pro");
  await loginAsDemoShop();
  const campaignId = await createCampaignViaUI({
    name: "E2E Stage 2 Unique Codes",
    status: "ACTIVE",
    headline: "Private code unlocked",
    subheadline: "Save with your unique visitor code.",
  });

  await page.goto(`/app/campaigns/${campaignId}`);
  await page.getByRole("tab", { name: "Offers" }).click();
  await page.getByRole("tab", { name: "Unique codes" }).click();
  const uniqueCodesForm = page.locator(
    'form:has(input[name="_action"][value="generateUniqueCodes"])',
  );

  await uniqueCodesForm.getByLabel("Enable unique codes").check();
  await uniqueCodesForm.getByLabel("Discount title").fill("STG2 unique codes");
  await uniqueCodesForm.getByLabel("Prefix").fill("STG2");
  await uniqueCodesForm.getByLabel("Discount type").selectOption("PERCENTAGE");
  await uniqueCodesForm.getByLabel("Discount value").fill("15");
  await uniqueCodesForm.getByLabel("Duration per visitor").fill("60");
  await uniqueCodesForm.getByLabel("Reassign unused expired codes").check();
  await uniqueCodesForm.getByLabel("Total codes to generate").fill("2");
  const autoApply = uniqueCodesForm.getByLabel("Auto-apply visitor codes");
  if (!(await autoApply.isChecked())) {
    await autoApply.check();
  }

  await uniqueCodesForm.getByRole("button", { name: "Generate codes" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/app/campaigns/${campaignId}`) &&
        response.request().method() === "POST",
    ),
    confirmAction(page, "Generate codes"),
  ]);
  await expect(page.getByText("Generated 2 unique codes.")).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Reassign unused" }),
  ).toBeVisible();
  const generatedPoolRow = page.getByRole("row", {
    name: /STG2 Percentage 15 Active 2/,
  });
  await expect(generatedPoolRow).toBeVisible();
  await expect(generatedPoolRow).toContainText("Yes");

  await page.getByRole("tab", { name: "Design" }).click();
  await expect(page.getByRole("heading", { name: "Offer code" })).toBeVisible();
  const preview = page.getByRole("region", {
    name: "Design live campaign preview",
  });
  await expect(preview).toContainText("STG2-A1B2C3");
  await expect(preview).toContainText("Copy code");
  await expect(preview).toContainText("Apply discount");
  const designEditor = page.getByRole("tabpanel", { name: "Design" });
  const offerPreview = preview.locator(".counterpulse-preview-offer").first();

  await expect(offerPreview).toHaveClass(/counterpulse-preview-offer--inline/);
  await expect(
    offerPreview.locator("> .counterpulse-preview-offer-main"),
  ).toHaveCount(0);
  await designEditor
    .getByRole("button", { name: "Stacked", exact: true })
    .click();
  await expect(offerPreview).toHaveClass(/counterpulse-preview-offer--stacked/);
  await expect(
    offerPreview.locator("> .counterpulse-preview-offer-main"),
  ).toHaveCount(1);
  await expect(
    offerPreview.locator("> .counterpulse-preview-offer-actions"),
  ).toHaveCount(1);
  await designEditor
    .getByRole("button", { name: "Compact", exact: true })
    .click();
  await expect(offerPreview).toHaveClass(/counterpulse-preview-offer--compact/);
  await expect(
    offerPreview.locator("> .counterpulse-preview-offer-compact-code"),
  ).toHaveCount(1);
  await expect(
    offerPreview.locator("> .counterpulse-preview-cta--offer"),
  ).toHaveCount(1);

  await publishCurrentCampaign(page);

  await gotoStorefront(page, "stage2-visitor-a", "stage2-session-a");
  const widget = page.locator(".pp-unique-code").first();
  await expect(widget.locator(".pp-unique-code__value")).toHaveText(/^STG2-/);
  const codeA = (await widget.locator(".pp-unique-code__value").textContent())!;
  await expect(widget.locator(".pp-cta")).toHaveAttribute(
    "href",
    new RegExp("^/discount/" + escapeRegExp(codeA)),
  );

  await widget.getByRole("button", { name: /Copy code/i }).click();
  await widget.locator(".pp-cta").evaluate((element) => {
    element.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    (element as HTMLElement).click();
  });
  await expect
    .poll(async () => readAnalyticsSummary(page))
    .toMatchObject({ copyCode: 1, applyCodeClicked: 1 });

  await gotoStorefront(page, "stage2-visitor-b", "stage2-session-b");
  await expect(page.locator(".pp-unique-code__value").first()).toHaveText(
    /^STG2-/,
  );
  const codeB =
    (await page.locator(".pp-unique-code__value").first().textContent()) ?? "";
  expect(codeB).not.toBe(codeA);

  await gotoStorefront(page, "stage2-visitor-a", "stage2-session-a");
  await expect(page.getByRole("status")).toContainText(
    "Discount applied successfully.",
  );
  await expect(page.locator(".pp-unique-code__value")).toHaveCount(0);

  const expireResponse = await page.request.post("/__test/stage2", {
    data: {
      action: "expireUniqueCode",
      shop: demoShopDomain,
      campaignId,
      visitorId: "stage2-visitor-b",
    },
  });
  expect(expireResponse.ok()).toBe(true);

  await gotoStorefront(page, "stage2-visitor-b", "stage2-session-b");
  await expect(page.locator(".pp-unique-code__expired").first()).toContainText(
    /ended|no longer available/i,
  );
  await expect(page.locator(".pp-unique-code__value")).toHaveCount(0);

  await gotoStorefront(page, "stage2-visitor-c", "stage2-session-c");
  await expect(page.locator(".pp-unique-code__value").first()).toHaveText(
    codeB,
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("unique code pools can be generated while storefront unique codes stay disabled", async ({
  createCampaignViaUI,
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("pro");
  await loginAsDemoShop();
  const campaignId = await createCampaignViaUI({
    name: "E2E Unique Codes Disabled Generation",
    status: "ACTIVE",
    headline: "Codes prepared",
    subheadline: "Storefront offer stays off.",
  });

  await page.goto(`/app/campaigns/${campaignId}`);
  await page.getByRole("tab", { name: "Offers" }).click();
  await page.getByRole("tab", { name: "Unique codes" }).click();
  const uniqueCodesForm = page.locator(
    'form:has(input[name="_action"][value="generateUniqueCodes"])',
  );
  const enableUniqueCodes =
    uniqueCodesForm.getByLabel("Enable unique codes");

  await expect(enableUniqueCodes).not.toBeChecked();
  await uniqueCodesForm.getByLabel("Discount title").fill("OFF unique codes");
  await uniqueCodesForm.getByLabel("Prefix").fill("OFF");
  await uniqueCodesForm.getByLabel("Discount type").selectOption("PERCENTAGE");
  await uniqueCodesForm.getByLabel("Discount value").fill("12");
  await uniqueCodesForm.getByLabel("Total codes to generate").fill("2");

  await uniqueCodesForm.getByRole("button", { name: "Generate codes" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/app/campaigns/${campaignId}`) &&
        response.request().method() === "POST",
    ),
    confirmAction(page, "Generate codes"),
  ]);

  await expect(page.getByText("Generated 2 unique codes.")).toBeVisible();
  await expect(enableUniqueCodes).not.toBeChecked();
  await expect(
    page.getByRole("row", { name: /OFF Percentage 12 Active 2/ }),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Offers" }).click();
  await page.getByRole("tab", { name: "Unique codes" }).click();
  await expect(
    uniqueCodesForm.getByLabel("Enable unique codes"),
  ).not.toBeChecked();
  await expect(uniqueCodesForm.getByLabel("Discount title")).toHaveValue(
    "OFF unique codes",
  );
  await expect(uniqueCodesForm.getByLabel("Prefix")).toHaveValue("OFF");
  await expect(
    page.getByRole("row", { name: /OFF Percentage 12 Active 2/ }),
  ).toBeVisible();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

async function gotoStorefront(
  page: Page,
  visitorId: string,
  sessionId: string,
) {
  const optionalCartDrawerResponse = page
    .waitForResponse(
      (response) =>
        isStorefrontCampaignResponse(response, visitorId, "CART_DRAWER"),
      { timeout: 1500 },
    )
    .catch(() => null);
  const optionalBottomBarResponse = page
    .waitForResponse(
      (response) =>
        isStorefrontCampaignResponse(response, visitorId, "BOTTOM_BAR"),
      { timeout: 1500 },
    )
    .catch(() => null);
  const optionalTopBarResponse = page
    .waitForResponse(
      (response) =>
        isStorefrontCampaignResponse(response, visitorId, "TOP_BAR"),
      { timeout: 1500 },
    )
    .catch(() => null);

  await page.goto(
    `/__test/storefront?visitorId=${visitorId}&sessionId=${sessionId}`,
  );
  await optionalTopBarResponse;
  await optionalCartDrawerResponse;
  await optionalBottomBarResponse;
}

function isStorefrontCampaignResponse(
  response: Response,
  visitorId: string,
  placement: string,
) {
  const url = response.url();

  return (
    response.ok() &&
    response.request().method() === "GET" &&
    url.includes("/apps/promo-pulse") &&
    url.includes(`visitorId=${visitorId}`) &&
    url.includes(`placement=${placement}`)
  );
}
