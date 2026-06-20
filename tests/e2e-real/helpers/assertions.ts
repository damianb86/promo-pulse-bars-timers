import type { Locator, Page } from "@playwright/test";

import { expect, getConsoleErrors, getFailedRequests } from "./fixtures";

export async function expectNoConsoleErrors(page: Page) {
  expect(getConsoleErrors(page)).toEqual([]);
}

export async function expectNoFailedCriticalRequests(page: Page) {
  expect(getFailedRequests(page)).toEqual([]);
}

export async function expectCampaignVisible(
  page: Page,
  campaignNameOrText: string,
) {
  await expect(
    page.getByText(campaignNameOrText, { exact: false }).first(),
  ).toBeVisible({ timeout: 20_000 });
}

export async function expectCampaignNotVisible(
  page: Page,
  campaignNameOrText: string,
) {
  await expect(
    page.getByText(campaignNameOrText, { exact: false }).first(),
  ).toHaveCount(0);
}

export async function expectWidgetNotDuplicated(
  page: Page,
  selector: string,
) {
  await expect(page.locator(selector)).toHaveCount(1);
}

export async function expectMetricEventuallyChanges(
  locator: Locator,
  previousText: string,
) {
  await expect
    .poll(async () => (await locator.textContent())?.trim() ?? "", {
      timeout: 60_000,
    })
    .not.toBe(previousText);
}

export async function expectToastSuccess(page: Page) {
  await expect(
    page
      .locator('s-banner[tone="success"], [role="status"], .counterpulse-toast')
      .filter({ hasText: /saved|updated|success|created|generated/i })
      .first(),
  ).toBeVisible({ timeout: 15_000 });
}

export function promoBarLocator(page: Page) {
  return page.locator('[data-testid="promo-bar"], .pp-bar').first();
}

export function promoTimerLocator(page: Page) {
  return page.locator('[data-testid="promo-timer"], .pp-countdown').first();
}

export function freeShippingProgressLocator(page: Page) {
  return page
    .locator('[data-testid="free-shipping-progress"], .pp-progress__track')
    .first();
}

export function cartDrawerWidgetLocator(page: Page) {
  return page
    .locator('[data-testid="cart-drawer-widget"], .pp-cart-drawer-slot')
    .first();
}

export function uniqueCodeLocator(page: Page) {
  return page
    .locator('[data-testid="unique-code"], .pp-unique-code__value')
    .first();
}

export function copyCodeButtonLocator(page: Page) {
  return page
    .locator('[data-testid="copy-code-button"], button.pp-code')
    .filter({ hasText: /copy|[A-Z0-9]/i })
    .first();
}
