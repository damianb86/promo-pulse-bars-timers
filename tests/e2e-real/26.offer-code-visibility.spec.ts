import { PlacementType } from "@prisma/client";

import { test, expect } from "./helpers/fixtures";
import {
  DISCOUNT_CODE_PREFIX,
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import { pauseAllPrefixedCampaigns } from "./helpers/admin-app";
import {
  createPublishedPlacementCampaign,
  findRealE2EShopId,
  placementHeadline,
} from "./helpers/placement-fixtures";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";
import {
  expectCampaignPayload,
  fetchStorefrontCampaigns,
} from "./helpers/storefront-api";

/**
 * Offer / discount-code visibility contract. The backend decides whether a
 * discount code is exposed; the storefront payload and DOM must honor that
 * decision exactly. A hidden code must never reach the browser (payload or DOM),
 * while the campaign itself keeps rendering. Internal discount bookkeeping
 * (pool prefix, Shopify discount id) must never leak to the storefront.
 */
test.describe("real offer and discount-code visibility", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test.afterEach(async ({ page }) => {
    await pauseAllPrefixedCampaigns(page);
  });

  function barByHeadline(page: import("@playwright/test").Page, headline: string) {
    return page.locator(".pp-bar").filter({ hasText: headline }).first();
  }

  test("exposes a visible discount code in the payload and DOM", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(!shopId, "Install/open Promo Pulse once so the shop exists locally.");

    const code = `${DISCOUNT_CODE_PREFIX}VISIBLE10`;
    const headline = placementHeadline("Visible discount code");
    const campaign = await createPublishedPlacementCampaign(shopId, {
      discountCode: code,
      discountShowCode: true,
      headline,
      name: uniqueName("Offer Visible Code"),
      placement: PlacementType.TOP_BAR,
    });

    await openStorefront(page, realE2ECacheBustPath("offer_visible"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const payload = await fetchStorefrontCampaigns(page, {
      placement: "TOP_BAR",
      path: "/",
      visitorId: "offer-visible-code",
    });
    const item = expectCampaignPayload(payload.body, campaign.id);
    expect(item?.discount).toMatchObject({ method: "CODE", discountCode: code });

    const bar = barByHeadline(page, headline);
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(
      bar.locator(".pp-discount-code__value").first(),
    ).toHaveText(new RegExp(code, "i"), { timeout: 30_000 });

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("hides the code from the payload and DOM while still rendering the bar", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(!shopId, "Install/open Promo Pulse once so the shop exists locally.");

    const code = `${DISCOUNT_CODE_PREFIX}HIDDEN10`;
    const headline = placementHeadline("Hidden discount code");
    const campaign = await createPublishedPlacementCampaign(shopId, {
      discountCode: code,
      discountShowCode: false,
      headline,
      name: uniqueName("Offer Hidden Code"),
      placement: PlacementType.TOP_BAR,
    });

    await openStorefront(page, realE2ECacheBustPath("offer_hidden"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const payload = await fetchStorefrontCampaigns(page, {
      placement: "TOP_BAR",
      path: "/",
      visitorId: "offer-hidden-code",
    });
    const item = expectCampaignPayload(payload.body, campaign.id);
    // The offer still exists (method retained) but the code must be stripped.
    expect(item?.discount?.method).toBe("CODE");
    expect(item?.discount?.discountCode).toBeUndefined();
    expect(JSON.stringify(item ?? {})).not.toContain(code);

    // The campaign still renders - only the code element is absent.
    const bar = barByHeadline(page, headline);
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(bar.locator(".pp-discount-code__value")).toHaveCount(0);
    expect(await bar.textContent()).not.toContain(code);

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("serves the unique-code assignment contract without leaking internals", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(!shopId, "Install/open Promo Pulse once so the shop exists locally.");

    const prefix = `${DISCOUNT_CODE_PREFIX}U${Date.now().toString(36).toUpperCase()}`;
    const headline = placementHeadline("Unique code contract");
    const campaign = await createPublishedPlacementCampaign(shopId, {
      headline,
      name: uniqueName("Offer Unique Code"),
      placement: PlacementType.TOP_BAR,
      uniqueCodeCount: 5,
      uniqueCodePrefix: prefix,
    });

    await openStorefront(page, realE2ECacheBustPath("offer_unique"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const payload = await fetchStorefrontCampaigns(page, {
      placement: "TOP_BAR",
      path: "/",
      visitorId: "offer-unique-contract",
    });
    const item = expectCampaignPayload(payload.body, campaign.id);
    expect(item?.discount).toMatchObject({
      method: "UNIQUE_CODE",
      uniqueCode: expect.objectContaining({
        endpoint: "/api/storefront/unique-code/assign",
        autoApply: true,
        expiresMinutes: 60,
      }),
    });

    // Internal bookkeeping must never be shipped to the browser.
    const serialized = JSON.stringify(item ?? {});
    expect(serialized).not.toContain("uniqueCodePrefix");
    expect(serialized).not.toContain("poolId");
    expect(serialized).not.toContain("shopifyDiscountId");
    // No pre-generated code value should be pushed before assignment.
    expect(serialized).not.toContain(`${prefix}-001`);

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
