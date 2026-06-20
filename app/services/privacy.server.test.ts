import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deletePromoPulseShopData,
  getPromoPulseDataCounts,
} from "./privacy.server";

const modelNames = [
  "shopSettings",
  "shopOnboardingChecklist",
  "campaign",
  "analyticsEvent",
  "discountCodeGrant",
  "uniqueDiscountCode",
  "discountCodePool",
  "advancedDiscountRule",
  "experiment",
  "attributionTouch",
  "attributionConversion",
  "emailTimer",
  "advancedBadgeRule",
  "marketCampaignRule",
  "campaignRecommendation",
  "agencyShopAccess",
  "contactRequest",
] as const;

type MockFn = ReturnType<typeof vi.fn>;
type MockModel = {
  count: MockFn;
  deleteMany: MockFn;
  findMany: MockFn;
};
type PrismaMock = Record<(typeof modelNames)[number], MockModel> & {
  shop: {
    count: MockFn;
    deleteMany: MockFn;
    findUnique: MockFn;
  };
  session: {
    count: MockFn;
    deleteMany: MockFn;
  };
  agencyAccount: {
    deleteMany: MockFn;
  };
};

describe("privacy.server", () => {
  let prismaMock: PrismaMock;

  beforeEach(() => {
    prismaMock = createPrismaMock();
  });

  it("counts app-owned records for a shop domain", async () => {
    prismaMock.session.count.mockResolvedValue(2);
    prismaMock.shop.count.mockResolvedValue(1);
    prismaMock.campaign.count.mockResolvedValue(3);
    prismaMock.analyticsEvent.count.mockResolvedValue(8);
    prismaMock.discountCodeGrant.count.mockResolvedValue(1);
    prismaMock.uniqueDiscountCode.count.mockResolvedValue(2);
    prismaMock.discountCodePool.count.mockResolvedValue(1);
    prismaMock.advancedDiscountRule.count.mockResolvedValue(1);
    prismaMock.experiment.count.mockResolvedValue(4);
    prismaMock.attributionTouch.count.mockResolvedValue(5);
    prismaMock.attributionConversion.count.mockResolvedValue(6);
    prismaMock.emailTimer.count.mockResolvedValue(7);
    prismaMock.advancedBadgeRule.count.mockResolvedValue(9);
    prismaMock.marketCampaignRule.count.mockResolvedValue(10);
    prismaMock.campaignRecommendation.count.mockResolvedValue(11);
    prismaMock.agencyShopAccess.count.mockResolvedValue(12);
    prismaMock.contactRequest.count.mockResolvedValue(13);

    const counts = await getPromoPulseDataCounts(
      "demo.myshopify.com",
      prismaMock as unknown as Parameters<typeof getPromoPulseDataCounts>[1],
    );

    expect(counts).toMatchObject({
      shopRecords: 1,
      sessions: 2,
      campaigns: 3,
      analyticsEvents: 8,
      discountRecords: 5,
      experiments: 4,
      attributionRows: 11,
      emailTimers: 7,
      advancedRules: 10,
      marketRules: 10,
      recommendations: 11,
      agencyAccesses: 12,
      contactRequests: 13,
    });
    expect(prismaMock.shop.findUnique).toHaveBeenCalledWith({
      where: { shopifyDomain: "demo.myshopify.com" },
      select: { id: true, shopifyDomain: true },
    });
  });

  it("deletes sessions by domain and the shop by id to cascade shop data", async () => {
    prismaMock.agencyShopAccess.findMany.mockResolvedValue([
      { agencyId: "agency-1" },
    ]);

    const result = await deletePromoPulseShopData(
      "demo.myshopify.com",
      prismaMock as unknown as Parameters<typeof deletePromoPulseShopData>[1],
    );

    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { shop: "demo.myshopify.com" },
    });
    expect(prismaMock.shop.deleteMany).toHaveBeenCalledWith({
      where: { id: "shop-1" },
    });
    expect(prismaMock.agencyAccount.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["agency-1"] },
        shopAccesses: { none: {} },
      },
    });
    expect(result).toMatchObject({
      shopDomain: "demo.myshopify.com",
      shopId: "shop-1",
      deleted: expect.arrayContaining([
        { model: "session", count: 1 },
        { model: "shop", count: 1 },
        { model: "agencyAccount", count: 1 },
      ]),
    });
  });

  it("still removes sessions and domain-scoped contact rows when the shop record is missing", async () => {
    prismaMock.shop.findUnique.mockResolvedValue(null);

    const result = await deletePromoPulseShopData(
      "missing.myshopify.com",
      prismaMock as unknown as Parameters<typeof deletePromoPulseShopData>[1],
    );

    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { shop: "missing.myshopify.com" },
    });
    expect(prismaMock.contactRequest.deleteMany).toHaveBeenCalledWith({
      where: { shopDomain: "missing.myshopify.com" },
    });
    expect(prismaMock.shop.deleteMany).not.toHaveBeenCalled();
    expect(result.shopId).toBeNull();
  });
});

function createPrismaMock() {
  const models = Object.fromEntries(
    modelNames.map((modelName) => [
      modelName,
      {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    ]),
  );

  return {
    ...models,
    shop: {
      count: vi.fn().mockResolvedValue(1),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({
        id: "shop-1",
        shopifyDomain: "demo.myshopify.com",
      }),
    },
    session: {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    agencyAccount: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as PrismaMock;
}
