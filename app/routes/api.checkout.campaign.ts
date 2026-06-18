import type { LoaderFunctionArgs } from "react-router";

import { loadCheckoutCampaignResponse } from "../services/checkout/checkoutCampaignEndpoint.server";
import { isE2ETestMode } from "../services/e2e-test.server";
import { authenticate } from "../shopify.server";
import { normalizeShopDomain } from "../utils/storefront-campaigns";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (isE2ETestMode()) {
    return loadCheckoutCampaignResponse(request);
  }

  const { sessionToken, cors } = await authenticate.public.checkout(request, {
    corsHeaders: [
      "Cache-Control",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],
  });

  return loadCheckoutCampaignResponse(request, {
    authenticatedShopDomain: normalizeShopDomain(
      String(sessionToken.dest ?? ""),
    ),
    cors,
  });
};
