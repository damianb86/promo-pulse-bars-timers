import {
  AdvancedDiscountRuleStatus,
  AdvancedDiscountRuleType,
  ShopPlan,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADVANCED_DISCOUNT_METAFIELD_KEY,
  ADVANCED_DISCOUNT_METAFIELD_NAMESPACE,
  AdvancedDiscountsError,
  createAppDiscount,
  deleteAppDiscount,
  updateAppDiscount,
} from "./advancedDiscounts.server";

const prismaMock = vi.hoisted(() => ({
  advancedDiscountRule: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  campaign: {
    findFirst: vi.fn(),
  },
  shop: {
    findUnique: vi.fn(),
  },
}));

vi.mock("../../db.server", () => ({
  default: prismaMock,
}));

describe("advanced discounts service", () => {
  beforeEach(() => {
    vi.stubEnv("E2E_TEST_MODE", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.clearAllMocks();
    prismaMock.shop.findUnique.mockResolvedValue({ plan: ShopPlan.PRO });
    prismaMock.campaign.findFirst.mockResolvedValue({ id: "campaign-1" });
    prismaMock.advancedDiscountRule.create.mockImplementation(
      async ({ data }) => advancedRule(data),
    );
    prismaMock.advancedDiscountRule.update.mockImplementation(
      async ({ data }) => advancedRule(data),
    );
    prismaMock.advancedDiscountRule.delete.mockResolvedValue(
      advancedRule({ id: "rule-1" }),
    );
    prismaMock.advancedDiscountRule.findFirst.mockResolvedValue(
      advancedRule({
        id: "rule-1",
        shopifyDiscountId: "gid://shopify/DiscountAutomaticNode/123",
      }),
    );
  });

  it("creates an automatic app discount with function metafield config", async () => {
    const admin = mockAdmin({
      discountAutomaticAppCreate: {
        automaticAppDiscount: {
          discountId: "gid://shopify/DiscountAutomaticNode/123",
          status: "ACTIVE",
          appDiscountType: { functionId: "function-1" },
        },
        userErrors: [],
      },
    });

    await expect(
      createAppDiscount({
        admin,
        shopId: "shop-1",
        campaignId: "campaign-1",
        functionHandle: "promo-pulse-advanced-discounts",
        input: {
          title: "Spend 100 get 15",
          ruleType: AdvancedDiscountRuleType.TIERED_DISCOUNT,
          status: AdvancedDiscountRuleStatus.ACTIVE,
          discountValue: 10,
          thresholds: [{ minimumSubtotal: 100, discountValue: 15 }],
        },
      }),
    ).resolves.toMatchObject({
      remoteCreated: true,
      rule: {
        functionId: "function-1",
        shopifyDiscountId: "gid://shopify/DiscountAutomaticNode/123",
        status: AdvancedDiscountRuleStatus.ACTIVE,
      },
    });

    const variables = admin.graphql.mock.calls[0][1].variables;
    const appDiscount = variables.automaticAppDiscount;

    expect(appDiscount.functionHandle).toBe("promo-pulse-advanced-discounts");
    expect(appDiscount.discountClasses).toEqual(["ORDER"]);
    expect(appDiscount.metafields[0]).toMatchObject({
      namespace: ADVANCED_DISCOUNT_METAFIELD_NAMESPACE,
      key: ADVANCED_DISCOUNT_METAFIELD_KEY,
      type: "json",
    });
    expect(JSON.parse(appDiscount.metafields[0].value)).toMatchObject({
      ruleType: "TIERED_DISCOUNT",
      discountValue: 10,
      thresholds: [{ minimumSubtotal: 100, discountValue: 15 }],
    });
  });

  it("uses a controlled mock Shopify discount in E2E mode", async () => {
    vi.stubEnv("E2E_TEST_MODE", "true");

    await expect(
      createAppDiscount({
        admin: null,
        shopId: "shop-1",
        campaignId: "campaign-1",
        input: {
          title: "Free gift",
          ruleType: AdvancedDiscountRuleType.FREE_GIFT,
          status: AdvancedDiscountRuleStatus.ACTIVE,
          productIds: ["gid://shopify/ProductVariant/1"],
        },
      }),
    ).resolves.toMatchObject({
      remoteCreated: true,
      rule: {
        shopifyDiscountId: "e2e://advanced-discount/rule-1",
        status: AdvancedDiscountRuleStatus.ACTIVE,
      },
    });
  });

  it("deletes the remote automatic discount before deleting the local rule", async () => {
    const admin = mockAdmin({
      discountAutomaticDelete: {
        deletedAutomaticDiscountId: "gid://shopify/DiscountAutomaticNode/123",
        userErrors: [],
      },
    });

    await expect(
      deleteAppDiscount({ admin, shopId: "shop-1", ruleId: "rule-1" }),
    ).resolves.toMatchObject({
      remoteDeleted: true,
    });

    expect(admin.graphql.mock.calls[0][0]).toContain("discountAutomaticDelete");
    expect(prismaMock.advancedDiscountRule.delete).toHaveBeenCalledWith({
      where: { id: "rule-1" },
    });
  });

  it("removes the remote discount when an active rule is paused", async () => {
    const admin = mockAdmin({
      discountAutomaticDelete: {
        deletedAutomaticDiscountId: "gid://shopify/DiscountAutomaticNode/123",
        userErrors: [],
      },
    });
    prismaMock.advancedDiscountRule.update
      .mockResolvedValueOnce(
        advancedRule({
          shopifyDiscountId: "gid://shopify/DiscountAutomaticNode/123",
          status: AdvancedDiscountRuleStatus.PAUSED,
        }),
      )
      .mockResolvedValueOnce(
        advancedRule({
          shopifyDiscountId: null,
          status: AdvancedDiscountRuleStatus.PAUSED,
        }),
      );

    await expect(
      updateAppDiscount({
        admin,
        shopId: "shop-1",
        ruleId: "rule-1",
        input: {
          title: "Paused tiered rule",
          ruleType: AdvancedDiscountRuleType.TIERED_DISCOUNT,
          status: AdvancedDiscountRuleStatus.PAUSED,
          discountValue: 10,
        },
      }),
    ).resolves.toMatchObject({
      remoteCreated: false,
      rule: {
        shopifyDiscountId: null,
        status: AdvancedDiscountRuleStatus.PAUSED,
      },
    });

    expect(admin.graphql.mock.calls[0][0]).toContain("discountAutomaticDelete");
    expect(prismaMock.advancedDiscountRule.update).toHaveBeenLastCalledWith({
      where: { id: "rule-1" },
      data: {
        shopifyDiscountId: null,
        status: AdvancedDiscountRuleStatus.PAUSED,
      },
    });
  });

  it("blocks advanced discount rules below Pro", async () => {
    prismaMock.shop.findUnique.mockResolvedValue({ plan: ShopPlan.GROWTH });

    await expect(
      createAppDiscount({
        shopId: "shop-1",
        campaignId: "campaign-1",
        input: {
          title: "Tiered",
          ruleType: AdvancedDiscountRuleType.TIERED_DISCOUNT,
          status: AdvancedDiscountRuleStatus.ACTIVE,
          discountValue: 10,
        },
      }),
    ).rejects.toBeInstanceOf(AdvancedDiscountsError);
  });
});

function mockAdmin(data: Record<string, unknown>) {
  return {
    graphql: vi.fn().mockResolvedValue({
      json: async () => ({ data }),
    }),
  };
}

function advancedRule(overrides = {}) {
  return {
    id: "rule-1",
    shopId: "shop-1",
    campaignId: "campaign-1",
    title: "Advanced rule",
    ruleType: AdvancedDiscountRuleType.TIERED_DISCOUNT,
    thresholds: [],
    productIds: [],
    collectionIds: [],
    discountValue: null,
    shippingDiscountValue: null,
    status: AdvancedDiscountRuleStatus.DRAFT,
    functionId: null,
    shopifyDiscountId: null,
    startsAt: null,
    endsAt: null,
    createdAt: new Date("2026-06-18T12:00:00.000Z"),
    updatedAt: new Date("2026-06-18T12:00:00.000Z"),
    ...overrides,
  };
}
