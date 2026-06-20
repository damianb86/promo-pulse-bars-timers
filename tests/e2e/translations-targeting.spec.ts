import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
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
  await page.getByRole("tab", { name: "Translations" }).click();
  await page.getByRole("tab", { name: /ES Spanish/ }).click();
  await page
    .locator('input[name="translation.es.headline"]')
    .fill("Oferta solo para Argentina");
  await page
    .locator('textarea[name="translation.es.subheadline"]')
    .fill("Disponible por tiempo limitado.");
  await page.locator('input[name="translation.es.ctaText"]').fill("Comprar");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save translations" }).click(),
  ]);
  await page.getByRole("tab", { name: /ES Spanish/ }).click();
  await expect(
    page.locator('input[name="translation.es.headline"]'),
  ).toHaveValue("Oferta solo para Argentina");

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
