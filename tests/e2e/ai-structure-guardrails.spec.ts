import {
  decodePackedStructure,
  treeToHtml,
  unpackTree,
} from "../../app/utils/campaign-structure";
import { confirmAction, expect, publishCurrentCampaign, test } from "./fixtures";

// Drives the AI structure quality gate through the real pipeline:
// generate (mock provider + e2e structure fixture) → preview → apply → save →
// activate → storefront JSON. The [e2e-structure:*] marker in the product
// context tells the E2E mock provider which structure fixture to emit.

async function generateApplyAndSave(
  page: import("@playwright/test").Page,
  productContext: string,
) {
  await page.getByRole("button", { name: "AI campaign" }).click();
  const aiBuilder = page.locator(".counterpulse-ai-builder");
  await aiBuilder
    .getByLabel("Product, collection, or audience")
    .fill(productContext);
  await aiBuilder.getByLabel("Event or season").first().fill("Flash weekend");
  await aiBuilder.getByLabel("Offer details").fill("20% off");
  await aiBuilder.getByRole("button", { name: "Generate with AI" }).click();
  await expect(page.getByText("AI suggestion preview")).toBeVisible();

  await page.getByRole("button", { name: "Apply suggestion" }).click();
  await page.getByRole("button", { name: "Save campaign" }).click();
  await confirmAction(page, "Save campaign");
  await page.waitForURL(/\/app\/campaigns\/(?!new$)[^/]+$/);
}

async function publishSavedCampaign(page: import("@playwright/test").Page) {
  // The save flow lands on the campaign editor; publish makes the campaign
  // visible to the storefront endpoint (which serves the published snapshot).
  await publishCurrentCampaign(page);
}

async function fetchStorefrontCampaign(page: import("@playwright/test").Page) {
  const response = await page.request.get("/api/storefront/campaigns", {
    params: {
      shop: "demo-shop.myshopify.com",
      placement: "TOP_BAR",
      locale: "en",
      country: "US",
      path: "/",
      device: "desktop",
    },
  });
  const payload = await response.json();

  expect(response.ok()).toBe(true);
  expect(payload.campaigns.length).toBeGreaterThan(0);
  return payload.campaigns[0];
}

function unpackStructureHtml(packedJson: string) {
  const packed = decodePackedStructure(packedJson);
  expect(packed).not.toBeNull();
  return treeToHtml(unpackTree(packed!));
}

test("AI structure without a timer slot is discarded and the standard layout ships", async ({
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("pro");
  await loginAsDemoShop("/app/campaigns/new");

  await page.getByRole("button", { name: "AI campaign" }).click();
  const aiBuilder = page.locator(".counterpulse-ai-builder");
  await aiBuilder
    .getByLabel("Product, collection, or audience")
    .fill("running shoes [e2e-structure:no-timer]");
  await aiBuilder.getByLabel("Event or season").first().fill("Flash weekend");
  await aiBuilder.getByLabel("Offer details").fill("20% off");
  await aiBuilder.getByRole("button", { name: "Generate with AI" }).click();

  // The discard reason must be surfaced to the merchant in the preview.
  await expect(page.getByText("AI suggestion preview")).toBeVisible();
  await expect(
    page.getByText(/AI layout was discarded.*countdown timer slot/),
  ).toBeVisible();
  // The marker must not leak into the generated copy.
  await expect(page.getByTestId("campaign-name-input")).not.toHaveValue(
    /e2e-structure/,
  );

  await page.getByRole("button", { name: "Apply suggestion" }).click();
  await page.getByRole("button", { name: "Save campaign" }).click();
  await confirmAction(page, "Save campaign");
  await page.waitForURL(/\/app\/campaigns\/(?!new$)[^/]+$/);
  await publishSavedCampaign(page);

  const campaign = await fetchStorefrontCampaign(page);
  const structure = campaign.design?.structure;

  // The standard generated structure ships instead of the AI layout: it has
  // the required timer slot and none of the discarded fixture's markup/CSS.
  expect(structure).toBeTruthy();
  const html = unpackStructureHtml(structure.packed);
  expect(html).toContain('data-cp-slot="timer"');
  expect(html).not.toContain("cp-e2e-bad");
  expect(structure.css ?? "").not.toContain("position:fixed");
});

test("valid AI structure ships with layout-breaking CSS stripped", async ({
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("pro");
  await loginAsDemoShop("/app/campaigns/new");

  await generateApplyAndSave(page, "running shoes [e2e-structure:custom]");
  await publishSavedCampaign(page);

  const campaign = await fetchStorefrontCampaign(page);
  const structure = campaign.design?.structure;

  expect(structure).toBeTruthy();
  const html = unpackStructureHtml(structure.packed);

  // The AI structure survived intact (custom class + required slots)...
  expect(html).toContain("cp-e2e-hero");
  expect(html).toContain('data-cp-slot="headline"');
  expect(html).toContain('data-cp-slot="timer"');

  // ...its benign CSS shipped, and the page-covering declarations did not.
  const css = String(structure.css ?? "");
  expect(css).toContain("letter-spacing:1px");
  expect(css).not.toContain("position:fixed");
  expect(css).not.toContain("100vw");
  expect(css).not.toContain("99999");
});
