import {
  CampaignGoal,
  CampaignStatus,
  CampaignType,
  DiscountSyncMethod,
  Prisma,
  ShopPlan,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildVisitorKey,
  generateUniqueDiscountCode,
  issueUniqueDiscountCode,
  normalizeUniqueCodePrefix,
  resolveUniqueCodeExpiresAt,
  UniqueDiscountCodeError,
} from "./unique-discount-codes.server";

const prismaMock = vi.hoisted(() => ({
  campaign: {
    findFirst: vi.fn(),
  },
  discountCodeGrant: {
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("../db.server", () => ({
  default: prismaMock,
}));

describe("unique discount codes", () => {
  const now = new Date("2026-06-18T15:00:00.000Z");

  beforeEach(() => {
    vi.stubEnv("PROMO_PULSE_DEV_PLAN", "");
    vi.stubEnv("COUNTERPULSE_DEV_PLAN", "");
    vi.stubEnv("PROMOPILOT_DEV_PLAN", "");
    vi.clearAllMocks();
    prismaMock.discountCodeGrant.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.discountCodeGrant.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("issues a real remote code and stores only a hashed visitor key", async () => {
    const campaign = uniqueCampaign();
    const expiresAt = new Date("2026-06-18T15:30:00.000Z");
    const createRemoteDiscount = vi.fn(async () => ({
      id: "gid://shopify/DiscountCodeNode/unique",
    }));

    prismaMock.campaign.findFirst.mockResolvedValue(campaign);
    prismaMock.discountCodeGrant.create.mockResolvedValue({
      id: "grant-1",
      campaignId: campaign.id,
      code: "VIP-ABC123",
      expiresAt,
    });
    prismaMock.discountCodeGrant.update.mockResolvedValue({
      id: "grant-1",
      campaignId: campaign.id,
      code: "VIP-ABC123",
      expiresAt,
    });

    await expect(
      issueUniqueDiscountCode({
        shopDomain: "Example.MyShopify.com",
        campaignId: campaign.id,
        visitorId: "visitor-123",
        cartToken: "cart-1",
        now,
        createCode: () => "VIP-ABC123",
        createRemoteDiscount,
      }),
    ).resolves.toEqual({
      campaignId: campaign.id,
      code: "VIP-ABC123",
      expiresAt: "2026-06-18T15:30:00.000Z",
      autoApply: true,
      autoApplyUrl: "/discount/VIP-ABC123",
      reused: false,
    });

    expect(prismaMock.discountCodeGrant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visitorKey: expect.not.stringContaining("visitor-123"),
          cartToken: "cart-1",
          code: "VIP-ABC123",
        }),
      }),
    );
    expect(createRemoteDiscount).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "VIP-ABC123",
        endsAt: expiresAt,
      }),
    );
  });

  it("reuses an unexpired issued grant for the same visitor", async () => {
    const campaign = uniqueCampaign();
    const expiresAt = new Date("2026-06-18T16:00:00.000Z");
    const createRemoteDiscount = vi.fn();

    prismaMock.campaign.findFirst.mockResolvedValue(campaign);
    prismaMock.discountCodeGrant.findFirst.mockResolvedValue({
      id: "grant-existing",
      code: "VIP-REUSE",
      expiresAt,
    });

    await expect(
      issueUniqueDiscountCode({
        shopDomain: "example.myshopify.com",
        campaignId: campaign.id,
        visitorId: "visitor-123",
        now,
        createRemoteDiscount,
      }),
    ).resolves.toMatchObject({
      code: "VIP-REUSE",
      reused: true,
    });

    expect(createRemoteDiscount).not.toHaveBeenCalled();
    expect(prismaMock.discountCodeGrant.create).not.toHaveBeenCalled();
  });

  it("blocks unique code issuing below Pro", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(
      uniqueCampaign({ shopPlan: ShopPlan.GROWTH }),
    );

    await expect(
      issueUniqueDiscountCode({
        shopDomain: "example.myshopify.com",
        campaignId: "campaign-1",
        visitorId: "visitor-123",
        now,
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: "Unique Discount Codes requires the Pro plan.",
    });
  });

  it("rejects campaigns that are not actively configured for unique codes", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(
      uniqueCampaign({
        status: CampaignStatus.PAUSED,
      }),
    );

    await expect(
      issueUniqueDiscountCode({
        shopDomain: "example.myshopify.com",
        campaignId: "campaign-1",
        visitorId: "visitor-123",
        now,
      }),
    ).rejects.toMatchObject({
      status: 409,
      message:
        "Unique discount codes can only be issued for active campaigns.",
    });
  });

  it("expires older visitor grants before creating a new code", async () => {
    const campaign = uniqueCampaign();
    const createRemoteDiscount = vi.fn(async () => ({ id: "remote-1" }));

    prismaMock.campaign.findFirst.mockResolvedValue(campaign);
    prismaMock.discountCodeGrant.create.mockResolvedValue({
      id: "grant-2",
      code: "VIP-NEW",
      expiresAt: null,
    });
    prismaMock.discountCodeGrant.update.mockResolvedValue({
      id: "grant-2",
      code: "VIP-NEW",
      expiresAt: null,
    });

    await issueUniqueDiscountCode({
      shopDomain: "example.myshopify.com",
      campaignId: campaign.id,
      visitorId: "visitor-123",
      now,
      createCode: () => "VIP-NEW",
      createRemoteDiscount,
    });

    expect(prismaMock.discountCodeGrant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          expiresAt: { lte: now },
        }),
        data: { status: "EXPIRED" },
      }),
    );
  });

  it("normalizes prefixes and hashes visitor ids deterministically", () => {
    expect(normalizeUniqueCodePrefix(" vip sale! ")).toBe("VIPSALE");
    expect(generateUniqueDiscountCode("sale")).toMatch(/^SALE-[A-F0-9]{10}$/);
    expect(
      buildVisitorKey(
        "https://Example.MyShopify.com/admin",
        "campaign-1",
        "visitor-123",
      ),
    ).toBe(
      buildVisitorKey(
        "example.myshopify.com",
        "campaign-1",
        "visitor-123",
      ),
    );
  });

  it("resolves the earliest real expiration from campaign, setting, and duration", () => {
    expect(
      resolveUniqueCodeExpiresAt(
        { endsAt: new Date("2026-06-18T18:00:00.000Z") },
        {
          uniqueCodeEndsAt: new Date("2026-06-18T17:00:00.000Z"),
          uniqueCodeExpiresMinutes: 30,
        },
        now,
      )?.toISOString(),
    ).toBe("2026-06-18T15:30:00.000Z");
  });

  it("throws a typed error when visitor ids are missing", () => {
    expect(() =>
      buildVisitorKey("example.myshopify.com", "campaign-1", "x"),
    ).toThrow(UniqueDiscountCodeError);
  });
});

