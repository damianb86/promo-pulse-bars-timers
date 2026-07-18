import {
  DesignBackgroundType,
  DesignLayout,
  DesignPositionMode,
  PlacementType,
} from "@prisma/client";
import type { Page } from "@playwright/test";

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
import { syncStorefrontInlineConfigForShopId } from "./helpers/inline-config";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  expectNoHorizontalOverflow,
  expectPromoFitsViewport,
  expectPromoTextFits,
  readSurfaceProfile,
} from "./helpers/layout";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";

/**
 * Aggressive edge cases meant to surface real rendering defects rather than
 * confirm the happy path: every non-inline layout must render its subheadline
 * and stay inside the viewport, image backgrounds must resolve, a hostile
 * custom-CSS `</style>` breakout must be neutralised, and pathologically long
 * copy must not blow out the page horizontally.
 */
test.describe("real storefront render edge cases", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test.afterEach(async ({ page }) => {
    await pauseAllPrefixedCampaigns(page);
  });

  function barByHeadline(page: Page, headline: string) {
    return page.locator(".pp-bar").filter({ hasText: headline }).first();
  }

  // Non-inline layouts must each render the subheadline (INLINE is the only
  // layout that intentionally drops it) and stay within the viewport.
  const NON_INLINE_LAYOUTS: DesignLayout[] = [
    DesignLayout.STANDARD,
    DesignLayout.BALANCED,
    DesignLayout.BALANCED_REVERSE,
    DesignLayout.STACKED_WIDE,
    DesignLayout.COMPACT_STACK,
    DesignLayout.CTA_RIGHT,
    DesignLayout.CTA_LEFT,
    DesignLayout.CTA_TOP,
    DesignLayout.HERO_TIMER,
    DesignLayout.SPREAD,
  ];

  test("renders every non-inline layout with its subheadline and no overflow", async ({
    page,
  }, testInfo) => {
    // Creates one campaign per layout; give the batch room beyond the default.
    test.setTimeout(240_000);
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(!shopId, "Install/open Promo Pulse once so the shop exists locally.");

    const cases: Array<{ layout: DesignLayout; headline: string; sub: string }> =
      [];
    for (const layout of NON_INLINE_LAYOUTS) {
      // Trailing marker keeps one enum name from being a substring of another
      // (e.g. BALANCED vs BALANCED_REVERSE) so the hasText bar filter is exact.
      const headline = placementHeadline(`Layout ${layout} ::end`);
      const sub = `Subheadline ${layout} ::end must be visible.`;
      cases.push({ layout, headline, sub });
      await createPublishedPlacementCampaign(shopId, {
        headline,
        name: uniqueName(`Layout ${layout}`),
        placement: PlacementType.TOP_BAR,
        subheadline: sub,
        design: { layout },
        // Sync the metafield once after the whole batch (below) instead of per
        // campaign - N Admin API round-trips would blow the test budget.
        skipInlineConfigSync: true,
      });
    }
    await syncStorefrontInlineConfigForShopId(shopId);

    await openStorefront(page, realE2ECacheBustPath("layout_matrix"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const failures: string[] = [];
    for (const { layout, headline, sub } of cases) {
      const bar = barByHeadline(page, headline);
      if (!(await bar.isVisible({ timeout: 30_000 }).catch(() => false))) {
        failures.push(`${layout}: bar did not render`);
        continue;
      }

      const className = await bar.evaluate((el) => el.className);
      if (!className.includes(`layout-${layout.toLowerCase()}`)) {
        failures.push(`${layout}: missing layout class (got "${className}")`);
      }
      const subVisible = await bar
        .getByText(sub, { exact: false })
        .first()
        .isVisible({ timeout: 8_000 })
        .catch(() => false);
      if (!subVisible) {
        failures.push(`${layout}: subheadline not rendered`);
      }
      await expectPromoFitsViewport(bar, `${layout} bar`);
      await expectPromoTextFits(bar, `${layout} bar`);
    }

    expect(failures, failures.join("\n")).toEqual([]);
    await expectNoHorizontalOverflow(page);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("renders an image background with overlay and no overflow", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(!shopId, "Install/open Promo Pulse once so the shop exists locally.");

    const headline = placementHeadline("Image background edge");
    // A stable, always-reachable data URL keeps the test about CSS composition
    // (image + overlay) rather than the reachability of an external asset.
    const imageUrl =
      "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
    await createPublishedPlacementCampaign(shopId, {
      headline,
      name: uniqueName("Image Background"),
      placement: PlacementType.TOP_BAR,
      subheadline: "Text must stay readable over the image.",
      design: { layout: DesignLayout.STANDARD },
      designExtras: {
        backgroundType: DesignBackgroundType.IMAGE,
        backgroundImageUrl: imageUrl,
      },
    });

    await openStorefront(page, realE2ECacheBustPath("image_bg"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const bar = barByHeadline(page, headline);
    await expect(bar).toBeVisible({ timeout: 30_000 });

    const profile = await readSurfaceProfile(bar, ["--cp-surface-bg"]);
    // The surface background must reference the image plus the readability overlay.
    expect(profile.cssVars["--cp-surface-bg"]).toContain("url(");
    expect(profile.cssVars["--cp-surface-bg"]).toContain("linear-gradient");

    await expectPromoFitsViewport(bar, "image bg bar");
    await expectPromoTextFits(bar, "image bg bar");
    await expectNoHorizontalOverflow(page);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("neutralises a hostile </style> custom-CSS breakout attempt", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(!shopId, "Install/open Promo Pulse once so the shop exists locally.");

    const headline = placementHeadline("CSS breakout edge");
    await createPublishedPlacementCampaign(shopId, {
      headline,
      name: uniqueName("CSS Breakout"),
      placement: PlacementType.TOP_BAR,
      design: { layout: DesignLayout.STANDARD },
      designExtras: {
        customCss:
          ".pp-message{color:#fff}</style><script>window.__ppPwned=true;</script><style>",
      },
    });

    await openStorefront(page, realE2ECacheBustPath("css_breakout"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    let bar = barByHeadline(page, headline);
    // The deployed storefront/metafield can lag a beat; reload once (fresh
    // cache-buster) before failing so this asserts the sanitiser, not timing.
    if (!(await bar.isVisible({ timeout: 15_000 }).catch(() => false))) {
      await openStorefront(page, realE2ECacheBustPath("css_breakout_retry"));
      bar = barByHeadline(page, headline);
    }
    await expect(bar).toBeVisible({ timeout: 30_000 });

    // The injected style must not carry a raw </style> breakout, and the
    // embedded <script> must never execute.
    const injected = await bar.evaluate((el) =>
      Array.from(el.querySelectorAll("style"))
        .map((style) => style.textContent || "")
        .join("\n"),
    );
    expect(injected.toLowerCase()).not.toContain("</style");
    expect(injected.toLowerCase()).not.toContain("<script");

    const pwned = await page.evaluate(
      () => (window as unknown as { __ppPwned?: boolean }).__ppPwned === true,
    );
    expect(pwned, "custom CSS must not be able to run scripts").toBe(false);

    await expectNoHorizontalOverflow(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("contains pathologically long copy without horizontal overflow", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(!shopId, "Install/open Promo Pulse once so the shop exists locally.");

    const headline = placementHeadline("Long copy edge");
    const longWord = "Supercalifragilisticexpialidocious".repeat(6);
    await createPublishedPlacementCampaign(shopId, {
      headline,
      name: uniqueName("Long Copy"),
      placement: PlacementType.TOP_BAR,
      subheadline: `${longWord} ${longWord} save big today ${longWord}`,
      design: { layout: DesignLayout.STANDARD },
      designExtras: { positionMode: DesignPositionMode.FLOW },
    });

    await openStorefront(page, realE2ECacheBustPath("long_copy"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const bar = barByHeadline(page, headline);
    await expect(bar).toBeVisible({ timeout: 30_000 });

    await expectPromoFitsViewport(bar, "long copy bar");
    // The unbroken long words must not push the page wider than the viewport.
    await expectNoHorizontalOverflow(page);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
