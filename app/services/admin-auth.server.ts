import { redirect } from "react-router";

import { authenticate } from "../shopify.server";
import {
  E2E_DEMO_SHOP_DOMAIN,
  ensureE2EShop,
  hasE2EAuthCookie,
  isE2ETestMode,
} from "./e2e-test.server";

type ShopifyAdminAuth = Awaited<ReturnType<typeof authenticate.admin>>;

export async function authenticateAdmin(
  request: Request,
): Promise<ShopifyAdminAuth> {
  if (!isE2ETestMode()) {
    return authenticate.admin(request);
  }

  if (!hasE2EAuthCookie(request)) {
    const url = new URL(request.url);
    const returnTo = `${url.pathname}${url.search}`;
    throw redirect(`/__test/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  await ensureE2EShop();

  return {
    admin: createE2EAdminClient(),
    billing: {} as ShopifyAdminAuth["billing"],
    cors: (response: Response) => response,
    redirect,
    session: {
      id: `offline_${E2E_DEMO_SHOP_DOMAIN}`,
      shop: E2E_DEMO_SHOP_DOMAIN,
      state: "e2e",
      isOnline: false,
      scope:
        process.env.SCOPES ||
        "read_products,read_discounts,write_discounts,write_pixels,read_customer_events",
      accessToken: "e2e_access_token",
    },
  } as ShopifyAdminAuth;
}

function createE2EAdminClient(): ShopifyAdminAuth["admin"] {
  return {
    graphql: async () =>
      new Response(
        JSON.stringify({
          data: {
            codeDiscountNodeByCode: null,
            discountNodes: { nodes: [] },
            node: null,
          },
        }),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
        },
      ),
  } as ShopifyAdminAuth["admin"];
}
