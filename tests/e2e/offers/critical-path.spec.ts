import type { Page } from "@playwright/test";

import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "../fixtures";

type OfferAudit = {
  campaigns: Array<{
    id: string;
    discountSync: {
      method: string;
      uniqueCodeAutoApply: boolean;
    } | null;
    discountCodePools: Array<{
      status: string;
      totalGenerated: number;
      codes: Array<{
        code: string;
        status: string;
        visitorId: string | null;
        sessionId: string | null;
      }>;
    }>;
    analyticsEvents: Array<{
      eventType: string;
      sessionId: string | null;
    }>;
  }>;
};

test("a unique offer is assigned, rendered, and tracked for the same visitor", async ({
  page,
  resetDb,
}) => {
  await resetDb("unique-discount");
  await page.goto(
    "/__test/storefront?visitorId=offer-critical-visitor&sessionId=offer-critical-session",
  );

  const offer = page.locator(".pp-unique-code").first();
  const code = offer.locator(".pp-unique-code__value");
  await expect(code).toHaveText(/^E2E-VISITOR-/);
  const assignedCode = (await code.textContent())!;

  await offer.getByRole("button", { name: /Copy code/i }).click();
  await offer.locator(".pp-cta").evaluate((node) => {
    node.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    (node as HTMLElement).click();
  });

  await expect
    .poll(async () => {
      const campaign = (await readAudit(page)).campaigns[0];
      return campaign.analyticsEvents.filter(
        (event) => event.sessionId === "offer-critical-session",
      );
    })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "UNIQUE_CODE_ASSIGNED" }),
        expect.objectContaining({ eventType: "COPY_CODE" }),
        expect.objectContaining({ eventType: "APPLY_CODE_CLICKED" }),
      ]),
    );

  const campaign = (await readAudit(page)).campaigns[0];
  expect(campaign.discountSync).toMatchObject({
    method: "UNIQUE_CODE",
    uniqueCodeAutoApply: true,
  });
  expect(campaign.discountCodePools).toHaveLength(1);
  expect(campaign.discountCodePools[0]).toMatchObject({
    status: "ACTIVE",
    totalGenerated: 4,
  });
  expect(campaign.discountCodePools[0].codes).toContainEqual(
    expect.objectContaining({
      code: assignedCode,
      status: "ASSIGNED",
      visitorId: "offer-critical-visitor",
      sessionId: "offer-critical-session",
    }),
  );
  const sessionEvents = campaign.analyticsEvents.filter(
    (event) => event.sessionId === "offer-critical-session",
  );
  expect(
    sessionEvents.filter((event) => event.eventType === "COPY_CODE"),
  ).toHaveLength(1);
  expect(
    sessionEvents.filter((event) => event.eventType === "APPLY_CODE_CLICKED"),
  ).toHaveLength(1);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

async function readAudit(page: Page) {
  const response = await page.request.get(
    "/__test/stage2?resource=experiments-and-offers",
  );
  expect(response.ok()).toBe(true);
  return response.json() as Promise<OfferAudit>;
}
