import type {
  APIRequestContext,
  Frame,
  Locator,
  Page,
  TestInfo,
} from "@playwright/test";
import { AnalyticsEventType, UniqueDiscountCodeStatus } from "@prisma/client";

import prisma from "../../app/db.server";
import { test, expect } from "./helpers/fixtures";
import {
  DISCOUNT_CODE_PREFIX,
  getConfig,
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
  uniqueName,
} from "./helpers/env";
import {
  clickCampaignEditorTab,
  createUniqueCodeCampaign,
  openCampaignEditor,
  pauseAllPrefixedCampaigns,
  publishCampaignDraft,
} from "./helpers/admin-app";
import { getAppFrameOrPage, openPromoPulseApp } from "./helpers/auth";
import { adminGraphql } from "./helpers/shopify-admin-api";
import {
  addProductToCart,
  clearCart,
  expectStorefrontEmbedOrSkip,
  goToCheckout,
  openStorefront,
  realE2ECacheBustPath,
} from "./helpers/storefront";
import { findRealE2EShopId } from "./helpers/placement-fixtures";

type ShopifyOrderSummary = {
  id: string;
  name: string;
  email: string | null;
  displayFinancialStatus: string;
  discountCodes: string[];
  totalDiscountsSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  totalPriceSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
};

test.describe("real checkout, discount, order attribution, and analytics", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test.afterEach(async ({ page }) => {
    await pauseAllPrefixedCampaigns(page);
  });

  test("completes checkout with a generated unique code and tracks the attributed order", async ({
    page,
    request,
  }, testInfo) => {
    const config = getConfig();
    test.skip(
      !config.allowCheckout,
      "Set REAL_E2E_ALLOW_CHECKOUT=true to allow checkout navigation in a real store.",
    );
    test.skip(
      !config.allowOrder,
      "Set REAL_E2E_ALLOW_ORDER=true to create a paid real Shopify checkout order.",
    );
    test.skip(
      !config.adminAccessToken,
      "Set SHOPIFY_ADMIN_ACCESS_TOKEN with read_orders/read_products/write_discounts scope to verify the order and generated discount.",
    );
    test.skip(
      !config.productHandle,
      "Set REAL_E2E_PRODUCT_HANDLE to a paid, published product dedicated to checkout E2E.",
    );

    await pauseAllPrefixedCampaigns(page);
    await ensureAnalyticsAndReportsAvailable(page, testInfo);

    const shopId = await findRealE2EShopId();
    test.skip(
      !shopId,
      "Install/open Promo Pulse once so the shop exists locally.",
    );

    const campaignName = await createUniqueCodeCampaign(
      page,
      uniqueName("Checkout Unique Order"),
    );
    await openCampaignEditor(page, campaignName);
    const campaign = await prisma.campaign.findFirstOrThrow({
      where: { name: campaignName, shopId },
      select: { id: true, name: true },
    });
    const prefix = `${DISCOUNT_CODE_PREFIX}ORDER`;

    await generateUniqueCodesForCheckout(page, prefix, testInfo);

    await openStorefront(page, realE2ECacheBustPath("checkout_order_code"));
    await expectStorefrontEmbedOrSkip(page, testInfo);
    const bar = page
      .locator('[data-testid="promo-bar"], .pp-bar')
      .filter({ hasText: "Unique code real E2E" })
      .first();
    await expect(bar).toBeVisible({ timeout: 30_000 });
    const codeLocator = bar.locator(".pp-unique-code__value").first();
    await expect(codeLocator).toHaveText(new RegExp(`^${prefix}`, "i"), {
      timeout: 30_000,
    });
    const discountCode = (await codeLocator.textContent())?.trim() ?? "";
    expect(discountCode).toMatch(new RegExp(`^${prefix}`, "i"));

    await clearCart(page);
    const added = await addProductToCart(page, config.productHandle);
    test.skip(
      !added,
      "REAL_E2E_PRODUCT_HANDLE must point to a visible product with an accessible Add to cart button.",
    );

    await openStorefront(
      page,
      `/discount/${encodeURIComponent(discountCode)}?redirect=/cart`,
    );
    await goToCheckout(page, testInfo);
    await ensureCheckoutDiscountApplied(page, discountCode);

    const email = `pp-e2e-checkout+${Date.now()}@example.com`;
    await completeCheckoutWithBogusGateway(page, email, testInfo);

    await expect(page.locator("body")).toContainText(
      /thank you|order confirmed|order|confirmation/i,
      { timeout: 120_000 },
    );

    await expect
      .poll(() => findRecentOrderByEmail(request, email), {
        intervals: [5_000, 10_000, 15_000],
        timeout: 120_000,
      })
      .toEqual(expect.objectContaining({ email }));

    const order = await findRecentOrderByEmail(request, email);
    expect(order?.discountCodes).toContain(discountCode);
    expect(
      Number(order?.totalDiscountsSet.shopMoney.amount ?? 0),
    ).toBeGreaterThan(0);
    expect(order?.displayFinancialStatus).toMatch(/PAID|AUTHORIZED|PENDING/i);

    await expect
      .poll(
        async () => {
          const code = await prisma.uniqueDiscountCode.findFirst({
            where: { shopId, campaignId: campaign.id, code: discountCode },
            select: { orderId: true, status: true },
          });

          return code?.status ?? "";
        },
        {
          intervals: [5_000, 10_000, 15_000],
          timeout: 120_000,
        },
      )
      .toBe(UniqueDiscountCodeStatus.USED);

    await expect
      .poll(
        async () => {
          const event = await prisma.analyticsEvent.findFirst({
            where: {
              shopId,
              campaignId: campaign.id,
              eventType: AnalyticsEventType.ORDER_ATTRIBUTED,
            },
            orderBy: { occurredAt: "desc" },
            select: {
              currencyCode: true,
              orderId: true,
              revenueAmount: true,
            },
          });

          return event
            ? {
                currencyCode: event.currencyCode,
                orderId: event.orderId,
                revenueAmount: event.revenueAmount?.toString() ?? null,
              }
            : null;
        },
        {
          intervals: [5_000, 10_000, 15_000],
          timeout: 120_000,
        },
      )
      .toEqual(
        expect.objectContaining({
          orderId: expect.any(String),
          revenueAmount: expect.any(String),
        }),
      );

    await assertAnalyticsAndReportsReflectOrder(page, campaign.id);
  });
});

