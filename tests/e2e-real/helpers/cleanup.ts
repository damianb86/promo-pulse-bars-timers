import type { Page, APIRequestContext } from "@playwright/test";

import { deleteCampaignIfExists, pauseAllPrefixedCampaigns } from "./admin-app";
import { cleanupE2EDiscounts, cleanupE2EProducts } from "./shopify-admin-api";
import { E2E_PREFIX, getConfig } from "./env";

export async function cleanupE2ECampaigns(page: Page) {
  const config = getConfig();
  if (!config.cleanup) return;

  await pauseAllPrefixedCampaigns(page);
}

export async function cleanupE2EDiscountsSafe(request: APIRequestContext) {
  await cleanupE2EDiscounts(request);
}

export async function cleanupE2EProductsSafe(request: APIRequestContext) {
  await cleanupE2EProducts(request);
}

export async function deleteKnownPrefixedCampaigns(
  page: Page,
  names: string[],
) {
  const config = getConfig();
  if (!config.cleanup) return;

  for (const name of names) {
    if (name.startsWith(E2E_PREFIX)) {
      await deleteCampaignIfExists(page, name);
    }
  }
}
