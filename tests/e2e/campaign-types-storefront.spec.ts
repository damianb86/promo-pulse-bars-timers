import {
  expect,
  expectNoConsoleErrors,
  expectNoFailedRequests,
  test,
} from "./fixtures";

const shop = "demo-shop.myshopify.com";

test("COUNTDOWN_BAR renders every selected global placement", async ({
  page,
  resetDb,
}) => {
  await resetDb("campaign-type-countdown");
  await page.goto("/__test/storefront");

  await expect(page.locator(".pp-bar--top-bar")).toContainText(
    "Flash sale ends soon",
  );
  await expect(page.locator(".pp-bar--bottom-bar")).toContainText(
    "Bottom bar flash sale",
  );
  await expect(page.locator(".pp-bar--top-bar .pp-countdown")).toHaveAttribute(
    "data-value",
    /\d{2} Hrs \d{2} Mins \d{2} Secs/,
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("PRODUCT_TIMER renders only for eligible product targeting", async ({
  page,
  resetDb,
}) => {
  await resetDb("campaign-type-product-timer");
  await page.goto(
    "/__test/storefront-product?productId=gid://shopify/Product/e2e-hoodie&productTags=sale,hoodie",
  );

  await expect(page.locator(".pp-product-card").first()).toContainText(
    "Product timer offer",
  );
  await expect(
    page.locator(".pp-product-card .pp-countdown").first(),
  ).toBeVisible();

  await page.goto(
    "/__test/storefront-product?productId=gid://shopify/Product/e2e-other&productTags=other",
  );
  await expect(page.locator(".pp-product-card")).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("CART_TIMER renders on cart page and drawer without duplicates", async ({
  page,
  resetDb,
}) => {
  await resetDb("campaign-type-cart-timer");
  await page.goto("/__test/storefront-cart?subtotal=25");

  await expect(page.locator(".pp-cart-timer .pp-cart-card")).toContainText(
    "Your cart is reserved",
  );
  await page.getByRole("button", { name: "Open cart drawer" }).click();
  await expect(page.locator(".pp-cart-card--drawer")).toHaveCount(1);
  await expect(page.locator(".pp-cart-card--drawer")).toContainText(
    "Your cart is reserved",
  );

  await page.getByRole("button", { name: "Open cart drawer" }).click();
  await page.getByRole("button", { name: "Open cart drawer" }).click();
  await expect(page.locator(".pp-cart-card--drawer")).toHaveCount(1);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("FREE_SHIPPING_GOAL updates threshold progress after cart changes without refetching the campaign", async ({
  page,
  resetDb,
}) => {
  let cartPageCampaignRequests = 0;

  page.on("request", (request) => {
    const url = new URL(request.url());

    if (
      url.pathname === "/apps/promo-pulse" &&
      url.searchParams.get("placement") === "CART_PAGE"
    ) {
      cartPageCampaignRequests += 1;
    }
  });

  await resetDb("campaign-type-free-shipping");
  await page.goto("/__test/storefront-cart?subtotal=25");

  const cartCard = page.locator(".pp-cart-timer .pp-cart-card");
  await expect(cartCard).toContainText("You're $25.00 away from free shipping");
  await expect(cartCard.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );

  cartPageCampaignRequests = 0;
  await page.evaluate(() => {
    (
      window as Window & {
        __setPromoPulseSubtotal?: (amount: number) => void;
      }
    ).__setPromoPulseSubtotal?.(60);
  });

  await expect(cartCard).toContainText("You've unlocked free shipping!");
  await expect(cartCard.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  expect(cartPageCampaignRequests).toBe(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("FREE_SHIPPING_GOAL supports circular progress style", async ({
  page,
  resetDb,
}) => {
  await resetDb("campaign-type-free-shipping-circular");
  await page.goto("/__test/storefront-cart?subtotal=40");

  const progress = page.locator(".pp-cart-progress--circular").first();
  await expect(progress).toBeVisible();
  await expect(progress.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("DELIVERY_CUTOFF renders the product delivery promise", async ({
  page,
  resetDb,
}) => {
  await resetDb("campaign-type-delivery-cutoff");
  await mockNow(page, "2026-06-16T20:00:00.000Z");
  await page.goto("/__test/storefront-product");

  const card = page.locator(".pp-product-card").first();
  await expect(card).toContainText("Order within");
  await expect(card).toContainText("to get it by");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("LOW_STOCK renders exact inventory only under the threshold and reacts to variant changes", async ({
  page,
  resetDb,
}) => {
  await resetDb("campaign-type-low-stock");
  await page.goto("/__test/storefront-product?inventory=3");

  await expect(page.locator(".pp-low-stock")).toContainText(
    "Only 3 left in stock.",
  );

  await page.getByLabel("Variant").selectOption("e2e-high");
  await expect(page.locator(".pp-low-stock")).toHaveCount(0);

  await page.goto("/__test/storefront-product?inventory=8");
  await expect(page.locator(".pp-low-stock")).toHaveCount(0);

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("PRODUCT_BADGE renders collection and product-page badges without duplicate badges per product", async ({
  page,
  resetDb,
}) => {
  await resetDb("campaign-type-product-badge");
  await page.goto("/__test/storefront");

  await expect(page.locator(".e2e-product-card")).toHaveCount(3);
  await expect(page.locator(".pp-badge")).toHaveCount(3);
  await expect(
    page.locator(".e2e-product-card").first().locator(".pp-badge"),
  ).toHaveText("Launch badge");

  await page.goto("/__test/storefront-product");
  await expect(page.locator(".pp-badge")).toHaveCount(1);
  await expect(page.locator(".pp-badge")).toHaveText("Launch badge");

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("CUSTOM_SELECTOR renders only into the matching Campaign ID snippet", async ({
  page,
  resetDb,
}) => {
  await resetDb("campaign-custom-selector");
  await page.goto("/__test/storefront");
  await expect(page.locator(".pp-bar")).toHaveCount(0);

  await page.goto(
    "/__test/storefront?customCampaignId=e2e-custom-selector-campaign",
  );
  const slot = page.locator(
    '[data-promo-pulse-campaign-id="e2e-custom-selector-campaign"]',
  );

  await expect(slot.locator(".pp-bar")).toContainText(
    "Custom slot announcement",
  );

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

test("storefront targeting filters evaluate product, collection, tag, country, device, URL, and exclusions", async ({
  page,
  resetDb,
}) => {
  await resetDb("campaign-targeting-filters");

  await expectHeadlines(page, {
    params: { productId: "gid://shopify/Product/e2e-hoodie" },
    includes: [
      "Product targeting matched",
      "Excluded product targeting matched",
    ],
  });
  await expectHeadlines(page, {
    params: { productId: "gid://shopify/Product/e2e-other" },
    excludes: ["Product targeting matched"],
  });
  await expectHeadlines(page, {
    params: { collectionIds: "gid://shopify/Collection/e2e-sale" },
    includes: ["Collection targeting matched"],
  });
  await expectHeadlines(page, {
    params: { productTags: "vip-tag,summer" },
    includes: ["Tag targeting matched"],
  });
  await expectHeadlines(page, {
    params: { country: "AR" },
    includes: ["Country targeting matched"],
  });
  await expectHeadlines(page, {
    params: { country: "US" },
    excludes: ["Country targeting matched"],
  });
  await expectHeadlines(page, {
    params: { device: "mobile" },
    includes: ["Device targeting matched"],
  });
  await expectHeadlines(page, {
    params: { device: "desktop" },
    excludes: ["Device targeting matched"],
  });
  await expectHeadlines(page, {
    params: { path: "/collections/sale" },
    includes: ["URL targeting matched", "Excluded URL targeting matched"],
  });
  await expectHeadlines(page, {
    params: { path: "/blocked/page" },
    excludes: ["URL targeting matched", "Excluded URL targeting matched"],
  });
  await expectHeadlines(page, {
    params: { productId: "gid://shopify/Product/e2e-blocked-product" },
    excludes: ["Excluded product targeting matched"],
  });

  expectNoConsoleErrors(page);
  expectNoFailedRequests(page);
});

async function expectHeadlines(
  page: import("@playwright/test").Page,
  options: {
    params: Record<string, string>;
    includes?: string[];
    excludes?: string[];
  },
) {
  const response = await page.request.get("/apps/promo-pulse", {
    params: {
      shop,
      placement: "TOP_BAR",
      path: "/",
      locale: "en",
      country: "US",
      device: "desktop",
      ...options.params,
    },
  });
  const payload = await response.json();
  const headlines = (payload.campaigns ?? []).map(
    (campaign: { texts?: { headline?: string } }) =>
      campaign.texts?.headline ?? "",
  );

  expect(response.ok()).toBe(true);
  for (const headline of options.includes ?? []) {
    expect(headlines).toContain(headline);
  }
  for (const headline of options.excludes ?? []) {
    expect(headlines).not.toContain(headline);
  }
}

async function mockNow(page: import("@playwright/test").Page, isoDate: string) {
  await page.addInitScript((value) => {
    const fixedTime = new Date(value).getTime();
    const NativeDate = Date;

    class MockDate extends NativeDate {
      constructor(value?: string | number | Date) {
        if (arguments.length === 0) {
          super(fixedTime);
        } else {
          super(value as string);
        }
      }

      static now() {
        return fixedTime;
      }
    }

    window.Date = MockDate as DateConstructor;
  }, isoDate);
}