async function generateUniqueCodesForCheckout(
  page: Page,
  prefix: string,
  testInfo: TestInfo,
) {
  const app = await getAppFrameOrPage(page);
  await clickCampaignEditorTab(app, "offers");
  await app.locator("#offer-tab-unique-codes").click();

  if (
    await app
      .getByText(/unique codes are locked/i)
      .isVisible()
      .catch(() => false)
  ) {
    testInfo.skip(
      true,
      "Unique codes require a plan that enables unique_discount_codes.",
    );
  }

  const form = app
    .locator('form:has(input[name="_action"][value="generateUniqueCodes"])')
    .first();
  await form.locator('input[name="enableUniqueCodes"]').check();
  await form.locator('input[name="uniqueCodePrefix"]').fill(prefix);
  await form.locator('select[name="valueType"]').selectOption("PERCENTAGE");
  await form.locator('input[name="value"]').fill("20");
  await form.locator('input[name="uniqueCodeExpiresMinutes"]').fill("90");
  await form.locator('input[name="totalCodesToGenerate"]').fill("12");
  const autoApply = form.locator('input[name="uniqueCodeAutoApply"]');
  if (!(await autoApply.isChecked())) {
    await autoApply.check();
  }

  await form.getByRole("button", { name: /generate codes/i }).click();
  const dialog = app.getByRole("dialog", {
    name: /generate unique visitor codes/i,
  });
  if (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await dialog.getByRole("button", { name: /^generate codes$/i }).click();
  }

  await expect(
    app
      .getByRole("status")
      .filter({ hasText: /generated|unique codes updated/i })
      .first(),
  ).toBeVisible({ timeout: 60_000 });
  await publishCampaignDraft(page);
}

