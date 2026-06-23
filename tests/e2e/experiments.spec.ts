import type { Locator, Page } from "@playwright/test";

import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  publishCurrentCampaign,
  test,
} from "./fixtures";
import { readAnalyticsSummary } from "./stage2-helpers";

type StorefrontExperimentVariant = {
  id: string;
  name: string;
  weight: number;
  textOverride?: Record<string, unknown> | null;
};

async function setRangeValue(locator: Locator, value: number) {
  await locator.evaluate((element: HTMLInputElement, nextValue) => {
    element.value = String(nextValue);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function findVisitorIdForVariant(
  page: Page,
  campaignId: string,
  headline: string,
) {
  const params = new URLSearchParams({
    shop: "demo-shop.myshopify.com",
    path: "/__test/storefront",
    locale: "en",
    device: "desktop",
    placement: "TOP_BAR",
    country: "US",
    currency: "USD",
    campaignId,
    visitorId: "experiment-probe",
    sessionId: "experiment-probe-session",
    doNotTrack: "false",
    consentGranted: "true",
  });
  const response = await page.request.get(`/apps/promo-pulse?${params}`);
  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as {
    campaigns?: Array<{
      experiment?: {
        id?: string;
        variants?: StorefrontExperimentVariant[];
      } | null;
    }>;
  };
  const experiment = payload.campaigns?.[0]?.experiment;
  const variants = experiment?.variants ?? [];
  const targetVariant = variants.find(
    (variant) => variant.textOverride?.headline === headline,
  );

  expect(experiment?.id).toBeTruthy();
  expect(targetVariant).toBeTruthy();

  for (let index = 0; index < 500; index += 1) {
    const visitorId = `stage2-experiment-treatment-visitor-${index}`;
    const selectedVariant = selectExperimentVariant(
      experiment!.id!,
      visitorId,
      variants,
    );

    if (selectedVariant?.id === targetVariant!.id) {
      return visitorId;
    }
  }

  throw new Error(
    "Could not find a visitor assigned to the treatment variant.",
  );
}

function selectExperimentVariant(
  experimentId: string,
  visitorId: string,
  variants: StorefrontExperimentVariant[],
) {
  const assignableVariants = variants.filter(
    (variant) => Number(variant.weight) > 0,
  );
  const totalWeight = assignableVariants.reduce(
    (total, variant) => total + Math.max(0, Math.trunc(variant.weight)),
    0,
  );
  let cumulativeWeight = 0;

  if (totalWeight <= 0) return null;

  const bucket =
    hashAssignmentBucket(`${experimentId}:${visitorId}`) % totalWeight;

  for (const variant of assignableVariants) {
    cumulativeWeight += Math.max(0, Math.trunc(variant.weight));
    if (bucket < cumulativeWeight) return variant;
  }

  return assignableVariants[assignableVariants.length - 1] ?? null;
}

function hashAssignmentBucket(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

test("campaign experiments assign stable variants and can be paused", async ({
  createCampaignViaUI,
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("premium");
  await loginAsDemoShop();
  const campaignId = await createCampaignViaUI({
    name: "E2E Stage 2 Experiment",
    status: "ACTIVE",
    headline: "Experiment base headline",
    subheadline: "Base campaign copy.",
  });

  await page.goto(`/app/campaigns/${campaignId}`);
  await page.getByRole("tab", { name: "Experiments" }).click();
  const createExperimentForm = page.locator(
    'form:has(input[name="_action"][value="createExperiment"])',
  );
  await expect(
    createExperimentForm.getByRole("button", { name: "Edit variant" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("complementary", { name: "Edit variant" }),
  ).toHaveCount(0);
  await createExperimentForm
    .getByLabel("Experiment name")
    .fill("E2E A/B Experiment");
  await createExperimentForm
    .getByLabel("Primary metric")
    .selectOption("CLICK_RATE");
  await createExperimentForm
    .getByRole("button", { name: "Add variant" })
    .click();
  const variantDrawer = page.getByRole("complementary", {
    name: "Edit variant",
  });
  await expect(variantDrawer).toBeVisible();
  await setRangeValue(
    createExperimentForm.getByLabel("Variant 1 traffic split slider"),
    99,
  );
  await variantDrawer
    .getByRole("textbox", { name: /^Headline / })
    .fill("Variant headline");
  await variantDrawer
    .getByRole("textbox", { name: /^Subheadline / })
    .fill("A/B treatment copy.");
  await variantDrawer
    .getByRole("textbox", { name: /^CTA text / })
    .fill("Shop variant");
  await variantDrawer.getByRole("button", { name: "Done" }).click();
  await expect(variantDrawer).toHaveCount(0);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/app/campaigns/${campaignId}`) &&
        response.request().method() === "POST",
    ),
    createExperimentForm
      .getByRole("button", { name: "Create experiment" })
      .click(),
  ]);
  const savedExperiment = page
    .locator(".counterpulse-experiment-shell")
    .filter({ hasText: "E2E A/B Experiment" });
  await expect(
    savedExperiment.getByRole("heading", { name: "E2E A/B Experiment" }),
  ).toBeVisible();
  await expect(createExperimentForm).toHaveCount(0);
  await expect(
    savedExperiment.getByRole("button", { name: "Save auto-winner" }),
  ).toHaveCount(0);
  await expect(
    savedExperiment.locator(
      'form:has(input[name="_action"][value="updateExperiment"])',
    ),
  ).toHaveCount(0);
  await savedExperiment
    .getByRole("button", { name: "Edit experiment" })
    .click();
  await expect(
    savedExperiment.locator(
      'form:has(input[name="_action"][value="updateExperiment"])',
    ),
  ).toHaveCount(1);
  await savedExperiment.getByRole("button", { name: "Close editor" }).click();
  await expect(
    savedExperiment.locator(
      'form:has(input[name="_action"][value="updateExperiment"])',
    ),
  ).toHaveCount(0);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/app/campaigns/${campaignId}`) &&
        response.request().method() === "POST",
    ),
    savedExperiment.getByRole("button", { name: "Start experiment" }).click(),
  ]);
  await expect(
    savedExperiment.locator(".counterpulse-experiment-status"),
  ).toHaveText("Live");
  await publishCurrentCampaign(page);
  const treatmentVisitorId = await findVisitorIdForVariant(
    page,
    campaignId,
    "Variant headline",
  );

  await page.goto(
    `/__test/storefront?visitorId=${treatmentVisitorId}&sessionId=stage2-experiment-session`,
  );
  const bar = page.locator(".pp-bar").first();
  await expect(bar).toContainText("Variant headline");
  await expect(bar).toContainText("A/B treatment copy.");
  await expect(bar.locator(".pp-code")).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".pp-bar").first()).toContainText(
    "Variant headline",
  );
  await expect
    .poll(async () => readAnalyticsSummary(page))
    .toMatchObject({ attributedVariants: 1 });

  await loginAsDemoShop(`/app/campaigns/${campaignId}`);
  await page.getByRole("tab", { name: "Experiments" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/app/campaigns/${campaignId}`) &&
        response.request().method() === "POST",
    ),
    savedExperiment.getByRole("button", { name: "Pause" }).click(),
  ]);
  await expect(
    savedExperiment.locator(".counterpulse-experiment-status"),
  ).toHaveText("Paused");
  await publishCurrentCampaign(page);

  await page.goto(
    `/__test/storefront?visitorId=${treatmentVisitorId}&sessionId=stage2-experiment-session`,
  );
  await expect(page.locator(".pp-bar").first()).toContainText(
    "Experiment base headline",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("experiment variant copy is prefilled and design preview updates live", async ({
  createCampaignViaUI,
  loginAsDemoShop,
  page,
  resetDb,
}) => {
  await resetDb("premium");
  await loginAsDemoShop();
  const campaignId = await createCampaignViaUI({
    name: "E2E Experiment Design Preview",
    headline: "Control headline",
    subheadline: "Control subheadline",
    ctaText: "Control CTA",
  });

  await page.goto(`/app/campaigns/${campaignId}`);
  await page.getByRole("tab", { name: "Experiments" }).click();

  const createExperimentForm = page.locator(
    'form:has(input[name="_action"][value="createExperiment"])',
  );

  await createExperimentForm
    .getByRole("button", { name: "Add variant" })
    .click();

  const variantDrawer = page.getByRole("complementary", {
    name: "Edit variant",
  });
  await expect(variantDrawer).toBeVisible();
  await expect(
    variantDrawer.getByRole("textbox", { name: /^Headline / }),
  ).toHaveValue("Control headline");
  await expect(
    variantDrawer.getByRole("textbox", { name: /^Subheadline / }),
  ).toHaveValue("Control subheadline");
  await expect(
    variantDrawer.getByRole("textbox", { name: /^CTA text / }),
  ).toHaveValue("Control CTA");

  await variantDrawer.getByRole("tab", { name: "Design" }).click();
  const previewSurface = variantDrawer.getByTestId("variant-preview-surface");

  await variantDrawer.getByLabel("Font").selectOption("MONO");
  await expect(previewSurface).toHaveCSS("font-family", /Consolas/);

  await variantDrawer.getByLabel("Title size").fill("34");
  await expect(
    previewSurface.locator(".counterpulse-preview-message strong"),
  ).toHaveCSS("font-size", "34px");

  await variantDrawer.getByRole("button", { name: "Boxes" }).click();
  await expect(
    previewSurface.locator(".counterpulse-preview-timer"),
  ).toHaveClass(/counterpulse-preview-timer--boxes/);

  await variantDrawer.getByRole("button", { name: "Colon" }).click();
  await expect(
    previewSurface.locator(".counterpulse-preview-timer"),
  ).toHaveClass(/counterpulse-preview-timer--colon/);
  await expect(
    previewSurface.locator(".counterpulse-preview-timer"),
  ).toContainText("23:59:47");

  await variantDrawer.locator('select[name="icon"]').selectOption("GIFT");
  await expect(
    previewSurface.locator(".counterpulse-preview-icon svg"),
  ).toBeVisible();

  await variantDrawer.getByLabel("Show button").uncheck();
  await expect(previewSurface.locator(".counterpulse-preview-cta")).toHaveCount(
    0,
  );

  await variantDrawer.getByLabel("Closable banner").uncheck();
  await expect(
    previewSurface.locator(".counterpulse-preview-close"),
  ).toHaveCount(0);

  await variantDrawer.getByLabel("Float over page").check();
  await expect(previewSurface).toHaveClass(
    /counterpulse-preview-promo--position-overlay/,
  );

  await variantDrawer.getByLabel("Full width").check();
  await expect(previewSurface).toHaveClass(
    /counterpulse-preview-promo--full-width/,
  );

  await variantDrawer.getByLabel("Entrance effect").selectOption("SLIDE");
  await expect(previewSurface).toHaveClass(
    /counterpulse-preview-promo--enter-slide/,
  );

  await variantDrawer.getByLabel("Timer change").selectOption("FLIP");
  await expect(
    previewSurface.locator(".counterpulse-preview-timer"),
  ).toHaveClass(/counterpulse-preview-timer--tick-flip/);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});
