import { CampaignType, PlacementType, Prisma } from "@prisma/client";

import prisma from "../../app/db.server";
import { publishCampaignForShop } from "../../app/models/campaign.server";
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
} from "./helpers/storefront";
import {
  expectCampaignPayload,
  fetchStorefrontCampaigns,
} from "./helpers/storefront-api";

test.describe("real campaign types, targeting, schedule, and cache", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test.afterEach(async ({ page }) => {
    await pauseAllPrefixedCampaigns(page);
  });

  test("serves every campaign type with expected placement-specific settings", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );

    const countdown = await createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline("Type matrix countdown"),
      name: uniqueName("Type Countdown"),
      placement: PlacementType.TOP_BAR,
      targeting: {
        devices: ["desktop"],
        urlContains: ["page:home"],
        utmSources: ["type_matrix"],
      },
      type: CampaignType.COUNTDOWN_BAR,
    });
    const freeShipping = await createPublishedPlacementCampaign(shopId, {
      freeShipping: {
        currencyCode: "USD",
        thresholdAmount: 95,
        thresholdRules: {
          markets: {
            ES: 80,
          },
        } satisfies Prisma.InputJsonValue,
      },
      headline: placementHeadline("Type matrix free shipping"),
      name: uniqueName("Type Free Shipping"),
      placement: PlacementType.CART_PAGE,
      type: CampaignType.FREE_SHIPPING_GOAL,
    });
    const deliveryCutoff = await createPublishedPlacementCampaign(shopId, {
      deliveryCutoff: {
        cutoffHour: 14,
        cutoffMinute: 30,
        minDeliveryDays: 2,
        maxDeliveryDays: 4,
      },
      headline: placementHeadline("Type matrix delivery cutoff"),
      name: uniqueName("Type Delivery Cutoff"),
      placement: PlacementType.TOP_BAR,
      type: CampaignType.DELIVERY_CUTOFF,
    });
    const productTimer = await createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline("Type matrix product timer"),
      name: uniqueName("Type Product Timer"),
      placement: PlacementType.PRODUCT_PAGE,
      targeting: {
        productTags: ["pp-e2e"],
      },
      type: CampaignType.PRODUCT_TIMER,
    });
    const lowStock = await createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline("Type matrix low stock"),
      lowStock: {
        fallbackMessage: "Only a few E2E units left.",
        showExactQuantity: false,
        threshold: 6,
      },
      name: uniqueName("Type Low Stock"),
      placement: PlacementType.PRODUCT_PAGE,
      targeting: {
        productTags: ["pp-e2e"],
      },
      type: CampaignType.LOW_STOCK,
    });
    const badge = await createPublishedPlacementCampaign(shopId, {
      badgeText: placementHeadline("Type matrix badge"),
      headline: placementHeadline("Type matrix badge"),
      name: uniqueName("Type Product Badge"),
      placement: PlacementType.COLLECTION_CARD,
      type: CampaignType.PRODUCT_BADGE,
    });
    const cartTimer = await createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline("Type matrix cart timer"),
      name: uniqueName("Type Cart Timer"),
      placement: PlacementType.CART_DRAWER,
      type: CampaignType.CART_TIMER,
    });

    await openStorefront(page, "/?utm_source=type_matrix");
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const globalPayload = await fetchStorefrontCampaigns(page, {
      device: "desktop",
      path: "/",
      placement: "TOP_BAR",
      utmSource: "type_matrix",
      visitorId: "type-matrix-desktop",
    });
    expect(globalPayload.ok).toBe(true);
    expect(
      expectCampaignPayload(globalPayload.body, countdown.id),
    ).toMatchObject({
      type: "COUNTDOWN_BAR",
      placement: "TOP_BAR",
    });
    expect(
      expectCampaignPayload(globalPayload.body, deliveryCutoff.id),
    ).toMatchObject({
      type: "DELIVERY_CUTOFF",
      deliveryCutoff: expect.objectContaining({
        cutoffHour: 14,
        cutoffMinute: 30,
        minDeliveryDays: 2,
        maxDeliveryDays: 4,
      }),
    });

    const mobilePayload = await fetchStorefrontCampaigns(page, {
      device: "mobile",
      path: "/",
      placement: "TOP_BAR",
      utmSource: "type_matrix",
      visitorId: "type-matrix-mobile",
    });
    expect(
      expectCampaignPayload(mobilePayload.body, countdown.id),
    ).toBeUndefined();

    const cartPayload = await fetchStorefrontCampaigns(page, {
      cartSubtotal: "20",
      path: "/cart",
      placement: "CART_PAGE",
      visitorId: "type-matrix-cart",
    });
    expect(
      expectCampaignPayload(cartPayload.body, freeShipping.id),
    ).toMatchObject({
      type: "FREE_SHIPPING_GOAL",
      freeShipping: expect.objectContaining({
        currencyCode: "USD",
        thresholdAmount: "95.00",
      }),
    });

    const productPayload = await fetchStorefrontCampaigns(page, {
      path: "/products/pp-e2e-test-product",
      placement: "PRODUCT_PAGE",
      productTags: "pp-e2e",
      visitorId: "type-matrix-product",
    });
    expect(
      expectCampaignPayload(productPayload.body, productTimer.id),
    ).toMatchObject({
      type: "PRODUCT_TIMER",
      placement: "PRODUCT_PAGE",
    });
    expect(
      expectCampaignPayload(productPayload.body, lowStock.id),
    ).toMatchObject({
      type: "LOW_STOCK",
      lowStock: expect.objectContaining({
        fallbackMessage: "Only a few E2E units left.",
        showExactQuantity: false,
        threshold: 6,
      }),
    });

    const collectionPayload = await fetchStorefrontCampaigns(page, {
      path: "/collections/all",
      placement: "COLLECTION_CARD",
      visitorId: "type-matrix-collection",
    });
    expect(
      expectCampaignPayload(collectionPayload.body, badge.id),
    ).toMatchObject({
      badge: expect.objectContaining({
        badgeText: badge.headline,
      }),
      type: "PRODUCT_BADGE",
    });

    const drawerPayload = await fetchStorefrontCampaigns(page, {
      cartSubtotal: "25",
      path: "/cart",
      placement: "CART_DRAWER",
      visitorId: "type-matrix-drawer",
    });
    expect(
      expectCampaignPayload(drawerPayload.body, cartTimer.id),
    ).toMatchObject({
      type: "CART_TIMER",
      placement: "CART_DRAWER",
    });

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("honors schedule boundaries and refreshes the storefront cache after publish", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );

    const now = Date.now();
    const future = await createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline("Future campaign should not render"),
      name: uniqueName("Schedule Future"),
      placement: PlacementType.TOP_BAR,
      startsAt: new Date(now + 60 * 60 * 1000),
      type: CampaignType.COUNTDOWN_BAR,
    });
    const expired = await createPublishedPlacementCampaign(shopId, {
      endsAt: new Date(now - 60 * 1000),
      headline: placementHeadline("Expired campaign should not render"),
      name: uniqueName("Schedule Expired"),
      placement: PlacementType.TOP_BAR,
      startsAt: new Date(now - 2 * 60 * 60 * 1000),
      type: CampaignType.COUNTDOWN_BAR,
    });
    const cacheCampaign = await createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline("Cache before publish"),
      name: uniqueName("Cache Invalidation"),
      placement: PlacementType.TOP_BAR,
      type: CampaignType.COUNTDOWN_BAR,
    });

    await openStorefront(page, "/?utm_source=schedule_cache");
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const initialPayload = await fetchStorefrontCampaigns(page, {
      placement: "TOP_BAR",
      path: "/",
      visitorId: "schedule-cache-initial",
    });
    expect(
      expectCampaignPayload(initialPayload.body, future.id),
    ).toBeUndefined();
    expect(
      expectCampaignPayload(initialPayload.body, expired.id),
    ).toBeUndefined();
    expect(
      expectCampaignPayload(initialPayload.body, cacheCampaign.id)?.texts
        .headline,
    ).toBe(cacheCampaign.headline);

    const updatedHeadline = placementHeadline("Cache after publish");
    await prisma.campaignTranslation.updateMany({
      where: {
        campaignId: cacheCampaign.id,
        locale: "en",
      },
      data: {
        headline: updatedHeadline,
      },
    });
    await publishCampaignForShop(cacheCampaign.id, shopId);

    const refreshedPayload = await fetchStorefrontCampaigns(page, {
      placement: "TOP_BAR",
      path: "/",
      visitorId: "schedule-cache-refreshed",
    });
    expect(
      expectCampaignPayload(refreshedPayload.body, cacheCampaign.id)?.texts
        .headline,
    ).toBe(updatedHeadline);
    if (initialPayload.etag && refreshedPayload.etag) {
      expect(refreshedPayload.etag).not.toBe(initialPayload.etag);
    }

    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });
});
