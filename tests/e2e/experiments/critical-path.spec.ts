import type { Page } from "@playwright/test";

import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "../fixtures";

type AuditTouch = {
  eventType: string;
  experimentId: string | null;
  sessionId: string | null;
  variantId: string | null;
  visitorId: string | null;
};

type AuditCampaign = {
  id: string;
  name: string;
  experiments: Array<{
    id: string;
    status: string;
    variants: Array<{ id: string; name: string; weight: number }>;
  }>;
  attributionTouches: AuditTouch[];
  analyticsEvents: Array<{ eventType: string; sessionId: string | null }>;
};

test("a visitor sees one stable variant and interactions keep exact attribution", async ({
  page,
  resetDb,
}) => {
  await resetDb("ab-test");
  await page.addInitScript(() => {
    window.localStorage.setItem("promo_pulse_visitor_id", "critical-visitor");
    window.sessionStorage.setItem("promo_pulse_session_id", "critical-session");
  });

  await page.goto("/__test/storefront");
  const surface = page.locator(".pp-bar").first();

  await expect(surface).toContainText("Variant headline");
  await expect(surface).toContainText("A/B treatment copy.");

  const initial = (await readAudit(page)).campaigns[0];
  const experiment = initial.experiments[0];
  const treatment = experiment.variants.find(
    (variant) => variant.name === "Treatment",
  );

  expect(experiment.status).toBe("RUNNING");
  expect(treatment?.weight).toBe(100);
  await expect
    .poll(async () =>
      countTouches(
        (await readAudit(page)).campaigns[0],
        "critical-session",
        "IMPRESSION",
      ),
    )
    .toBe(1);

  await page.reload();
  await expect(surface).toContainText("Variant headline");
  await expect
    .poll(async () =>
      countTouches(
        (await readAudit(page)).campaigns[0],
        "critical-session",
        "IMPRESSION",
      ),
    )
    .toBe(1);

  await surface.getByRole("link", { name: "Shop variant" }).evaluate((node) => {
    node.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    (node as HTMLElement).click();
  });

  await expect
    .poll(async () =>
      countTouches(
        (await readAudit(page)).campaigns[0],
        "critical-session",
        "CLICK",
      ),
    )
    .toBe(1);

  const finalCampaign = (await readAudit(page)).campaigns[0];
  const visitorTouches = finalCampaign.attributionTouches.filter(
    (touch) => touch.sessionId === "critical-session",
  );
  expect(visitorTouches).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        eventType: "IMPRESSION",
        experimentId: experiment.id,
        variantId: treatment?.id,
      }),
      expect.objectContaining({
        eventType: "CLICK",
        experimentId: experiment.id,
        variantId: treatment?.id,
      }),
    ]),
  );
  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("simultaneous experiments remain isolated and cross-attribution is rejected", async ({
  page,
  resetDb,
}) => {
  await resetDb("experiment-metrics");
  const before = await readAudit(page);
  const first = before.campaigns[0];
  const second = before.campaigns[1];
  const firstExperiment = first.experiments[0];
  const secondExperiment = second.experiments[0];
  const firstVariant = firstExperiment.variants[0];
  const secondVariant = secondExperiment.variants[0];

  const invalid = await postEvent(page, {
    campaignId: first.id,
    experimentId: secondExperiment.id,
    variantId: secondVariant.id,
    visitorId: "cross-visitor",
    sessionId: "cross-session",
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({
    error: "Experiment attribution does not belong to this campaign.",
  });

  expect(
    await postEvent(page, {
      campaignId: first.id,
      experimentId: firstExperiment.id,
      variantId: firstVariant.id,
      visitorId: "first-visitor",
      sessionId: "first-session",
    }),
  ).toBeOK();
  expect(
    await postEvent(page, {
      campaignId: second.id,
      experimentId: secondExperiment.id,
      variantId: secondVariant.id,
      visitorId: "second-visitor",
      sessionId: "second-session",
    }),
  ).toBeOK();

  const after = await readAudit(page);
  const afterFirst = after.campaigns.find(
    (campaign) => campaign.id === first.id,
  )!;
  const afterSecond = after.campaigns.find(
    (campaign) => campaign.id === second.id,
  )!;

  expect(countTouches(afterFirst, "cross-session", "CLICK")).toBe(0);
  expect(countTouches(afterFirst, "first-session", "CLICK")).toBe(1);
  expect(countTouches(afterFirst, "second-session", "CLICK")).toBe(0);
  expect(countTouches(afterSecond, "second-session", "CLICK")).toBe(1);
  expect(countTouches(afterSecond, "first-session", "CLICK")).toBe(0);
});

async function readAudit(page: Page) {
  const response = await page.request.get(
    "/__test/stage2?resource=experiments-and-offers",
  );
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ campaigns: AuditCampaign[] }>;
}

function countTouches(
  campaign: AuditCampaign,
  sessionId: string,
  eventType: string,
) {
  return campaign.attributionTouches.filter(
    (touch) => touch.sessionId === sessionId && touch.eventType === eventType,
  ).length;
}

function postEvent(
  page: Page,
  input: {
    campaignId: string;
    experimentId: string;
    variantId: string;
    visitorId: string;
    sessionId: string;
  },
) {
  return page.request.post("/api/analytics/event", {
    data: {
      shop: "demo-shop.myshopify.com",
      ...input,
      eventType: "CLICK",
      placementType: "TOP_BAR",
      path: "/collections/e2e",
      country: "US",
      locale: "en",
      doNotTrack: false,
      consentGranted: true,
    },
  });
}
