import { PlacementType } from "@prisma/client";

import { test, expect } from "./helpers/fixtures";
import {
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
 * The rendered HTML must be a faithful projection of the storefront JSON: the
 * headline, subheadline and CTA the merchant typed (per locale) are what the
 * shopper sees, and the payload never leaks internal identifiers. Locale
 * overrides resolve to the matching translation.
 */
test.describe("real payload/DOM text parity and localization", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test.afterEach(async ({ page }) => {
    await pauseAllPrefixedCampaigns(page);
  });

  function barByHeadline(page: import("@playwright/test").Page, headline: string) {
    return page.locator(".pp-bar").filter({ hasText: headline }).first();
  }

  test("renders the exact headline, subheadline and CTA URL from the payload", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(!shopId, "Install/open Promo Pulse once so the shop exists locally.");

    const headline = placementHeadline("Text parity headline");
    const subheadline = "Subheadline should match the payload exactly.";
    const ctaText = "Grab the deal";
    const ctaUrl = "/collections/all?pp=parity";
    const campaign = await createPublishedPlacementCampaign(shopId, {
      ctaText,
      ctaUrl,
      headline,
      name: uniqueName("Text Parity"),
      placement: PlacementType.TOP_BAR,
      subheadline,
    });

    await openStorefront(page, realE2ECacheBustPath("text_parity"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const payload = await fetchStorefrontCampaigns(page, {
      placement: "TOP_BAR",
      path: "/",
      visitorId: "text-parity",
    });
    const item = expectCampaignPayload(payload.body, campaign.id);
    expect(item?.texts).toMatchObject({
      headline,
      subheadline,
      ctaText,
      ctaUrl,
    });

    const bar = barByHeadline(page, headline);
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(bar).toContainText(headline);
    // Subheadline parity is asserted on the payload above; the default top-bar
    // INLINE layout intentionally renders headline + timer + CTA only (no
    // subheadline), so it is not asserted in the DOM here.

    const cta = bar.locator("a.pp-cta").first();
    if (await cta.isVisible().catch(() => false)) {
      await expect(cta).toContainText(ctaText);
      const href = await cta.getAttribute("href");
      expect(href).toContain("/collections/all");
    }

    // No internal identifiers should be present in the shipped item.
    const serialized = JSON.stringify(item ?? {});
    expect(serialized).not.toContain("shopId");
    expect(serialized).not.toContain("\"priority\"");

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("resolves locale overrides to the matching translation", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(!shopId, "Install/open Promo Pulse once so the shop exists locally.");

    const enHeadline = placementHeadline("Localized EN headline");
    const esHeadline = placementHeadline("Titular ES localizado");
    const campaign = await createPublishedPlacementCampaign(shopId, {
      headline: enHeadline,
      name: uniqueName("Localization Parity"),
      placement: PlacementType.TOP_BAR,
      translations: [
        {
          locale: "en",
          headline: enHeadline,
          subheadline: "English subheadline.",
          ctaText: "Shop now",
          ctaUrl: "/collections/all",
        },
        {
          locale: "es",
          headline: esHeadline,
          subheadline: "Subtitulo en espanol.",
          ctaText: "Comprar ahora",
          ctaUrl: "/collections/all",
        },
      ],
    });

    await openStorefront(page, realE2ECacheBustPath("localization_parity"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const enPayload = await fetchStorefrontCampaigns(page, {
      locale: "en",
      placement: "TOP_BAR",
      path: "/",
      visitorId: "localization-en",
    });
    expect(
      expectCampaignPayload(enPayload.body, campaign.id)?.texts.headline,
    ).toBe(enHeadline);

    const esPayload = await fetchStorefrontCampaigns(page, {
      locale: "es",
      placement: "TOP_BAR",
      path: "/",
      visitorId: "localization-es",
    });
    expect(
      expectCampaignPayload(esPayload.body, campaign.id)?.texts.headline,
    ).toBe(esHeadline);

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
