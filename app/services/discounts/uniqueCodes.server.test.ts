import {
  DiscountCodePoolStatus,
  DiscountCodeValueType,
  Prisma,
  ShopPlan,
  UniqueDiscountCodeStatus,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assignCodeToVisitor,
  createDiscountCodePool,
  createShopifyDiscountForCode,
  expireVisitorCode,
  generateCodeBatch,
  getAssignedCodeForVisitor,
  getUniqueCodeStatsForCampaign,
  UniqueCodesError,
} from "./uniqueCodes.server";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) =>
    callback(prismaMock),
  ),
  campaign: {
    findFirst: vi.fn(),
  },
  discountCodePool: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  uniqueDiscountCode: {
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("../../db.server", () => ({
  default: prismaMock,
}));

describe("Stage 2 unique discount code pools", () => {
  const now = new Date("2026-06-18T15:00:00.000Z");

  beforeEach(() => {
    vi.stubEnv("E2E_TEST_MODE", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PROMO_PULSE_DEV_PLAN", "");
    vi.stubEnv("COUNTERPULSE_DEV_PLAN", "");
    vi.stubEnv("PROMOPILOT_DEV_PLAN", "");
    vi.clearAllMocks();
    prismaMock.campaign.findFirst.mockResolvedValue(campaign());
    prismaMock.discountCodePool.create.mockImplementation(async ({ data }) => ({
      id: "pool-1",
      createdAt: now,
      updatedAt: now,
      totalGenerated: 0,
      totalAssigned: 0,
      totalUsed: 0,
      ...data,
    }));
    prismaMock.discountCodePool.findFirst.mockResolvedValue(pool());
    prismaMock.discountCodePool.aggregate.mockResolvedValue({
      _sum: { totalAssigned: 0, totalUsed: 0 },
    });
    prismaMock.discountCodePool.update.mockImplementation(async ({ data }) => ({
      ...pool(),
      ...data,
    }));
    prismaMock.uniqueDiscountCode.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.uniqueDiscountCode.count.mockResolvedValue(0);
    prismaMock.uniqueDiscountCode.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a gated active pool for a Premium campaign", async () => {
    await expect(
      createDiscountCodePool({
        shopId: "shop-1",
        campaignId: "campaign-1",
        prefix: " vip sale ",
        discountType: DiscountCodeValueType.PERCENTAGE,
        value: 15,
        startsAt: now,
        expiresAt: new Date("2026-06-19T15:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      prefix: "VIPSALE",
      discountType: DiscountCodeValueType.PERCENTAGE,
      status: DiscountCodePoolStatus.ACTIVE,
    });

    expect(prismaMock.discountCodePool.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        value: new Prisma.Decimal(15),
      }),
    });
  });

  it("generates a batch and creates remote Shopify discounts", async () => {
    const createRemoteDiscount = vi
      .fn()
      .mockResolvedValueOnce({ id: "gid://shopify/DiscountCodeNode/1" })
      .mockResolvedValueOnce({ id: "gid://shopify/DiscountCodeNode/2" });

    prismaMock.uniqueDiscountCode.create
      .mockResolvedValueOnce(uniqueCode({ id: "code-1", code: "VIP-000001" }))
      .mockResolvedValueOnce(uniqueCode({ id: "code-2", code: "VIP-000002" }));
    prismaMock.uniqueDiscountCode.update
      .mockResolvedValueOnce(
        uniqueCode({
          id: "code-1",
          code: "VIP-000001",
          shopifyDiscountId: "gid://shopify/DiscountCodeNode/1",
        }),
      )
      .mockResolvedValueOnce(
        uniqueCode({
          id: "code-2",
          code: "VIP-000002",
          shopifyDiscountId: "gid://shopify/DiscountCodeNode/2",
        }),
      );

    await expect(
      generateCodeBatch({
        shopId: "shop-1",
        campaignId: "campaign-1",
        poolId: "pool-1",
        totalCodes: 2,
        now,
        createCode: () =>
          `VIP-00000${prismaMock.uniqueDiscountCode.create.mock.calls.length + 1}`,
        createRemoteDiscount,
      }),
    ).resolves.toMatchObject({
      codes: [
        {
          code: "VIP-000001",
          shopifyDiscountId: "gid://shopify/DiscountCodeNode/1",
        },
        {
          code: "VIP-000002",
          shopifyDiscountId: "gid://shopify/DiscountCodeNode/2",
        },
      ],
    });

    expect(createRemoteDiscount).toHaveBeenCalledTimes(2);
    expect(prismaMock.discountCodePool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: {
        totalGenerated: { increment: 2 },
        status: DiscountCodePoolStatus.ACTIVE,
      },
    });
  });

  it("assigns an existing valid code idempotently for a visitor", async () => {
    const existingCode = uniqueCode({
      status: UniqueDiscountCodeStatus.ASSIGNED,
      visitorId: "visitor-123",
      expiresAt: new Date("2026-06-18T16:00:00.000Z"),
    });

    prismaMock.uniqueDiscountCode.findFirst.mockResolvedValue(existingCode);

    await expect(
      assignCodeToVisitor({
        shopId: "shop-1",
        campaignId: "campaign-1",
        visitorId: "visitor-123",
        sessionId: "session-1",
        now,
      }),
    ).resolves.toEqual({ code: existingCode, reused: true });

    expect(prismaMock.uniqueDiscountCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: UniqueDiscountCodeStatus.EXPIRED },
      }),
    );
    expect(prismaMock.discountCodePool.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalAssigned: { increment: 1 } }),
      }),
    );
  });

  it("assigns the next available non-expired code and sets visitor expiration", async () => {
    prismaMock.uniqueDiscountCode.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        uniqueCode({ id: "code-available", code: "VIP-1" }),
      )
      .mockResolvedValueOnce(
        uniqueCode({
          id: "code-available",
          code: "VIP-1",
          status: UniqueDiscountCodeStatus.ASSIGNED,
          visitorId: "visitor-123",
          sessionId: "session-1",
          assignedAt: now,
          expiresAt: new Date("2026-06-18T15:45:00.000Z"),
        }),
      );

    await expect(
      assignCodeToVisitor({
        shopId: "shop-1",
        campaignId: "campaign-1",
        visitorId: "visitor-123",
        sessionId: "session-1",
        now,
      }),
    ).resolves.toMatchObject({
      code: {
        code: "VIP-1",
        status: UniqueDiscountCodeStatus.ASSIGNED,
      },
      reused: false,
    });

    expect(prismaMock.uniqueDiscountCode.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: UniqueDiscountCodeStatus.AVAILABLE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        }),
      }),
    );
    expect(prismaMock.uniqueDiscountCode.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: "code-available",
        status: UniqueDiscountCodeStatus.AVAILABLE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: expect.objectContaining({
        status: UniqueDiscountCodeStatus.ASSIGNED,
        visitorId: "visitor-123",
        sessionId: "session-1",
        expiresAt: new Date("2026-06-18T15:45:00.000Z"),
      }),
    });
  });

  it("does not assign when the pool is exhausted", async () => {
    prismaMock.uniqueDiscountCode.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      assignCodeToVisitor({
        shopId: "shop-1",
        campaignId: "campaign-1",
        visitorId: "visitor-123",
        now,
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "Unique discount code pool is exhausted.",
    });

    expect(prismaMock.discountCodePool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { status: DiscountCodePoolStatus.EXHAUSTED },
    });
  });

  it("expires visitor codes", async () => {
    prismaMock.uniqueDiscountCode.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      expireVisitorCode({
        shopId: "shop-1",
        campaignId: "campaign-1",
        visitorId: "visitor-123",
        now,
      }),
    ).resolves.toEqual({ count: 1 });

    expect(prismaMock.uniqueDiscountCode.updateMany).toHaveBeenCalledWith({
      where: {
        shopId: "shop-1",
        campaignId: "campaign-1",
        visitorId: "visitor-123",
        status: UniqueDiscountCodeStatus.ASSIGNED,
      },
      data: {
        status: UniqueDiscountCodeStatus.EXPIRED,
        expiresAt: now,
      },
    });
  });

  it("reads an assigned visitor code without returning expired assignments", async () => {
    prismaMock.uniqueDiscountCode.findFirst.mockResolvedValue(
      uniqueCode({ status: UniqueDiscountCodeStatus.ASSIGNED }),
    );

    await getAssignedCodeForVisitor({
      shopId: "shop-1",
      campaignId: "campaign-1",
      visitorId: "visitor-123",
      now,
    });

    expect(prismaMock.uniqueDiscountCode.findFirst).toHaveBeenCalledWith({
      where: {
        shopId: "shop-1",
        campaignId: "campaign-1",
        visitorId: "visitor-123",
        status: UniqueDiscountCodeStatus.ASSIGNED,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
    });
  });

  it("summarizes assigned, used, expired, and conversion rate", async () => {
    prismaMock.discountCodePool.aggregate.mockResolvedValue({
      _sum: { totalAssigned: 8, totalUsed: 2 },
    });
    prismaMock.uniqueDiscountCode.count.mockResolvedValue(3);

    await expect(
      getUniqueCodeStatsForCampaign("shop-1", "campaign-1"),
    ).resolves.toEqual({
      totalAssigned: 8,
      totalUsed: 2,
      totalExpired: 3,
      conversionRate: 0.25,
    });

    expect(prismaMock.discountCodePool.aggregate).toHaveBeenCalledWith({
      where: { shopId: "shop-1", campaignId: "campaign-1" },
      _sum: {
        totalAssigned: true,
        totalUsed: true,
      },
    });
    expect(prismaMock.uniqueDiscountCode.count).toHaveBeenCalledWith({
      where: {
        shopId: "shop-1",
        campaignId: "campaign-1",
        status: UniqueDiscountCodeStatus.EXPIRED,
      },
    });
  });

  it("uses E2E mock Shopify IDs without a real Admin client", async () => {
    vi.stubEnv("E2E_TEST_MODE", "true");
    vi.stubEnv("NODE_ENV", "test");

    await expect(
      createShopifyDiscountForCode({
        admin: null,
        pool: pool(),
        campaign: campaign(),
        code: "VIP-E2E",
        now,
      }),
    ).resolves.toEqual({ id: "e2e://VIP-E2E" });
  });

  it("surfaces Shopify userErrors from the Admin API", async () => {
    const admin = {
      graphql: vi.fn(async () =>
        Response.json({
          data: {
            discountCodeBasicCreate: {
              codeDiscountNode: null,
              userErrors: [{ message: "Code has already been taken" }],
            },
          },
        }),
      ),
    };

    await expect(
      createShopifyDiscountForCode({
        admin,
        pool: pool(),
        campaign: campaign(),
        code: "VIP-DUPE",
        now,
      }),
    ).rejects.toThrow("Code has already been taken");
  });

  it("blocks pool creation below Premium", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(
      campaign({ plan: ShopPlan.GROWTH }),
    );

    await expect(
      createDiscountCodePool({
        shopId: "shop-1",
        campaignId: "campaign-1",
        prefix: "VIP",
        discountType: DiscountCodeValueType.PERCENTAGE,
        value: 10,
      }),
    ).rejects.toBeInstanceOf(UniqueCodesError);
  });
});

