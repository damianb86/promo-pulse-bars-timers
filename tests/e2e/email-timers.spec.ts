import { expect, test } from "./fixtures";

test("merchant can create and copy an email timer image URL", async ({
  createCampaignViaUI,
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("premium");
  await loginAsDemoShop();
  const campaignId = await createCampaignViaUI({
    name: "E2E Email Timer Campaign",
    status: "ACTIVE",
  });

  await page.goto(`/app/campaigns/${campaignId}`);
  await page.getByRole("button", { name: "Create email timer" }).click();

  const urlInput = page.getByLabel("Email timer URL").first();
  await expect(urlInput).toHaveValue(/\/api\/email-timer\/.+\.png$/);

  const imageUrl = await urlInput.inputValue();
  const response = await page.request.get(new URL(imageUrl).pathname);

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");

  await expect(page.getByLabel("Email snippet").first()).toHaveValue(/<img/);
  await expect(page.getByRole("button", { name: "Copy URL" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy snippet" }),
  ).toBeVisible();
});
