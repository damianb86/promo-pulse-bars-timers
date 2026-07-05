import type { ActionFunctionArgs } from "react-router";

import { attributeOrderRevenue } from "../services/attribution/orderAttribution.server";
import { reconcileUsedCodesFromOrders } from "../services/discounts/reconciliation.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const order = isRecord(payload) ? payload : {};

  const result = await reconcileUsedCodesFromOrders({
    shopDomain: shop,
    order,
  });

  // Attribute the order's revenue to the campaign the buyer engaged with. This
  // is what powers the Orders / Revenue / RPV / Conversion metrics — the web
  // pixel cannot read campaign attribution from its sandbox, so orders are
  // attributed server-side here. Never let it break code reconciliation.
  let attribution;
  try {
    attribution = await attributeOrderRevenue({ shopDomain: shop, order });
  } catch (error) {
    console.error("Failed to attribute order revenue", error);
  }

  return new Response(JSON.stringify({ ok: true, ...result, attribution }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