function campaign(overrides: { plan?: ShopPlan } = {}) {
  return {
    id: "campaign-1",
    shopId: "shop-1",
    name: "VIP Sale",
    startsAt: new Date("2026-06-18T14:00:00.000Z"),
    endsAt: new Date("2026-06-18T17:00:00.000Z"),
    shop: { plan: overrides.plan ?? ShopPlan.PREMIUM },
    discountSync: { uniqueCodeExpiresMinutes: 45 },
  };
}

function pool(overrides = {}) {
  return {
    id: "pool-1",
    shopId: "shop-1",
    campaignId: "campaign-1",
    prefix: "VIP",
    discountType: DiscountCodeValueType.PERCENTAGE,
    value: new Prisma.Decimal(10),
    startsAt: new Date("2026-06-18T14:00:00.000Z"),
    expiresAt: new Date("2026-06-18T18:00:00.000Z"),
    totalGenerated: 2,
    totalAssigned: 0,
    totalUsed: 0,
    status: DiscountCodePoolStatus.ACTIVE,
    createdAt: new Date("2026-06-18T13:00:00.000Z"),
    updatedAt: new Date("2026-06-18T13:00:00.000Z"),
    ...overrides,
  };
}

function uniqueCode(overrides = {}) {
  return {
    id: "code-1",
    shopId: "shop-1",
    campaignId: "campaign-1",
    visitorId: null,
    sessionId: null,
    code: "VIP-CODE",
    shopifyDiscountId: null,
    status: UniqueDiscountCodeStatus.AVAILABLE,
    assignedAt: null,
    expiresAt: null,
    usedAt: null,
    orderId: null,
    createdAt: new Date("2026-06-18T13:00:00.000Z"),
    updatedAt: new Date("2026-06-18T13:00:00.000Z"),
    ...overrides,
  };
}
