import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";
import { readPngSize } from "./stage2-helpers";

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
  await page.getByRole("tab", { name: "Offers" }).click();
  await page.getByLabel("Expired behavior").selectOption("HIDE");
  await page.getByRole("button", { name: "Create email timer" }).click();

  const urlInput = page.getByLabel("Email timer URL").first();
  await expect(urlInput).toHaveValue(/\/api\/email-timer\/.+\.png$/);

  const imageUrl = await urlInput.inputValue();
  const imagePath = new URL(imageUrl).pathname;
  const response = await page.request.get(imagePath);

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect(readPngSize(await response.body())).toMatchObject({
    width: 600,
    height: 180,
  });

  await expect(page.getByLabel("Email snippet").first()).toHaveValue(/<img/);
  await expect(page.getByRole("button", { name: "Copy URL" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy snippet" }),
  ).toBeVisible();

  const token = imagePath.match(/\/api\/email-timer\/(.+)\.png$/)?.[1] ?? "";
  const expireResponse = await page.request.post("/__test/stage2", {
    data: {
      action: "expireEmailTimer",
      publicToken: token,
      expiredBehavior: "HIDE",
    },
  });
  expect(expireResponse.ok()).toBe(true);

  const expiredResponse = await page.request.get(imagePath);
  expect(expiredResponse.ok()).toBe(true);
  expect(expiredResponse.headers()["content-type"]).toContain("image/png");
  expect(readPngSize(await expiredResponse.body())).toEqual({
    width: 1,
    height: 1,
  });

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
