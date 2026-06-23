import { PlacementType } from "@prisma/client";
import type { Page, TestInfo } from "@playwright/test";

import { test, expect } from "./helpers/fixtures";
import {
  getConfig,
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
  addProductToCart,
  clearCart,
  expectStorefrontEmbedOrSkip,
  goToCartPage,
  openCartDrawer,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";
import {
  createE2EOrder,
  ensureTestProductHandle,
} from "./helpers/shopify-admin-api";

test.describe("real storefront placement matrix", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("renders top, bottom, and custom selector bars with preserved design and unique codes", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );

    const top = await createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline("Top bar placement"),
      name: uniqueName("Placement Top Bar"),
      placement: PlacementType.TOP_BAR,
      subheadline: "Top bar should stay in document flow above the page.",
    });
    const bottom = await createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline("Bottom bar unique code"),
      name: uniqueName("Placement Bottom Bar"),
      placement: PlacementType.BOTTOM_BAR,
      subheadline: "Bottom bar should stay below storefront content.",
      uniqueCodeCount: 8,
    });
    const custom = await createPublishedPlacementCampaign(shopId, {
      customSelector: ".pp-e2e-custom-target",
      customStyle: "margin-top: 8px;",
      headline: placementHeadline("Custom selector placement"),
      name: uniqueName("Placement Custom Selector"),
      placement: PlacementType.CUSTOM_SELECTOR,
      subheadline:
        "Custom selector should render inside the configured target.",
    });

    await installCustomSelectorTarget(page);
    await openStorefront(page, realE2ECacheBustPath("placement_matrix_global"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const topBar = promoBarByHeadline(page, top.headline);
    await expect(topBar).toBeVisible({ timeout: 30_000 });
    await expectPlacementPosition(page, topBar, "TOP_BAR");
    await expectPublishedDesignApplied(topBar, top.design, "top bar");
    await expectPromoFitsViewport(topBar, "top bar");
    await expectPromoTextFits(topBar, "top bar");

    const bottomBar = promoBarByHeadline(page, bottom.headline);
    await expect(bottomBar).toBeVisible({ timeout: 30_000 });
    await expectPlacementPosition(page, bottomBar, "BOTTOM_BAR");
    await expectPublishedDesignApplied(bottomBar, bottom.design, "bottom bar");
    await expectPromoFitsViewport(bottomBar, "bottom bar");
    await expectPromoTextFits(bottomBar, "bottom bar");
    const uniqueCode = bottomBar.locator(".pp-unique-code__value").first();
    await expect(uniqueCode).toBeVisible({ timeout: 30_000 });
    await expect(uniqueCode).toHaveText(/^PPE2E/i);
    await bottomBar.getByRole("button", { name: /copy code/i }).click();

    const customBar = promoBarByHeadline(page, custom.headline);
    await expect(customBar).toBeVisible({ timeout: 30_000 });
    await expectPlacementPosition(page, customBar, "CUSTOM_SELECTOR");
    await expectPublishedDesignApplied(customBar, custom.design, "custom bar");
    await expectPromoFitsViewport(customBar, "custom bar");
    await expectPromoTextFits(customBar, "custom bar");

    await expectNoHorizontalOverflow(page);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("renders product page timer placement without layout overflow", async ({
    page,
    request,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );
    const productHandle = await ensureTestProductHandle(request);
    test.skip(
      !productHandle,
      "Set REAL_E2E_PRODUCT_HANDLE or SHOPIFY_ADMIN_ACCESS_TOKEN to provide a test product.",
    );

    const productTimer = await createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline("Product page timer"),
      name: uniqueName("Placement Product Page"),
      placement: PlacementType.PRODUCT_PAGE,
      subheadline: "Product page timer should stay inside the product layout.",
    });

    await openStorefront(
      page,
      `/products/${productHandle}?utm_source=real_e2e_product_matrix_${Date.now()}`,
    );
    await expectStorefrontEmbedOrSkip(page, testInfo);
    const productCard = page
      .locator(".pp-product-card")
      .filter({ hasText: productTimer.headline })
      .first();

    if (
      !(await productCard.isVisible({ timeout: 30_000 }).catch(() => false))
    ) {
      testInfo.skip(
        true,
        "Add the Promo Pulse product timer block to the product template.",
      );
    }

    await expectPlacementPosition(page, productCard, "PRODUCT_PAGE");
    await expectPublishedDesignApplied(
      productCard,
      productTimer.design,
      "product timer",
    );
    await expectPromoFitsViewport(productCard, "product timer");
    await expectPromoTextFits(productCard, "product timer");
    await expectNoHorizontalOverflow(page);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("renders product page badge placement without duplicate badges", async ({
    page,
    request,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );
    const productHandle = await ensureTestProductHandle(request);
    test.skip(
      !productHandle,
      "Set REAL_E2E_PRODUCT_HANDLE or SHOPIFY_ADMIN_ACCESS_TOKEN to provide a test product.",
    );

    const badge = await createPublishedPlacementCampaign(shopId, {
      badgeText: placementHeadline("Product page badge"),
      headline: placementHeadline("Product page badge"),
      name: uniqueName("Placement Product Badge"),
      placement: PlacementType.PRODUCT_PAGE_BADGE,
      subheadline: "Product page badge should anchor to product media.",
    });

    await openStorefront(
      page,
      `/products/${productHandle}?utm_source=real_e2e_product_badge_${Date.now()}`,
    );
    await expectStorefrontEmbedOrSkip(page, testInfo);
    const badgeElement = page
      .locator(".pp-badge")
      .filter({ hasText: badge.headline })
      .first();

    if (
      !(await badgeElement.isVisible({ timeout: 30_000 }).catch(() => false))
    ) {
      testInfo.skip(
        true,
        "Enable product badge support in the product template or app embed.",
      );
    }

    await expect(
      page.locator(".pp-badge").filter({ hasText: badge.headline }),
    ).toHaveCount(1);
    await expectPlacementPosition(page, badgeElement, "PRODUCT_PAGE_BADGE");
    await expectPublishedDesignApplied(
      badgeElement,
      badge.design,
      "product page badge",
    );
    await expectPromoFitsViewport(badgeElement, "product page badge");
    await expectPromoTextFits(badgeElement, "product page badge");
    await expectNoHorizontalOverflow(page);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("renders collection card badge placement inside product cards", async ({
    page,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );

    const badge = await createPublishedPlacementCampaign(shopId, {
      badgeText: placementHeadline("Collection card badge"),
      headline: placementHeadline("Collection card badge"),
      name: uniqueName("Placement Collection Card"),
      placement: PlacementType.COLLECTION_CARD,
      subheadline: "Collection badge should stay inside a product card.",
    });

    await openStorefront(
      page,
      `/collections/all?utm_source=real_e2e_collection_badge_${Date.now()}`,
    );
    await expectStorefrontEmbedOrSkip(page, testInfo);
    const badgeElement = page
      .locator(".pp-badge")
      .filter({ hasText: badge.headline })
      .first();

    if (
      !(await badgeElement.isVisible({ timeout: 30_000 }).catch(() => false))
    ) {
      testInfo.skip(
        true,
        "Use a collection page with product cards or enable collection badge auto placement.",
      );
    }

    await expectPlacementPosition(page, badgeElement, "COLLECTION_CARD");
    await expectPublishedDesignApplied(
      badgeElement,
      badge.design,
      "collection card badge",
    );
    await expectPromoFitsViewport(badgeElement, "collection card badge");
    await expectPromoTextFits(badgeElement, "collection card badge");
    await expectNoHorizontalOverflow(page);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("renders cart page placement with discount code and stable page layout", async ({
    page,
    request,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );
    const productHandle = await ensureTestProductHandle(request);
    test.skip(
      !productHandle,
      "Set REAL_E2E_PRODUCT_HANDLE or SHOPIFY_ADMIN_ACCESS_TOKEN to provide a test product.",
    );

    const discountCode = `${DISCOUNT_CODE_FOR_PLACEMENTS}-CART`;
    const cartPage = await createPublishedPlacementCampaign(shopId, {
      discountCode,
      headline: placementHeadline("Cart page timer"),
      name: uniqueName("Placement Cart Page"),
      placement: PlacementType.CART_PAGE,
      subheadline: "Cart page timer should stay inside the cart layout.",
    });

    await openStorefront(page, realE2ECacheBustPath("cart_page_matrix"));
    await expectStorefrontEmbedOrSkip(page, testInfo);
    await clearCart(page);
    const added = await addProductToCart(page, productHandle);
    test.skip(
      !added,
      "The test product page needs an accessible Add to cart button.",
    );

    await goToCartPage(page);
    const cartCard = page
      .locator(".pp-cart-card")
      .filter({ hasText: cartPage.headline })
      .first();

    if (!(await cartCard.isVisible({ timeout: 30_000 }).catch(() => false))) {
      testInfo.skip(
        true,
        "Add the Promo Pulse cart timer block to the cart page template.",
      );
    }

    await expectPlacementPosition(page, cartCard, "CART_PAGE");
    await expectPublishedDesignApplied(cartCard, cartPage.design, "cart page");
    await expect(cartCard.locator(".pp-code").first()).toHaveText(discountCode);
    await cartCard.locator(".pp-code").first().click();
    await expectPromoFitsViewport(cartCard, "cart page");
    await expectPromoTextFits(cartCard, "cart page");
    await expectNoHorizontalOverflow(page);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("renders cart drawer placement once without disturbing the drawer layout", async ({
    page,
    request,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );
    const productHandle = await ensureTestProductHandle(request);
    test.skip(
      !productHandle,
      "Set REAL_E2E_PRODUCT_HANDLE or SHOPIFY_ADMIN_ACCESS_TOKEN to provide a test product.",
    );

    const cartDrawer = await createPublishedPlacementCampaign(shopId, {
      headline: placementHeadline("Cart drawer timer"),
      name: uniqueName("Placement Cart Drawer"),
      placement: PlacementType.CART_DRAWER,
      subheadline: "Cart drawer timer should render once inside the drawer.",
    });

    await openStorefront(page, realE2ECacheBustPath("cart_drawer_matrix"));
    await expectStorefrontEmbedOrSkip(page, testInfo);
    await clearCart(page);
    const added = await addProductToCart(page, productHandle);
    test.skip(
      !added,
      "The test product page needs an accessible Add to cart button.",
    );

    const opened = await openCartDrawer(page);
    test.skip(
      !opened,
      "Configure a cart drawer trigger in the theme or set customCartDrawerSelector in Settings.",
    );

    const drawerCards = page
      .locator(".pp-cart-card--drawer")
      .filter({ hasText: cartDrawer.headline });
    const drawerCard = drawerCards.first();
    await expect(drawerCard).toBeVisible({ timeout: 30_000 });
    await expect(drawerCards).toHaveCount(1);
    await expectPlacementPosition(page, drawerCard, "CART_DRAWER");
    await expectPublishedDesignApplied(
      drawerCard,
      cartDrawer.design,
      "cart drawer",
    );
    await expectPromoFitsViewport(drawerCard, "cart drawer");
    await expectPromoTextFits(drawerCard, "cart drawer");
    await expectNoHorizontalOverflow(page);
    await expectNoConsoleErrors(page);
    await expectNoFailedCriticalRequests(page);
  });

  test("returns thank-you and order-status placements through the real app proxy", async ({
    page,
    request,
  }, testInfo) => {
    await pauseAllPrefixedCampaigns(page);
    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );

    const thankYou = await createPublishedPlacementCampaign(shopId, {
      discountCode: `${DISCOUNT_CODE_FOR_PLACEMENTS}-TY`,
      headline: placementHeadline("Thank you page offer"),
      name: uniqueName("Placement Thank You"),
      placement: PlacementType.THANK_YOU_PAGE,
      subheadline: "Thank-you extension should receive this campaign.",
    });
    const orderStatus = await createPublishedPlacementCampaign(shopId, {
      discountCode: `${DISCOUNT_CODE_FOR_PLACEMENTS}-OS`,
      headline: placementHeadline("Order status page offer"),
      name: uniqueName("Placement Order Status"),
      placement: PlacementType.ORDER_STATUS_PAGE,
      subheadline: "Order-status extension should receive this campaign.",
    });

    await openStorefront(page, realE2ECacheBustPath("post_purchase_matrix"));
    await expectStorefrontEmbedOrSkip(page, testInfo);

    const thankYouPayload = await fetchPostPurchaseCampaign(page, {
      campaignId: thankYou.id,
      surface: "THANK_YOU_PAGE",
    });
    skipIfCheckoutExtensionsAreLocked(thankYouPayload, testInfo);
    expect(thankYouPayload.campaign).toMatchObject({
      campaignId: thankYou.id,
      placement: "THANK_YOU_PAGE",
      discountCode: `${DISCOUNT_CODE_FOR_PLACEMENTS}-TY`,
    });

    const orderStatusPayload = await fetchPostPurchaseCampaign(page, {
      campaignId: orderStatus.id,
      surface: "ORDER_STATUS_PAGE",
    });
    skipIfCheckoutExtensionsAreLocked(orderStatusPayload, testInfo);
    expect(orderStatusPayload.campaign).toMatchObject({
      campaignId: orderStatus.id,
      placement: "ORDER_STATUS_PAGE",
      discountCode: `${DISCOUNT_CODE_FOR_PLACEMENTS}-OS`,
    });

    const config = getConfig();
    if (config.allowOrder && config.adminAccessToken) {
      const order = await createE2EOrder(request);
      if (order.statusPageUrl) {
        await page.goto(order.statusPageUrl, { waitUntil: "domcontentloaded" });
        await expect(page.locator("body")).toBeVisible();
      }
    }
  });
});

const DISCOUNT_CODE_FOR_PLACEMENTS = "PPE2EPLACE";

function promoBarByHeadline(page: Page, headline: string) {
  return page
    .locator('[data-testid="promo-bar"], .pp-bar')
    .filter({ hasText: headline })
    .first();
}

async function installCustomSelectorTarget(page: Page) {
  await page.addInitScript(() => {
    const install = () => {
      if (document.querySelector(".pp-e2e-custom-target")) return;

      const target = document.createElement("section");
      target.className = "pp-e2e-custom-target";
      target.setAttribute("aria-label", "Promo Pulse custom placement target");
      target.style.cssText = [
        "position: relative",
        "min-height: 90px",
        "margin: 16px",
        "padding: 12px",
        "box-sizing: border-box",
        "border: 1px dashed rgba(17,24,39,.25)",
      ].join(";");

      const label = document.createElement("span");
      label.textContent = "Custom placement target";
      label.style.cssText = "display:block;font:12px system-ui;color:#6b7280";
      target.appendChild(label);
      document.body.prepend(target);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", install, { once: true });
    } else {
      install();
    }
  });
}

async function fetchPostPurchaseCampaign(
  page: Page,
  input: {
    campaignId: string;
    surface: "ORDER_STATUS_PAGE" | "THANK_YOU_PAGE";
  },
): Promise<PostPurchaseProxyPayload> {
  return page.evaluate(
    async ({ campaignId, shopDomain, surface }) => {
      const url = new URL(
        "/apps/promo-pulse/api/post-purchase/campaign",
        window.location.origin,
      );
      url.searchParams.set("shop", shopDomain);
      url.searchParams.set("mode", "SPECIFIC_CAMPAIGN");
      url.searchParams.set("campaignId", campaignId);
      url.searchParams.set("surface", surface);
      url.searchParams.set("placement", surface);
      url.searchParams.set("locale", "en");
      url.searchParams.set("currency", "USD");
      url.searchParams.set("compactMode", "false");
      url.searchParams.set("showTimer", "true");

      const response = await fetch(url.toString(), {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const text = await response.text();
      let payload: Record<string, unknown> = {};

      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        payload = { error: text };
      }

      return {
        ...payload,
        status: response.status,
      };
    },
    {
      campaignId: input.campaignId,
      shopDomain: getConfig().shopDomain,
      surface: input.surface,
    },
  );
}

type PostPurchaseProxyPayload = {
  campaign?: unknown;
  error?: unknown;
  gated?: unknown;
  status: number;
};

function skipIfCheckoutExtensionsAreLocked(
  payload: { error?: unknown; gated?: unknown; status?: unknown },
  testInfo: TestInfo,
) {
  if (payload.gated || payload.status === 403) {
    testInfo.skip(
      true,
      `Checkout extensions are not available for this shop: ${String(
        payload.error ?? "plan gate",
      )}`,
    );
  }
}
