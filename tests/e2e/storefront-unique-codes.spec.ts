import type { Page } from "@playwright/test";

import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

test("storefront unique codes are visitor-scoped and track actions", async ({
  browser,
  page,
  resetDb,
}) => {
  await resetDb("unique-discount");
  await setStorefrontIdentity(page, "visitor-one", "session-one");
  await page.goto("/__test/storefront");

  const widget = page.locator(".pp-unique-code").first();
  const codeValue = widget.locator(".pp-unique-code__value");
  await expect(codeValue).toHaveText(/^E2E-/);
  const firstCode = (await codeValue.textContent()) ?? "";

  await expect(
    widget.getByRole("button", { name: /Copy code/i }),
  ).toBeVisible();
  await expect(
    widget.getByRole("link", { name: /Apply discount/i }),
  ).toHaveAttribute(
    "href",
    new RegExp("^/discount/" + escapeRegExp(firstCode)),
  );

  await page.reload();
  await expect(page.locator(".pp-unique-code__value").first()).toHaveText(
    firstCode,
  );

  await page
    .getByRole("button", { name: /Copy code/i })
    .first()
    .click();
  await page
    .locator(".pp-unique-code .pp-cta")
    .first()
    .evaluate((element) => {
      element.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      });
      (element as HTMLElement).click();
    });

  await expect
    .poll(async () => {
      const response = await page.request.get("/__test/analytics-summary");
      return response.json();
    })
    .toMatchObject({
      copyCode: 1,
      applyCodeClicked: 1,
    });

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await setStorefrontIdentity(secondPage, "visitor-two", "session-two");
  await secondPage.goto(new URL("/__test/storefront", page.url()).toString());
  await expect(secondPage.locator(".pp-unique-code__value").first()).toHaveText(
    /^E2E-/,
  );
  const secondCode =
    (await secondPage
      .locator(".pp-unique-code__value")
      .first()
      .textContent()) ?? "";
  expect(secondCode).not.toBe(firstCode);
  await secondContext.close();

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("storefront unique code widget shows expired text when no code is available", async ({
  page,
  resetDb,
}) => {
  await resetDb("unique-discount-expired");
  await setStorefrontIdentity(page, "expired-visitor", "expired-session");
  await page.goto("/__test/storefront");

  await expect(page.locator(".pp-unique-code__expired").first()).toContainText(
    "This offer has ended.",
  );
  await expect(page.locator(".pp-unique-code__value")).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

async function setStorefrontIdentity(
  page: Page,
  visitorId: string,
  sessionId: string,
) {
  await page.addInitScript(
    ({ visitorId: nextVisitorId, sessionId: nextSessionId }) => {
      window.localStorage.setItem("promo_pulse_visitor_id", nextVisitorId);
      window.sessionStorage.setItem("promo_pulse_session_id", nextSessionId);
    },
    { visitorId, sessionId },
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