function uniqueCampaign(
  overrides: {
    status?: CampaignStatus;
    shopPlan?: ShopPlan;
  } = {},
) {
  return {
    id: "campaign-1",
    shopId: "shop-1",
    name: "VIP Flash Sale",
    status: overrides.status ?? CampaignStatus.ACTIVE,
    type: CampaignType.COUNTDOWN_BAR,
    goal: CampaignGoal.FLASH_SALE,
    startsAt: new Date("2026-06-18T14:00:00.000Z"),
    endsAt: new Date("2026-06-18T18:00:00.000Z"),
    timezone: "America/New_York",
    priority: 0,
    createdAt: new Date("2026-06-18T13:00:00.000Z"),
    updatedAt: new Date("2026-06-18T13:00:00.000Z"),
    shop: {
      plan: overrides.shopPlan ?? ShopPlan.PRO,
    },
    discountSync: {
      campaignId: "campaign-1",
      shopifyDiscountId: null,
      discountCode: null,
      method: DiscountSyncMethod.UNIQUE_CODE,
      syncStartEnd: false,
      lastSyncedAt: null,
      title: "VIP unique discount",
      valueType: "PERCENTAGE",
      value: new Prisma.Decimal("15"),
      minimumSubtotal: null,
      appliesOncePerCustomer: true,
      uniqueCodePrefix: "VIP",
      uniqueCodeExpiresMinutes: 30,
      uniqueCodeAutoApply: true,
      uniqueCodeStartsAt: null,
      uniqueCodeEndsAt: null,
    },
  };
}
