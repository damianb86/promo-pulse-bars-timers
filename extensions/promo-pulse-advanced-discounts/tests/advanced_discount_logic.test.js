import { describe, expect, test } from "vitest";

import {
  calculateCartLineDiscountOperations,
  calculateDeliveryDiscountOperations,
  normalizeAdvancedDiscountConfig,
} from "../src/advanced_discount_logic";

describe("Promo Pulse advanced discount logic", () => {
  test("normalizes a JSON config and ignores inactive rules", () => {
    expect(
      normalizeAdvancedDiscountConfig({
        ruleType: "TIERED_DISCOUNT",
        title: "Tiered",
        status: "ACTIVE",
        discountValue: 10,
        thresholds: [{ minimumSubtotal: 100, discountValue: 15 }],
      }),
    ).toMatchObject({
      ruleType: "TIERED_DISCOUNT",
      title: "Tiered",
      discountValue: { type: "PERCENTAGE", value: 10 },
      thresholds: [
        {
          minimumSubtotal: 100,
          discountValue: { type: "PERCENTAGE", value: 15 },
        },
      ],
    });

    expect(
      normalizeAdvancedDiscountConfig({
        ruleType: "TIERED_DISCOUNT",
        status: "PAUSED",
        discountValue: 10,
      }),
    ).toBeNull();
  });

  test("selects the highest qualifying tier for order discounts", () => {
    const result = calculateCartLineDiscountOperations(
      cartLineInput({
        ruleType: "TIERED_DISCOUNT",
        discountValue: 5,
        thresholds: [
          { minimumSubtotal: 50, discountValue: 10 },
          { minimumSubtotal: 100, discountValue: 15 },
        ],
      }),
    );

    expect(result.operations).toHaveLength(1);
    expect(
      result.operations[0].orderDiscountsAdd.candidates[0].value.percentage
        .value,
    ).toBe(15);
  });

  test("targets only configured products for cart-content rules", () => {
    const result = calculateCartLineDiscountOperations(
      cartLineInput({
        ruleType: "CART_CONTENTS",
        discountValue: 12,
        productIds: ["gid://shopify/Product/target"],
      }),
    );

    expect(result.operations).toHaveLength(1);
    expect(
      result.operations[0].productDiscountsAdd.candidates[0].targets,
    ).toEqual([{ cartLine: { id: "gid://shopify/CartLine/target" } }]);
  });

  test("requires the product condition before adding shipping discounts", () => {
    const result = calculateDeliveryDiscountOperations(
      deliveryInput({
        ruleType: "PRODUCT_SHIPPING_COMBO",
        discountValue: 10,
        shippingDiscountValue: 100,
        thresholds: [{ minimumSubtotal: 50 }],
        productIds: ["gid://shopify/Product/missing"],
      }),
    );

    expect(result.operations).toEqual([]);
  });
});

function cartLineInput(config) {
  return {
    discount: {
      discountClasses: ["ORDER", "PRODUCT", "SHIPPING"],
      metafield: {
        value: JSON.stringify({
          status: "ACTIVE",
          title: "Advanced",
          ...config,
        }),
      },
    },
    cart: {
      cost: { subtotalAmount: { amount: "125.00" } },
      lines: [
        cartLine(
          "gid://shopify/CartLine/control",
          "gid://shopify/Product/control",
        ),
        cartLine(
          "gid://shopify/CartLine/target",
          "gid://shopify/Product/target",
        ),
      ],
    },
  };
}

function deliveryInput(config) {
  return {
    ...cartLineInput(config),
    discount: {
      discountClasses: ["SHIPPING"],
      metafield: {
        value: JSON.stringify({
          status: "ACTIVE",
          title: "Advanced",
          ...config,
        }),
      },
    },
    cart: {
      ...cartLineInput(config).cart,
      deliveryGroups: [{ id: "gid://shopify/CartDeliveryGroup/1" }],
    },
  };
}

function cartLine(id, productId) {
  return {
    id,
    quantity: 1,
    cost: { subtotalAmount: { amount: "62.50" } },
    merchandise: {
      __typename: "ProductVariant",
      id: productId.replace("Product/", "ProductVariant/"),
      product: { id: productId },
    },
  };
}
