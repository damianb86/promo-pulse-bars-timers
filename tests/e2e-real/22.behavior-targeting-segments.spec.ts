import {
  AnalyticsEventType,
  PlacementType,
  Prisma,
  UniqueDiscountCodeStatus,
} from "@prisma/client";
import type { Page } from "@playwright/test";

import prisma from "../../app/db.server";
import { canUseFeature } from "../../app/services/planLimits.server";
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
  expectNoFailedCriticalRequests,
} from "./helpers/assertions";
import {
  expectStorefrontEmbedOrSkip,
  openStorefront,
} from "./helpers/storefront";
import {
  expectCampaignPayload,
  fetchStorefrontCampaigns,
  type StorefrontCampaignApiOptions,
} from "./helpers/storefront-api";
import {
  behaviorRules,
  behaviorVisitor,
  clearBehaviorVisitorData,
  daysAgo,
  minutesAgo,
  seedBehaviorTouches,
  seedBehaviorUniqueCode,
  type SeedTouch,
} from "./helpers/behavior-fixtures";

test.describe("real behavior targeting segments (storefront eligibility)", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  let shopId = "";
  const seededVisitorIds: string[] = [];

  test.beforeEach(async ({ page }, testInfo) => {
    shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );

    // Behavior-targeted campaigns are dropped from the storefront entirely when
    // the plan lacks the feature, so skip rather than fail confusingly.
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { plan: true },
    });
    test.skip(
      !shop || !canUseFeature(shop, "behavioral_targeting").allowed,
      "Behavioral targeting is not available on this shop's plan.",
    );

    await pauseAllPrefixedCampaigns(page);
    await openStorefront(page, "/?pp_e2e=behavior");
    await expectStorefrontEmbedOrSkip(page, testInfo);
  });

  test.afterEach(async ({ page }) => {
    await pauseAllPrefixedCampaigns(page);
    await clearBehaviorVisitorData(seededVisitorIds.splice(0));
  });

  async function createBehaviorCampaign(
    label: string,
    rules: ReturnType<typeof behaviorRules>,
  ) {
    return createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline(`Behavior ${label}`),
      name: uniqueName(`Behavior ${label}`),
      placement: PlacementType.TOP_BAR,
      targeting: {
        behaviorRules: rules as unknown as Prisma.InputJsonValue,
      },
    });
  }

  function visitor(label: string) {
    const ids = behaviorVisitor(label);
    seededVisitorIds.push(ids.visitorId);
    return ids;
  }

  async function isEligible(
    page: Page,
    campaignId: string,
    ids: { visitorId: string; sessionId: string },
    extra: StorefrontCampaignApiOptions = {},
  ) {
    const payload = await fetchStorefrontCampaigns(page, {
      placement: "TOP_BAR",
      path: "/",
      visitorId: ids.visitorId,
      sessionId: ids.sessionId,
      ...extra,
    });
    expect(payload.ok).toBe(true);
    // Behavior targeting forces no-store, so each visitor is evaluated fresh.
    expect(payload.cacheControl).toContain("no-store");
    return Boolean(expectCampaignPayload(payload.body, campaignId));
  }

  test("NEW_VISITOR matches only visitors with no recorded history", async ({
    page,
  }) => {
    const campaign = await createBehaviorCampaign(
      "New visitor",
      behaviorRules({ segments: ["NEW_VISITOR"] }),
    );

    const fresh = visitor("new-fresh");
    expect(await isEligible(page, campaign.id, fresh)).toBe(true);

    const known = visitor("new-known");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: known.visitorId,
      sessionId: known.sessionId,
      events: [{ type: AnalyticsEventType.PRODUCT_VIEWED, at: minutesAgo(5) }],
    });
    expect(await isEligible(page, campaign.id, known)).toBe(false);
  });

  test("RETURNING_VISITOR honors min prior sessions and days since first seen", async ({
    page,
  }) => {
    const campaign = await createBehaviorCampaign(
      "Returning visitor",
      behaviorRules({
        segments: ["RETURNING_VISITOR"],
        returningMinPriorSessions: 1,
        returningMinDaysSinceFirstSeen: 3,
      }),
    );

    // Two prior sessions, first seen 10 days ago -> matches.
    const returning = visitor("returning-yes");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: returning.visitorId,
      sessionId: returning.sessionId,
      events: [
        {
          type: AnalyticsEventType.PRODUCT_VIEWED,
          at: daysAgo(10),
          sessionId: `${returning.sessionId}-old`,
        },
        {
          type: AnalyticsEventType.PRODUCT_VIEWED,
          at: minutesAgo(5),
          sessionId: `${returning.sessionId}-old`,
        },
      ],
    });
    expect(await isEligible(page, campaign.id, returning)).toBe(true);

    // Only the current session known -> no prior session -> excluded.
    const single = visitor("returning-single");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: single.visitorId,
      sessionId: single.sessionId,
      events: [{ type: AnalyticsEventType.PRODUCT_VIEWED, at: minutesAgo(5) }],
    });
    expect(await isEligible(page, campaign.id, single)).toBe(false);

    // Prior session but first seen only 1 day ago -> below the 3-day floor.
    const recent = visitor("returning-recent");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: recent.visitorId,
      sessionId: recent.sessionId,
      events: [
        {
          type: AnalyticsEventType.PRODUCT_VIEWED,
          at: daysAgo(1),
          sessionId: `${recent.sessionId}-old`,
        },
      ],
    });
    expect(await isEligible(page, campaign.id, recent)).toBe(false);
  });

  test("VIEWED_PRODUCT_NO_ADD_TO_CART honors min views and add-to-cart exclusion", async ({
    page,
  }) => {
    const campaign = await createBehaviorCampaign(
      "Viewed product",
      behaviorRules({
        segments: ["VIEWED_PRODUCT_NO_ADD_TO_CART"],
        viewedProductMinViews: 2,
      }),
    );

    const browser = visitor("viewed-yes");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: browser.visitorId,
      sessionId: browser.sessionId,
      events: [
        { type: AnalyticsEventType.PRODUCT_VIEWED, at: minutesAgo(20) },
        { type: AnalyticsEventType.PRODUCT_VIEWED, at: minutesAgo(10) },
      ],
    });
    expect(await isEligible(page, campaign.id, browser)).toBe(true);

    // Below the 2-view floor.
    const oneView = visitor("viewed-one");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: oneView.visitorId,
      sessionId: oneView.sessionId,
      events: [{ type: AnalyticsEventType.PRODUCT_VIEWED, at: minutesAgo(10) }],
    });
    expect(await isEligible(page, campaign.id, oneView)).toBe(false);

    // Added to cart after viewing -> no longer "no add to cart".
    const added = visitor("viewed-added");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: added.visitorId,
      sessionId: added.sessionId,
      events: [
        { type: AnalyticsEventType.PRODUCT_VIEWED, at: minutesAgo(20) },
        { type: AnalyticsEventType.PRODUCT_VIEWED, at: minutesAgo(15) },
        { type: AnalyticsEventType.ADD_TO_CART, at: minutesAgo(5) },
      ],
    });
    expect(await isEligible(page, campaign.id, added)).toBe(false);
  });

  test("ADDED_TO_CART_NO_CHECKOUT waits for the configured delay", async ({
    page,
  }) => {
    const campaign = await createBehaviorCampaign(
      "Added to cart delay",
      behaviorRules({
        segments: ["ADDED_TO_CART_NO_CHECKOUT"],
        addedToCartDelayMinutes: 30,
      }),
    );

    // Added 45 min ago, no checkout -> past the 30 min delay.
    const waited = visitor("cart-waited");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: waited.visitorId,
      sessionId: waited.sessionId,
      events: [{ type: AnalyticsEventType.ADD_TO_CART, at: minutesAgo(45) }],
    });
    expect(await isEligible(page, campaign.id, waited)).toBe(true);

    // Added 5 min ago -> still inside the delay window.
    const fresh = visitor("cart-fresh");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: fresh.visitorId,
      sessionId: fresh.sessionId,
      events: [{ type: AnalyticsEventType.ADD_TO_CART, at: minutesAgo(5) }],
    });
    expect(await isEligible(page, campaign.id, fresh)).toBe(false);

    // Added then started checkout -> excluded.
    const checkedOut = visitor("cart-checked-out");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: checkedOut.visitorId,
      sessionId: checkedOut.sessionId,
      events: [
        { type: AnalyticsEventType.ADD_TO_CART, at: minutesAgo(60) },
        { type: AnalyticsEventType.CHECKOUT_STARTED, at: minutesAgo(40) },
      ],
    });
    expect(await isEligible(page, campaign.id, checkedOut)).toBe(false);
  });

  test("CHECKOUT_STARTED excludes shoppers who already purchased", async ({
    page,
  }) => {
    const campaign = await createBehaviorCampaign(
      "Checkout started",
      behaviorRules({
        segments: ["CHECKOUT_STARTED"],
        checkoutStartedExcludePurchasers: true,
      }),
    );

    const pending = visitor("checkout-pending");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: pending.visitorId,
      sessionId: pending.sessionId,
      events: [{ type: AnalyticsEventType.CHECKOUT_STARTED, at: minutesAgo(10) }],
    });
    expect(await isEligible(page, campaign.id, pending)).toBe(true);

    const purchased = visitor("checkout-purchased");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: purchased.visitorId,
      sessionId: purchased.sessionId,
      events: [
        { type: AnalyticsEventType.CHECKOUT_STARTED, at: minutesAgo(20) },
        { type: AnalyticsEventType.ORDER_ATTRIBUTED, at: minutesAgo(5) },
      ],
    });
    expect(await isEligible(page, campaign.id, purchased)).toBe(false);
  });

  test("INACTIVE_CART matches once the configured stale window passes", async ({
    page,
  }) => {
    const campaign = await createBehaviorCampaign(
      "Inactive cart",
      behaviorRules({
        segments: ["INACTIVE_CART"],
        inactiveCartMinutes: 60,
      }),
    );

    const stale = visitor("inactive-stale");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: stale.visitorId,
      sessionId: stale.sessionId,
      events: [{ type: AnalyticsEventType.ADD_TO_CART, at: minutesAgo(90) }],
    });
    expect(await isEligible(page, campaign.id, stale)).toBe(true);

    const recent = visitor("inactive-recent");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: recent.visitorId,
      sessionId: recent.sessionId,
      events: [{ type: AnalyticsEventType.ADD_TO_CART, at: minutesAgo(20) }],
    });
    expect(await isEligible(page, campaign.id, recent)).toBe(false);
  });

  test("SAW_CAMPAIGN and CLICKED_CAMPAIGN match their per-segment campaign IDs", async ({
    page,
  }) => {
    // A separate campaign provides a stable referenced id. The storefront reads
    // behavior rules from the published snapshot, so the referenced ids must be
    // wired into the targeting at creation time.
    const referenced = await createBehaviorCampaign(
      "Saw/clicked referenced",
      behaviorRules({ segments: ["NEW_VISITOR"] }),
    );
    const wired = await createBehaviorCampaign(
      "Saw and clicked",
      behaviorRules({
        segments: ["SAW_CAMPAIGN", "CLICKED_CAMPAIGN"],
        sawCampaignIds: [referenced.id],
        clickedCampaignIds: [referenced.id],
      }),
    );

    // Saw an impression for the referenced campaign.
    const saw = visitor("saw");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: wired.id,
      visitorId: saw.visitorId,
      sessionId: saw.sessionId,
      events: [
        {
          type: AnalyticsEventType.IMPRESSION,
          at: minutesAgo(10),
          campaignId: referenced.id,
        },
      ],
    });
    expect(await isEligible(page, wired.id, saw)).toBe(true);

    // Clicked the referenced campaign.
    const clicked = visitor("clicked");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: wired.id,
      visitorId: clicked.visitorId,
      sessionId: clicked.sessionId,
      events: [
        {
          type: AnalyticsEventType.CLICK,
          at: minutesAgo(10),
          campaignId: referenced.id,
        },
      ],
    });
    expect(await isEligible(page, wired.id, clicked)).toBe(true);

    // Saw/clicked a different campaign only -> excluded from the wired lists.
    const other = visitor("saw-other");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: wired.id,
      visitorId: other.visitorId,
      sessionId: other.sessionId,
      events: [
        {
          type: AnalyticsEventType.IMPRESSION,
          at: minutesAgo(10),
          campaignId: wired.id,
        },
      ],
    });
    expect(await isEligible(page, wired.id, other)).toBe(false);
  });

  test("USED_UNIQUE_CODE matches used codes and optionally assigned-only codes", async ({
    page,
  }) => {
    const usedOnly = await createBehaviorCampaign(
      "Used unique code",
      behaviorRules({
        segments: ["USED_UNIQUE_CODE"],
        usedUniqueCodeIncludeAssigned: false,
      }),
    );

    const usedVisitor = visitor("code-used");
    await seedBehaviorUniqueCode({
      shopId,
      campaignId: usedOnly.id,
      visitorId: usedVisitor.visitorId,
      sessionId: usedVisitor.sessionId,
      status: UniqueDiscountCodeStatus.USED,
    });
    expect(await isEligible(page, usedOnly.id, usedVisitor)).toBe(true);

    // Assigned-but-not-used is excluded when include-assigned is off.
    const assignedVisitor = visitor("code-assigned");
    await seedBehaviorUniqueCode({
      shopId,
      campaignId: usedOnly.id,
      visitorId: assignedVisitor.visitorId,
      sessionId: assignedVisitor.sessionId,
      status: UniqueDiscountCodeStatus.ASSIGNED,
    });
    expect(await isEligible(page, usedOnly.id, assignedVisitor)).toBe(false);

    // Same assigned-only visitor matches once include-assigned is enabled.
    const includeAssigned = await createBehaviorCampaign(
      "Used unique code include assigned",
      behaviorRules({
        segments: ["USED_UNIQUE_CODE"],
        usedUniqueCodeIncludeAssigned: true,
      }),
    );
    expect(await isEligible(page, includeAssigned.id, assignedVisitor)).toBe(
      true,
    );
  });

  test("HIGH_INTENT counts qualifying events inside the configured window", async ({
    page,
  }) => {
    const campaign = await createBehaviorCampaign(
      "High intent",
      behaviorRules({
        segments: ["HIGH_INTENT"],
        highIntentMinEvents: 3,
        highIntentWindowMinutes: 60,
      }),
    );

    const intentEvents: SeedTouch[] = [
      { type: AnalyticsEventType.PRODUCT_VIEWED, at: minutesAgo(30) },
      { type: AnalyticsEventType.CLICK, at: minutesAgo(20) },
      { type: AnalyticsEventType.ADD_TO_CART, at: minutesAgo(10) },
    ];

    const intense = visitor("intent-yes");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: intense.visitorId,
      sessionId: intense.sessionId,
      events: intentEvents,
    });
    expect(await isEligible(page, campaign.id, intense)).toBe(true);

    // Three events but two fell outside the 60 minute window.
    const stale = visitor("intent-stale");
    await seedBehaviorTouches({
      shopId,
      anchorCampaignId: campaign.id,
      visitorId: stale.visitorId,
      sessionId: stale.sessionId,
      events: [
        { type: AnalyticsEventType.PRODUCT_VIEWED, at: minutesAgo(120) },
        { type: AnalyticsEventType.CLICK, at: minutesAgo(90) },
        { type: AnalyticsEventType.ADD_TO_CART, at: minutesAgo(10) },
      ],
    });
    expect(await isEligible(page, campaign.id, stale)).toBe(false);

    await expectNoFailedCriticalRequests(page);
  });
});
