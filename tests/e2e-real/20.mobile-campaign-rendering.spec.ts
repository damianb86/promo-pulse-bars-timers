import { CampaignType, PlacementType } from "@prisma/client";

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
  expectNoHorizontalOverflow,
  expectPlacementPosition,
  expectPromoFitsViewport,
  expectPromoTextFits,
  expectPublishedDesignApplied,
} from "./helpers/layout";
import {
  expectNoConsoleErrors,
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";

test.describe("real mobile storefront campaign rendering", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test.afterEach(async ({ page }) => {
    await pauseAllPrefixedCampaigns(page);
  });

  test("renders mobile global bars without overflow or clipped copy", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );

    const top = await createPublishedPlacementCampaign(shopId, {
      design: {
        backgroundColor: "#0E7490",
        fullWidth: true,
      },
      headline: placementHeadline("Mobile top bar"),
      name: uniqueName("Mobile Top Bar"),
      placement: PlacementType.TOP_BAR,
      subheadline: "Compact mobile copy should stay readable.",
      type: CampaignType.COUNTDOWN_BAR,
    });
    const bottom = await createPublishedPlacementCampaign(shopId, {
      design: {
        backgroundColor: "#7C2D12",
        fullWidth: true,
      },
      headline: placementHeadline("Mobile bottom bar"),
      name: uniqueName("Mobile Bottom Bar"),
      placement: PlacementType.BOTTOM_BAR,
      subheadline: "Bottom mobile copy should not overlap.",
      type: CampaignType.COUNTDOWN_BAR,
    });

    await openStorefront(page, realE2ECacheBustPath("mobile_global"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const topBar = page
      .locator('[data-testid="promo-bar"], .pp-bar')
      .filter({ hasText: top.headline })
      .first();
    const bottomBar = page
      .locator('[data-testid="promo-bar"], .pp-bar')
      .filter({ hasText: bottom.headline })
      .first();

    await expect(topBar).toBeVisible({ timeout: 30_000 });
    await expect(bottomBar).toBeVisible({ timeout: 30_000 });
    await expectPlacementPosition(page, topBar, "TOP_BAR");
    await expectPlacementPosition(page, bottomBar, "BOTTOM_BAR");
    await expectPublishedDesignApplied(topBar, top.design, "mobile top bar");
    await expectPublishedDesignApplied(
      bottomBar,
      bottom.design,
      "mobile bottom bar",
    );
    await expectPromoFitsViewport(topBar, "mobile top bar");
    await expectPromoFitsViewport(bottomBar, "mobile bottom bar");
    await expectPromoTextFits(topBar, "mobile top bar");
    await expectPromoTextFits(bottomBar, "mobile bottom bar");
    await expectNoHorizontalOverflow(page);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("renders mobile free-shipping cart module with progress visible", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );

    const freeShipping = await createPublishedPlacementCampaign(shopId, {
      freeShipping: {
        currencyCode: "USD",
        thresholdAmount: 60,
      },
      headline: placementHeadline("Mobile free shipping"),
      name: uniqueName("Mobile Free Shipping"),
      placement: PlacementType.CART_PAGE,
      subheadline: "Mobile cart progress should remain legible.",
      type: CampaignType.FREE_SHIPPING_GOAL,
    });

    await openStorefront(
      page,
      `/cart?utm_source=real_e2e_mobile_cart_${Date.now()}`,
    );
    await expectStorefrontEmbedOrSkip(page, testInfo);
    const cartCard = page
      .locator(".pp-cart-card")
      .filter({ hasText: freeShipping.headline })
      .first();

    if (!(await cartCard.isVisible({ timeout: 30_000 }).catch(() => false))) {
      testInfo.skip(
        true,
        "Add the Promo Pulse cart timer/free-shipping block to the cart page template.",
      );
    }

    await expect(cartCard.getByRole("progressbar").first()).toBeVisible();
    await expectPromoFitsViewport(cartCard, "mobile free shipping cart");
    await expectPromoTextFits(cartCard, "mobile free shipping cart");
    await expectNoHorizontalOverflow(page);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
