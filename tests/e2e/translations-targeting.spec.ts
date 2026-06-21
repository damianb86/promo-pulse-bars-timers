import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  publishCurrentCampaign,
  test,
} from "./fixtures";

test("Spanish translations and locale/country targeting affect storefront API", async ({
  page,
  resetDb,
  loginAsDemoShop,
}) => {
  await resetDb("targeting");
  await loginAsDemoShop("/app/campaigns");

  await page.getByRole("link", { name: "E2E Flash Sale Countdown" }).click();
  const campaignForm = page.locator("#campaign-basics-form");

  await campaignForm.getByRole("tab", { name: "Message" }).click();
  await campaignForm.getByRole("tab", { name: /ES Spanish/ }).click();
  await campaignForm
    .locator('input[name="translation.es.headline"]')
    .fill("Oferta solo para Argentina");
  await campaignForm
    .locator('textarea[name="translation.es.subheadline"]')
    .fill("Disponible por tiempo limitado.");
  await campaignForm
    .locator('input[name="translation.es.ctaText"]')
    .fill("Comprar");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.locator("ui-save-bar").getByRole("button", { name: "Save" }).click(),
  ]);
  await campaignForm.getByRole("tab", { name: "Message" }).click();
  await campaignForm.getByRole("tab", { name: /ES Spanish/ }).click();
  await expect(
    campaignForm.locator('input[name="translation.es.headline"]'),
  ).toHaveValue("Oferta solo para Argentina");
  await publishCurrentCampaign(page);

  const matching = await page.request.get(
    "/api/storefront/campaigns?shop=demo-shop.myshopify.com&placement=TOP_BAR&locale=es&country=AR",
  );
  expect(matching.ok()).toBe(true);
  const matchingPayload = await matching.json();
  expect(matchingPayload.campaigns).toHaveLength(1);
  expect(matchingPayload.campaigns[0].texts.headline).toBe(
    "Oferta solo para Argentina",
  );

  const nonMatching = await page.request.get(
    "/api/storefront/campaigns?shop=demo-shop.myshopify.com&placement=TOP_BAR&locale=es&country=US",
  );
  expect(nonMatching.ok()).toBe(true);
  expect((await nonMatching.json()).campaigns).toHaveLength(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
