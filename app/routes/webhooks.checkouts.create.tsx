import type { ActionFunctionArgs } from "react-router";

import { attributeCheckoutStarted } from "../services/attribution/orderAttribution.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const checkout = isRecord(payload) ? payload : {};

  // Attribute the checkout to the campaign the buyer engaged with. This powers
  // the "Checkout" metric reliably server-side; the storefront theme can only
  // heuristically detect checkout button clicks, and the web pixel cannot read
  // campaign attribution from its sandbox. Never let it fail the webhook.
  let attribution;
  try {
    attribution = await attributeCheckoutStarted({ shopDomain: shop, checkout });
  } catch (error) {
    console.error("Failed to attribute checkout", error);
  }

  return new Response(JSON.stringify({ ok: true, attribution }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
