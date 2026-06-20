import { test, expect } from "./helpers/fixtures";
import {
  E2E_PREFIX,
  getConfig,
  skipIfMissingRequiredEnv,
  skipIfRealE2EDisabled,
} from "./helpers/env";
import { createE2EOrder } from "./helpers/shopify-admin-api";

test.describe("real order creation", () => {
  skipIfRealE2EDisabled(test);
  skipIfMissingRequiredEnv(test);

  test("creates a prefixed order through Shopify Admin API", async ({
    request,
  }) => {
    const config = getConfig();
    test.skip(
      !config.allowOrder,
      "Set REAL_E2E_ALLOW_ORDER=true to create a real Shopify order.",
    );
    test.skip(
      !config.adminAccessToken,
      "Set SHOPIFY_ADMIN_ACCESS_TOKEN with write_orders scope to create a real Shopify order.",
    );

    const order = await createE2EOrder(request);

    expect(order.id).toMatch(/^gid:\/\/shopify\/Order\//);
    expect(order.email).toMatch(/^pp-e2e\+/);
    expect(order.lineItems.nodes[0]).toMatchObject({
      quantity: 1,
      title: expect.stringContaining(E2E_PREFIX),
    });
    expect(order.totalPriceSet.shopMoney.currencyCode).toBe("USD");
  });
});
