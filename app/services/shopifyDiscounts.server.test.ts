import { describe, expect, it, vi } from "vitest";

import {
  createBasicCodeDiscount,
  createFreeShippingCodeDiscount,
  deactivateCodeDiscount,
  getDiscountByCodeOrId,
  listCodeDiscounts,
  syncCampaignDatesFromDiscount,
  type ShopifyGraphqlClient,
} from "./shopifyDiscounts.server";

describe("shopifyDiscounts service", () => {
  it("lists code discounts from discountNodes", async () => {
    const admin = mockAdmin({
      data: {
        discountNodes: {
          nodes: [discountAdminNode({ code: "FLASH20" })],
        },
      },
    });

    await expect(listCodeDiscounts(admin)).resolves.toMatchObject([
      { code: "FLASH20", id: "gid://shopify/DiscountNode/1" },
    ]);
    expect(admin.graphql).toHaveBeenCalledWith(
      expect.stringContaining("discountNodes"),
      expect.objectContaining({
        variables: expect.objectContaining({ query: "method:code" }),
      }),
    );
    expect(firstGraphqlQuery(admin)).toContain(
      "fragment CounterPulseDiscountNodeFields on DiscountNode",
    );
    expect(firstGraphqlQuery(admin)).toContain(
      "...CounterPulseDiscountNodeFields",
    );
  });

  it("gets a discount by code", async () => {
    const admin = mockAdmin({
      data: {
        codeDiscountNodeByCode: discountNode({ code: "SAVE10" }),
      },
    });

    await expect(getDiscountByCodeOrId(admin, "SAVE10")).resolves.toMatchObject(
      {
        code: "SAVE10",
      },
    );
  });

  it("gets a discount by DiscountNode id", async () => {
    const admin = mockAdmin({
      data: {
        node: discountAdminNode({ code: "NODE10" }),
      },
    });

    await expect(
      getDiscountByCodeOrId(admin, "gid://shopify/DiscountNode/1"),
    ).resolves.toMatchObject({
      code: "NODE10",
      id: "gid://shopify/DiscountNode/1",
    });
    expect(firstGraphqlQuery(admin)).toContain("... on DiscountNode");
    expect(firstGraphqlQuery(admin)).toContain("... on DiscountCodeNode");
  });

  it("creates a percentage discount with normalized percentage value", async () => {
    const admin = mockAdmin({
      data: {
        discountCodeBasicCreate: {
          codeDiscountNode: discountNode({ code: "TENOFF" }),
          userErrors: [],
        },
      },
    });

    await createBasicCodeDiscount(admin, {
      title: "Ten off",
      code: "TENOFF",
      valueType: "PERCENTAGE",
      value: 10,
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: null,
      appliesOncePerCustomer: true,
    });

    expect(admin.graphql).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        variables: expect.objectContaining({
          input: expect.objectContaining({
            customerGets: expect.objectContaining({
              value: { percentage: 0.1 },
            }),
          }),
        }),
      }),
    );
  });

  it("creates a fixed amount discount", async () => {
    const admin = mockAdmin({
      data: {
        discountCodeBasicCreate: {
          codeDiscountNode: discountNode({ code: "SAVE5" }),
          userErrors: [],
        },
      },
    });

    await createBasicCodeDiscount(admin, {
      title: "Five off",
      code: "SAVE5",
      valueType: "FIXED_AMOUNT",
      value: 5,
      startsAt: null,
      endsAt: null,
      appliesOncePerCustomer: false,
    });

    expect(admin.graphql).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        variables: expect.objectContaining({
          input: expect.objectContaining({
            customerGets: expect.objectContaining({
              value: {
                discountAmount: {
                  amount: "5.00",
                  appliesOnEachItem: false,
                },
              },
            }),
          }),
        }),
      }),
    );
  });

  it("creates a free shipping discount with optional minimum subtotal", async () => {
    const admin = mockAdmin({
      data: {
        discountCodeFreeShippingCreate: {
          codeDiscountNode: discountNode({
            code: "SHIPFREE",
            type: "DiscountCodeFreeShipping",
          }),
          userErrors: [],
        },
      },
    });

    await createFreeShippingCodeDiscount(admin, {
      title: "Free ship",
      code: "SHIPFREE",
      startsAt: null,
      endsAt: null,
      minimumSubtotal: 50,
      appliesOncePerCustomer: false,
    });

    expect(admin.graphql).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        variables: expect.objectContaining({
          input: expect.objectContaining({
            minimumRequirement: {
              subtotal: { greaterThanOrEqualToSubtotal: "50.00" },
            },
          }),
        }),
      }),
    );
  });

  it("throws clear Shopify user errors", async () => {
    const admin = mockAdmin({
      data: {
        discountCodeBasicCreate: {
          codeDiscountNode: null,
          userErrors: [{ message: "Code has already been taken" }],
        },
      },
    });

    await expect(
      createBasicCodeDiscount(admin, {
        title: "Duplicate",
        code: "SAVE5",
        valueType: "FIXED_AMOUNT",
        value: 5,
        startsAt: null,
        endsAt: null,
        appliesOncePerCustomer: false,
      }),
    ).rejects.toThrow("Code has already been taken");
  });

  it("deactivates a code discount by id", async () => {
    const admin = mockAdmin({
      data: {
        discountCodeDeactivate: {
          codeDiscountNode: {
            id: "gid://shopify/DiscountCodeNode/1",
          },
          userErrors: [],
        },
      },
    });

    await expect(
      deactivateCodeDiscount(admin, "gid://shopify/DiscountCodeNode/1"),
    ).resolves.toEqual({ id: "gid://shopify/DiscountCodeNode/1" });
    expect(firstGraphqlQuery(admin)).toContain("discountCodeDeactivate");
    expect(admin.graphql).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        variables: { id: "gid://shopify/DiscountCodeNode/1" },
      }),
    );
  });

  it("syncs campaign dates when enabled", () => {
    const result = syncCampaignDatesFromDiscount(
      { syncStartEnd: true },
      {
        startsAt: "2026-01-01T00:00:00Z",
        endsAt: "2026-01-03T00:00:00Z",
      },
    );

    expect(result?.startsAt?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(result?.endsAt?.toISOString()).toBe("2026-01-03T00:00:00.000Z");
  });
});

function mockAdmin(payload: unknown): ShopifyGraphqlClient {
  return {
    graphql: vi.fn(async () => Response.json(payload)),
  };
}

function discountNode({
  code,
  type = "DiscountCodeBasic",
}: {
  code: string;
  type?: string;
}) {
  return {
    id: "gid://shopify/DiscountCodeNode/1",
    codeDiscount: {
      __typename: type,
      title: code,
      status: "ACTIVE",
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: null,
      codes: { nodes: [{ code }] },
    },
  };
}

function discountAdminNode({
  code,
  type = "DiscountCodeBasic",
}: {
  code: string;
  type?: string;
}) {
  return {
    id: "gid://shopify/DiscountNode/1",
    discount: {
      __typename: type,
      title: code,
      status: "ACTIVE",
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: null,
      codes: { nodes: [{ code }] },
    },
  };
}

function firstGraphqlQuery(admin: ShopifyGraphqlClient) {
  return vi.mocked(admin.graphql).mock.calls[0]?.[0] ?? "";
}
