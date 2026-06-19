import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";
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
  await resetDb("premium");
  await loginAsDemoShop();
  const campaignId = await createCampaignViaUI({
    name: "E2E Stage 2 Unique Codes",
    status: "ACTIVE",
    headline: "Private code unlocked",
    subheadline: "Save with your unique visitor code.",
  });

  await page.goto(`/app/campaigns/${campaignId}`);
  const uniqueCodesForm = page.locator(
    'form:has(input[name="_action"][value="generateUniqueCodes"])',
  );

  await uniqueCodesForm.getByLabel("Enable unique codes").check();
  await uniqueCodesForm.getByLabel("Prefix").fill("STG2");
  await uniqueCodesForm.getByLabel("Discount type").selectOption("PERCENTAGE");
  await uniqueCodesForm.getByLabel("Discount value").fill("15");
  await uniqueCodesForm.getByLabel("Duration per visitor").fill("60");
  await uniqueCodesForm.getByLabel("Total codes to generate").fill("2");

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/app/campaigns/${campaignId}`) &&
        response.request().method() === "POST",
    ),
    uniqueCodesForm.getByRole("button", { name: "Generate codes" }).click(),
  ]);
  await expect(page.getByText("Generated 2 unique codes.")).toBeVisible();
  await expect(
    page.getByRole("row", { name: /STG2 Percentage 15 Active 2/ }),
  ).toBeVisible();

  const discountForm = page.locator(
    'form:has(input[name="_action"][value="saveDiscount"])',
  );
  await discountForm.getByLabel("Discount mode").selectOption("UNIQUE_CODES");
  await discountForm.getByLabel("New discount title").fill("STG2 unique codes");
  await discountForm.getByLabel("Unique code prefix").fill("STG2");
  await discountForm.getByLabel("Discount type").selectOption("PERCENTAGE");
  await discountForm.getByLabel("Discount value").fill("15");
  await discountForm.getByLabel("Unique code expiration minutes").fill("60");
  const autoApply = discountForm.getByLabel("Auto-apply unique visitor codes");
  if (!(await autoApply.isChecked())) {
    await autoApply.check();
  }
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/app/campaigns/${campaignId}`) &&
        response.request().method() === "POST",
    ),
    discountForm.getByRole("button", { name: "Save discount" }).click(),
  ]);

  await page.goto(
    "/__test/storefront?visitorId=stage2-visitor-a&sessionId=stage2-session-a",
  );
  const widget = page.locator(".pp-unique-code").first();
  await expect(widget.locator(".pp-unique-code__value")).toHaveText(/^STG2-/);
  const codeA = (await widget.locator(".pp-unique-code__value").textContent())!;

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

  await page.goto(
    "/__test/storefront?visitorId=stage2-visitor-b&sessionId=stage2-session-b",
  );
  await expect(page.locator(".pp-unique-code__value").first()).toHaveText(
    /^STG2-/,
  );
  const codeB =
    (await page.locator(".pp-unique-code__value").first().textContent()) ?? "";
  expect(codeB).not.toBe(codeA);

  await page.goto(
    "/__test/storefront?visitorId=stage2-visitor-a&sessionId=stage2-session-a",
  );
  await expect(page.locator(".pp-unique-code__value").first()).toHaveText(
    codeA,
  );
  await expect(page.locator(".pp-unique-code .pp-cta").first()).toHaveAttribute(
    "href",
    new RegExp("^/discount/" + escapeRegExp(codeA)),
  );

  const expireResponse = await page.request.post("/__test/stage2", {
    data: {
      action: "expireUniqueCode",
      shop: demoShopDomain,
      campaignId,
      visitorId: "stage2-visitor-a",
    },
  });
  expect(expireResponse.ok()).toBe(true);

  await page.goto(
    "/__test/storefront?visitorId=stage2-visitor-a&sessionId=stage2-session-a",
  );
  await expect(page.locator(".pp-unique-code__expired").first()).toContainText(
    /ended|no longer available/i,
  );
  await expect(page.locator(".pp-unique-code__value")).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
