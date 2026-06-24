import {
  DiscountCodePoolStatus,
  UniqueDiscountCodeStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  expireOldAssignedCodes,
  reconcileUsedCodesFromOrders,
  revokeExpiredShopifyCodes,
} from "./reconciliation.server";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) =>
    callback(prismaMock),
  ),
  discountCodePool: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  shop: {
    findUnique: vi.fn(),
  },
  uniqueDiscountCode: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("../../db.server", () => ({
  default: prismaMock,
}));

vi.mock("../shopifyDiscounts.server", () => ({
  deactivateCodeDiscount: vi.fn(),
}));

describe("unique discount code reconciliation", () => {
  const now = new Date("2026-06-18T16:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.shop.findUnique.mockResolvedValue({ id: "shop-1" });
    prismaMock.discountCodePool.findFirst.mockResolvedValue(pool());
    prismaMock.discountCodePool.update.mockResolvedValue(pool());
    prismaMock.discountCodePool.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.uniqueDiscountCode.findMany.mockResolvedValue([]);
    prismaMock.uniqueDiscountCode.update.mockResolvedValue(uniqueCode());
    prismaMock.uniqueDiscountCode.updateMany.mockResolvedValue({ count: 1 });
  });

  it("marks a matching order discount code as used and increments the pool once", async () => {
    prismaMock.uniqueDiscountCode.findFirst.mockResolvedValue(
      uniqueCode({
        status: UniqueDiscountCodeStatus.ASSIGNED,
        code: "VIP-ORDER",
      }),
    );

    await expect(
      reconcileUsedCodesFromOrders({
        shopDomain: "demo-shop.myshopify.com",
        order: orderPayload({ code: "vip-order" }),
        occurredAt: now,
      }),
    ).resolves.toMatchObject({
      discountCodes: ["VIP-ORDER"],
      matched: 1,
      used: 1,
      alreadyUsed: 0,
      notFound: [],
      shopFound: true,
    });

    expect(prismaMock.uniqueDiscountCode.updateMany).toHaveBeenCalledWith({
      where: {
        id: "code-1",
        status: { not: UniqueDiscountCodeStatus.USED },
      },
      data: {
        status: UniqueDiscountCodeStatus.USED,
        usedAt: now,
        orderId: "gid://shopify/Order/1001",
      },
    });
    expect(prismaMock.discountCodePool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { totalUsed: { increment: 1 } },
    });
    expect(prismaMock.discountCodePool.findFirst).not.toHaveBeenCalled();
  });

  it("is idempotent when Shopify retries an already used code", async () => {
    prismaMock.uniqueDiscountCode.findFirst.mockResolvedValue(
      uniqueCode({
        status: UniqueDiscountCodeStatus.USED,
        code: "VIP-ORDER",
        orderId: "gid://shopify/Order/1001",
        usedAt: now,
      }),
    );

    await expect(
      reconcileUsedCodesFromOrders({
        shopId: "shop-1",
        order: orderPayload({ code: "VIP-ORDER" }),
        occurredAt: now,
      }),
    ).resolves.toMatchObject({
      matched: 1,
      used: 0,
      alreadyUsed: 1,
      notFound: [],
    });

    expect(prismaMock.uniqueDiscountCode.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.discountCodePool.update).not.toHaveBeenCalled();
  });

  it("does not fail when an order has no discounts", async () => {
    await expect(
      reconcileUsedCodesFromOrders({
        shopDomain: "demo-shop.myshopify.com",
        order: { id: 1002, discount_codes: [] },
        occurredAt: now,
      }),
    ).resolves.toMatchObject({
      discountCodes: [],
      matched: 0,
      used: 0,
      notFound: [],
    });

    expect(prismaMock.shop.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.uniqueDiscountCode.findFirst).not.toHaveBeenCalled();
  });

  it("reports discount codes that are not managed by Promo Pulse", async () => {
    prismaMock.uniqueDiscountCode.findFirst.mockResolvedValue(null);

    await expect(
      reconcileUsedCodesFromOrders({
        shopDomain: "demo-shop.myshopify.com",
        order: orderPayload({ code: "OTHER10" }),
        occurredAt: now,
      }),
    ).resolves.toMatchObject({
      discountCodes: ["OTHER10"],
      matched: 0,
      used: 0,
      notFound: ["OTHER10"],
    });
  });

  it("reassigns old assigned codes for enabled pools, expires the rest, and expires old pools", async () => {
    prismaMock.uniqueDiscountCode.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });
    prismaMock.discountCodePool.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      expireOldAssignedCodes({ shopId: "shop-1", now }),
    ).resolves.toEqual({
      expiredCodes: 3,
      expiredPools: 1,
    });

    expect(prismaMock.uniqueDiscountCode.updateMany).toHaveBeenNthCalledWith(
      1,
      {
        where: {
          shopId: "shop-1",
          status: UniqueDiscountCodeStatus.ASSIGNED,
          expiresAt: { lte: now },
          pool: { is: { reassignExpiredUnused: true } },
        },
        data: {
          status: UniqueDiscountCodeStatus.AVAILABLE,
          visitorId: null,
          sessionId: null,
          assignedAt: null,
          expiresAt: null,
        },
      },
    );
    expect(prismaMock.uniqueDiscountCode.updateMany).toHaveBeenNthCalledWith(
      2,
      {
        where: {
          shopId: "shop-1",
          status: UniqueDiscountCodeStatus.ASSIGNED,
          expiresAt: { lte: now },
          OR: [
            { poolId: null },
            { pool: { is: { reassignExpiredUnused: false } } },
          ],
        },
        data: { status: UniqueDiscountCodeStatus.EXPIRED },
      },
    );
    expect(prismaMock.discountCodePool.updateMany).toHaveBeenCalledWith({
      where: {
        shopId: "shop-1",
        status: DiscountCodePoolStatus.ACTIVE,
        expiresAt: { lte: now },
      },
      data: { status: DiscountCodePoolStatus.EXPIRED },
    });
  });

  it("skips Shopify revocation when no Admin client or deactivator is available", async () => {
    prismaMock.uniqueDiscountCode.findMany.mockResolvedValue([
      uniqueCode({
        status: UniqueDiscountCodeStatus.EXPIRED,
        shopifyDiscountId: "gid://shopify/DiscountCodeNode/1",
      }),
    ]);

    await expect(
      revokeExpiredShopifyCodes({ shopId: "shop-1" }),
    ).resolves.toEqual({
      revoked: 0,
      skipped: 1,
      failed: [],
    });
  });
});

function orderPayload({ code }: { code: string }) {
  return {
    id: 1001,
    admin_graphql_api_id: "gid://shopify/Order/1001",
    created_at: "2026-06-18T15:59:00.000Z",
    discount_codes: [{ code }],
  };
}

function pool(overrides = {}) {
  return {
    id: "pool-1",
    shopId: "shop-1",
    campaignId: "campaign-1",
    prefix: "VIP",
    totalUsed: 0,
    ...overrides,
  };
}

function uniqueCode(overrides = {}) {
  return {
    id: "code-1",
    shopId: "shop-1",
    campaignId: "campaign-1",
    poolId: "pool-1",
    code: "VIP-ORDER",
    status: UniqueDiscountCodeStatus.ASSIGNED,
    orderId: null,
    usedAt: null,
    shopifyDiscountId: null,
    ...overrides,
  };
}
