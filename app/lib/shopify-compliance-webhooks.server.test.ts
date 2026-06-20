import { beforeEach, describe, expect, it, vi } from "vitest";

const privacyMock = vi.hoisted(() => ({
  deletePromoPulseShopData: vi.fn(),
}));

vi.mock("../db.server", () => ({ default: {} }));
vi.mock("../services/privacy.server", () => ({
  deletePromoPulseShopData: privacyMock.deletePromoPulseShopData,
}));

import {
  buildShopifyIdVariants,
  getComplianceWebhookSummary,
  isComplianceTopic,
  normalizeComplianceTopic,
  redactCustomerData,
  redactShopData,
} from "./shopify-compliance-webhooks.server";

describe("Shopify compliance webhook helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes Shopify SDK topic names and detects mandatory topics", () => {
    expect(normalizeComplianceTopic("CUSTOMERS_DATA_REQUEST")).toBe(
      "customers/data_request",
    );
    expect(normalizeComplianceTopic("customers/redact")).toBe(
      "customers/redact",
    );
    expect(isComplianceTopic("CUSTOMERS_DATA_REQUEST")).toBe(true);
    expect(isComplianceTopic("CUSTOMERS_REDACT")).toBe(true);
    expect(isComplianceTopic("SHOP_REDACT")).toBe(true);
    expect(isComplianceTopic("APP_UNINSTALLED")).toBe(false);
  });

  it("builds raw and gid Shopify ID variants", () => {
    expect(
      buildShopifyIdVariants([123, "gid://shopify/Order/456"], "Order"),
    ).toEqual(["123", "gid://shopify/Order/123", "gid://shopify/Order/456"]);
  });

  it("summarizes compliance payloads without customer email or phone", () => {
    const summary = getComplianceWebhookSummary({
      topic: "CUSTOMERS_DATA_REQUEST",
      shop: "demo.myshopify.com",
      payload: {
        customer: {
          id: 191167,
          email: "john@example.com",
          phone: "555-625-1199",
        },
        orders_requested: [299938, 280263],
        data_request: { id: 9999 },
      } as never,
    });

    expect(summary).toEqual({
      topic: "customers/data_request",
      shop: "demo.myshopify.com",
      ordersRequestedCount: 2,
      ordersToRedactCount: 0,
      dataRequestId: "9999",
    });
    expect(JSON.stringify(summary)).not.toContain("john@example.com");
    expect(JSON.stringify(summary)).not.toContain("555-625-1199");
    expect(JSON.stringify(summary)).not.toContain("191167");
  });

  it("redacts stored order references for customer redaction requests", async () => {
    const prismaClient = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({ id: "shop-1" }),
      },
      analyticsEvent: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      uniqueDiscountCode: {
        updateMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
      attributionConversion: {
        deleteMany: vi.fn().mockResolvedValue({ count: 4 }),
      },
    };

    const result = await redactCustomerData({
      prismaClient: prismaClient as never,
      shop: "demo.myshopify.com",
      payload: { orders_to_redact: [299938] },
    });

    expect(result).toEqual({
      analyticsEventsUpdated: 2,
      uniqueDiscountCodesUpdated: 3,
      attributionConversionsDeleted: 4,
    });
    expect(prismaClient.analyticsEvent.updateMany).toHaveBeenCalledWith({
      where: {
        shopId: "shop-1",
        orderId: { in: ["299938", "gid://shopify/Order/299938"] },
      },
      data: { orderId: null },
    });
    expect(prismaClient.attributionConversion.deleteMany).toHaveBeenCalledWith({
      where: {
        shopId: "shop-1",
        orderId: { in: ["299938", "gid://shopify/Order/299938"] },
      },
    });
  });

  it("delegates shop redaction to the full shop data deletion service", async () => {
    privacyMock.deletePromoPulseShopData.mockResolvedValue({
      shopDomain: "demo.myshopify.com",
      shopId: "shop-1",
      deleted: [],
    });

    await redactShopData({
      prismaClient: { shop: {} } as never,
      shop: "demo.myshopify.com",
    });

    expect(privacyMock.deletePromoPulseShopData).toHaveBeenCalledWith(
      "demo.myshopify.com",
      { shop: {} },
    );
  });
});
