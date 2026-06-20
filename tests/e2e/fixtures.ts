/* eslint-disable react-hooks/rules-of-hooks */
import {
  expect,
  test as base,
  type Locator,
  type Page,
} from "@playwright/test";

type E2EFixtures = {
  resetDb: (scenario?: string) => Promise<void>;
  loginAsDemoShop: (returnTo?: string) => Promise<void>;
  createCampaignViaUI: (
    options?: Partial<{
      name: string;
      goal: string;
      type: string;
      placement: string;
      status: string;
      headline: string;
      subheadline: string;
      ctaText: string;
      ctaUrl: string;
    }>,
  ) => Promise<string>;
};

const consoleErrorsByPage = new WeakMap<Page, string[]>();
const failedRequestsByPage = new WeakMap<Page, string[]>();

export const test = base.extend<E2EFixtures>({
  page: async ({ page }, use) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    consoleErrorsByPage.set(page, consoleErrors);
    failedRequestsByPage.set(page, failedRequests);

    page.on("console", (message) => {
      if (message.type() === "error") {
        if (isIgnoredConsoleError(message.text())) {
          return;
        }
        consoleErrors.push(message.text());
      }
    });

    page.on("pageerror", (error) => {
      if (isIgnoredConsoleError(error.message)) {
        return;
      }
      consoleErrors.push(error.message);
    });

    page.on("requestfailed", (request) => {
      const url = request.url();
      const failureText = request.failure()?.errorText;
      if (url.includes("/favicon.ico")) return;
      if (
        url.startsWith("https://cdn.shopify.com/") &&
        failureText === "net::ERR_ABORTED"
      ) {
        return;
      }
      if (
        url.includes("/api/analytics/event") &&
        failureText === "net::ERR_ABORTED"
      ) {
        return;
      }
      if (
        new URL(url).pathname.endsWith(".data") &&
        failureText === "net::ERR_ABORTED"
      ) {
        return;
      }
      if (
        new URL(url).pathname === "/__manifest" &&
        failureText === "net::ERR_ABORTED"
      ) {
        return;
      }
      failedRequests.push(`${request.method()} ${url}: ${failureText}`);
    });

    await use(page);
  },

  resetDb: async ({ page }, use) => {
    await use(async (scenario = "empty") => {
      const response = await page.request.post(
        `/__test/reset-db?scenario=${encodeURIComponent(scenario)}`,
      );
      expect(response.ok()).toBe(true);
    });
  },

  loginAsDemoShop: async ({ page }, use) => {
    await use(async (returnTo = "/app") => {
      await page.goto(`/__test/login?returnTo=${encodeURIComponent(returnTo)}`);
      await page.waitForURL((url) => url.pathname === returnTo.split("?")[0]);
    });
  },

  createCampaignViaUI: async ({ page }, use) => {
    await use(async (options = {}) => {
      const values = {
        name: "E2E Flash Sale Countdown",
        goal: "Flash sale",
        type: "COUNTDOWN_BAR",
        placement: "TOP_BAR",
        status: "DRAFT",
        headline: "Sale ends soon",
        subheadline: "Save before midnight.",
        ctaText: "Shop sale",
        ctaUrl: "/collections/sale",
        ...options,
      };

      await page.goto("/app/campaigns/new");
      await page.getByLabel("Campaign name").fill(values.name);
      await page.getByRole("radio", { exact: true, name: values.goal }).click();
      await page.getByLabel("Campaign type").selectOption(values.type);
      await page
        .getByRole("combobox", { name: /^Status$/ })
        .selectOption(values.status);
      await page.getByRole("tab", { name: "Placement" }).click();
      await page.getByLabel("Primary placement").selectOption(values.placement);
      await page.getByRole("tab", { name: "Schedule" }).click();
      await page
        .getByLabel("End date/time")
        .fill(toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)));
      await selectTimezone(page, "Timezone", "UTC-05", "America/New_York");
      await page.getByRole("tab", { name: "Message" }).click();
      await page.locator('input[name="headline"]').fill(values.headline);
      await page.getByLabel("CTA text").fill(values.ctaText);
      await page.getByLabel("CTA URL").fill(values.ctaUrl);
      await page
        .locator('textarea[name="subheadline"]')
        .fill(values.subheadline);
      await page.getByRole("button", { name: "Save campaign" }).click();
      await confirmAction(page, "Save campaign");
      await page.waitForURL((url) => {
        const segments = url.pathname.split("/").filter(Boolean);
        return (
          segments.length === 3 &&
          segments[0] === "app" &&
          segments[1] === "campaigns" &&
          segments[2] !== "new"
        );
      });

      return page.url().split("/app/campaigns/")[1] ?? "";
    });
  },
});

export { expect } from "@playwright/test";

export function expectNoConsoleErrors(page: Page) {
  expect(
    (consoleErrorsByPage.get(page) ?? []).filter(
      (message) => !isIgnoredConsoleError(message),
    ),
  ).toEqual([]);
}

export function expectNoFailedRequests(page: Page) {
  expect(failedRequestsByPage.get(page) ?? []).toEqual([]);
}

export async function getAnalyticsSummary(page: Page) {
  const response = await page.request.post("/api/analytics/event", {
    data: {
      shop: "demo-shop.myshopify.com",
      campaignId: "missing",
      eventType: "IMPRESSION",
    },
  });

  return response.status();
}

export async function confirmAction(page: Page, confirmLabel: string | RegExp) {
  const dialog = page.getByRole("dialog");

  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: confirmLabel }).click();
}

export async function selectTimezone(
  scope: Page | Locator,
  label: string,
  search: string,
  optionText: string | RegExp,
) {
  const combobox = scope.getByRole("combobox", { name: label });

  await combobox.fill(search);
  await scope.getByRole("option", { name: optionText }).first().click();
}

function toDateTimeLocal(date: Date) {
  return date.toISOString().slice(0, 16);
}

function isIgnoredConsoleError(message: string) {
  return (
    message.includes(
      "App Bridge Next: missing required configuration fields: shop",
    ) ||
    message.includes("Outdated Optimize Dep") ||
    message.includes("Failed to fetch manifest patches")
  );
}
