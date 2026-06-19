import type { Page } from "@playwright/test";

import { expect } from "./fixtures";

export const demoShopDomain = "demo-shop.myshopify.com";

export async function setStorefrontIdentity(
  page: Page,
  visitorId: string,
  sessionId = `${visitorId}-session`,
) {
  await page.addInitScript(
    ({ visitorId: nextVisitorId, sessionId: nextSessionId }) => {
      window.localStorage.setItem("counterpulse_visitor_id", nextVisitorId);
      window.sessionStorage.setItem("counterpulse_session_id", nextSessionId);
    },
    { visitorId, sessionId },
  );
}

export async function readAnalyticsSummary(page: Page) {
  const response = await page.request.get("/__test/analytics-summary");

  expect(response.ok()).toBe(true);

  return response.json() as Promise<Record<string, number>>;
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toLocalDateTime(date: Date) {
  return date.toISOString().slice(0, 16);
}

export function readPngSize(buffer: Buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}