async function completeCheckoutWithBogusGateway(
  page: Page,
  email: string,
  testInfo: TestInfo,
) {
  await fillRequiredField(
    page,
    /email or mobile phone number|email/i,
    email,
    "email",
    testInfo,
  );
  await selectIfVisible(page, /country\/region|country|region/i, {
    label: "United States",
  });
  await fillIfVisible(page, /first name/i, "Promo");
  await fillIfVisible(page, /last name/i, "Pulse");
  await fillIfVisible(
    page,
    /^(address|address line 1|street address)$/i,
    "123 Test Street",
  );
  await fillIfVisible(page, /apartment|suite|unit/i, "1");
  await fillIfVisible(page, /city/i, "New York");
  await selectIfVisible(page, /state|province/i, { label: "New York" });
  await fillIfVisible(page, /zip|postal|postcode/i, "10001");
  await fillIfVisible(page, /phone/i, "5555555555");

  await clickButtonIfVisible(
    page,
    /continue to shipping|continue to delivery/i,
  );
  await chooseShippingIfNeeded(page);
  await clickButtonIfVisible(page, /continue to payment|review order/i);

  await fillRequiredField(
    page,
    /card number/i,
    "1",
    "Bogus Gateway card number",
    testInfo,
  );
  await fillRequiredField(
    page,
    /expiration date|expiry|mm\s*\/\s*yy/i,
    "12/34",
    "payment expiration date",
    testInfo,
  );
  await fillRequiredField(
    page,
    /security code|cvv|cvc/i,
    "123",
    "payment security code",
    testInfo,
  );
  await fillIfVisible(page, /name on card/i, "Promo Pulse");

  const paid = await clickButtonIfVisible(
    page,
    /pay now|complete order|place order/i,
    { required: true },
  );
  test.skip(
    !paid,
    "Configure Shopify Bogus Gateway or a test payment method so Playwright can submit payment.",
  );
}

async function ensureCheckoutDiscountApplied(page: Page, code: string) {
  const codeText = page.getByText(new RegExp(escapeRegExp(code), "i")).first();
  if (await codeText.isVisible({ timeout: 10_000 }).catch(() => false)) return;

  const discountField =
    (await findField(page, /discount code|gift card/i)) ??
    page.getByPlaceholder(/discount code|gift card/i).first();

  await expect(discountField).toBeVisible({ timeout: 30_000 });
  await discountField.fill(code);
  await page.getByRole("button", { name: /apply/i }).first().click();
  await expect(codeText).toBeVisible({ timeout: 30_000 });
}

async function ensureAnalyticsAndReportsAvailable(
  page: Page,
  testInfo: TestInfo,
) {
  await openPromoPulseApp(page, "/app/analytics");
  let app = await getAppFrameOrPage(page);

  if (
    await app
      .getByText(/analytics are locked/i)
      .isVisible()
      .catch(() => false)
  ) {
    testInfo.skip(true, "Analytics require a plan that enables analytics.");
  }

  await openPromoPulseApp(page, "/app/reports");
  app = await getAppFrameOrPage(page);
  if (
    await app
      .getByText(/advanced reporting is locked/i)
      .isVisible()
      .catch(() => false)
  ) {
    testInfo.skip(
      true,
      "Reports require a plan that enables advanced reporting.",
    );
  }
}

