import type { ActionFunctionArgs } from "react-router";

import { reconcileUsedCodesFromOrders } from "../services/discounts/reconciliation.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const result = await reconcileUsedCodesFromOrders({
    shopDomain: shop,
    order: isRecord(payload) ? payload : {},
  });

  return new Response(JSON.stringify({ ok: true, ...result }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
