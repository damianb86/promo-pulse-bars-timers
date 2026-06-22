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

      const form = page.locator("[data-campaign-form]");

      await page.goto("/app/campaigns/new");
      await form.getByTestId("campaign-name-input").fill(values.name);
      await selectCampaignTypeCard(form, values.goal);
      await form
        .getByRole("combobox", { name: /^Status$/ })
        .selectOption(values.status);
      await form.getByRole("tab", { name: "Placement" }).click();
      await selectOnlyCampaignPlacement(form, values.placement);
      await form.getByRole("tab", { name: "Schedule" }).click();
      const endDate = form.getByLabel("End date");
      if ((await endDate.count()) > 0) {
        await endDate.fill(
          toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        );
      }
      await selectTimezone(form, "Timezone", "UTC-05", "America/New_York");
      await form.getByRole("tab", { name: "Message" }).click();
      await form.locator('input[name="headline"]').fill(values.headline);
      await form.getByLabel("CTA text").fill(values.ctaText);
      await form.getByLabel("CTA URL").fill(values.ctaUrl);
      await form.locator('textarea[name="subheadline"]').fill(values.subheadline);
      await form.getByRole("button", { name: "Save campaign" }).click();
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

export async function selectCampaignTypeCard(scope: Locator | Page, label: string) {
  await scope
    .getByRole("radio", {
      name: new RegExp(`^${escapeRegExp(label)}\\b`),
    })
    .click();
}

export async function selectOnlyCampaignPlacement(
  scope: Locator | Page,
  placement: string,
) {
  const label = placementLabel(placement);
  const target = scope.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(label)}\\b`),
  });

  await target.click();

  if (placement !== "TOP_BAR") {
    const topBar = scope.getByRole("button", { name: /^Top bar\b/ });

    if ((await topBar.getAttribute("aria-pressed")) === "true") {
      await topBar.click();
    }
  }
}

export async function publishCurrentCampaign(page: Page) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.getByTestId("campaign-publish-button").click(),
  ]);
}

export async function saveCurrentCampaignDraft(page: Page) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/app/campaigns/") &&
        response.request().method() === "POST",
    ),
    page.locator("ui-save-bar").getByRole("button", { name: "Save" }).click(),
  ]);
}

function placementLabel(value: string) {
  const labels: Record<string, string> = {
    BOTTOM_BAR: "Bottom bar",
    CART_DRAWER: "Cart drawer",
    CART_PAGE: "Cart page",
    COLLECTION_CARD: "Collection card",
    CUSTOM_SELECTOR: "Custom selector",
    ORDER_STATUS_PAGE: "Order status page",
    PASSWORD_PAGE: "Password page",
    PRODUCT_PAGE: "Product page",
    THANK_YOU_PAGE: "Thank you page",
    TOP_BAR: "Top bar",
  };

  return labels[value] ?? value;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