async function assertAnalyticsAndReportsReflectOrder(
  page: Page,
  campaignId: string,
) {
  await openPromoPulseApp(page, "/app/analytics");
  let app = await getAppFrameOrPage(page);
  await expect(app.getByTestId("analytics-dashboard")).toContainText(
    /orders|revenue|checkout/i,
    { timeout: 60_000 },
  );

  await openPromoPulseApp(page, "/app/reports");
  app = await getAppFrameOrPage(page);
  await app.getByLabel("Campaign").selectOption(campaignId);
  await app.getByRole("button", { name: "Apply" }).click();
  await expect(app.locator("body")).toContainText(
    /orders attributed|attributed revenue|revenue|orders/i,
    { timeout: 60_000 },
  );
}

async function findRecentOrderByEmail(
  request: APIRequestContext,
  email: string,
) {
  const result = await adminGraphql<{
    orders: { nodes: ShopifyOrderSummary[] };
  }>(
    request,
    `
      query RealE2ERecentOrders {
        orders(first: 20, sortKey: CREATED_AT, reverse: true) {
          nodes {
            id
            name
            email
            displayFinancialStatus
            discountCodes
            totalDiscountsSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
    `,
  );

  return (
    result.data?.orders.nodes.find(
      (order) => order.email?.toLowerCase() === email.toLowerCase(),
    ) ?? null
  );
}

async function fillRequiredField(
  page: Page,
  label: RegExp,
  value: string,
  fieldName: string,
  testInfo: TestInfo,
) {
  const field = await findField(page, label);

  if (!field) {
    testInfo.skip(
      true,
      `Checkout field "${fieldName}" was not available. Confirm the dev store checkout and Bogus Gateway are configured.`,
    );
    throw new Error(`Missing checkout field: ${fieldName}`);
  }

  await field.fill(value);
}

async function fillIfVisible(page: Page, label: RegExp, value: string) {
  const field = await findField(page, label);
  if (!field) return;

  await field.fill(value);
}

async function selectIfVisible(
  page: Page,
  label: RegExp,
  option: { label: string },
) {
  const field = await findField(page, label);
  if (!field) return;

  await field.selectOption(option).catch(() => null);
}

async function findField(page: Page, label: RegExp) {
  const pageField =
    (await firstVisible(page.getByLabel(label).first())) ??
    (await firstVisible(page.getByPlaceholder(label).first()));
  if (pageField) return pageField;

  for (const frame of page.frames()) {
    const frameField =
      (await firstVisibleInFrame(frame, label, "label")) ??
      (await firstVisibleInFrame(frame, label, "placeholder"));
    if (frameField) return frameField;
  }

  return null;
}

async function firstVisible(locator: Locator) {
  return (await locator.isVisible({ timeout: 1_500 }).catch(() => false))
    ? locator
    : null;
}

async function firstVisibleInFrame(
  frame: Frame,
  label: RegExp,
  mode: "label" | "placeholder",
) {
  const locator =
    mode === "label"
      ? frame.getByLabel(label).first()
      : frame.getByPlaceholder(label).first();

  return firstVisible(locator);
}

async function clickButtonIfVisible(
  page: Page,
  name: RegExp,
  options: { required?: boolean } = {},
) {
  const button = page.getByRole("button", { name }).first();
  const visible = await button.isVisible({ timeout: 5_000 }).catch(() => false);

  if (!visible) return false;
  await expect(button).toBeEnabled({ timeout: 30_000 });
  await button.click();
  await page
    .waitForLoadState("domcontentloaded", { timeout: 30_000 })
    .catch(() => null);

  if (options.required) return true;
  await page.waitForTimeout(1_000);
  return true;
}

async function chooseShippingIfNeeded(page: Page) {
  const selectedShipping = page
    .locator('input[type="radio"][name*="shipping"]:checked')
    .first();
  if (await selectedShipping.isVisible().catch(() => false)) return;

  const shippingOption = page
    .locator('input[type="radio"][name*="shipping"]')
    .first();
  if (await shippingOption.isVisible().catch(() => false)) {
    await shippingOption.check({ force: true }).catch(() => null);
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
