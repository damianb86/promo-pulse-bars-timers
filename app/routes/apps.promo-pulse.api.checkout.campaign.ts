import type { LoaderFunctionArgs } from "react-router";

import { loadCheckoutCampaignResponse } from "../services/checkout/checkoutCampaignEndpoint.server";
import { isE2ETestMode } from "../services/e2e-test.server";
import { authenticate } from "../shopify.server";
import { normalizeShopDomain } from "../utils/storefront-campaigns";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!isE2ETestMode()) {
    await authenticate.public.appProxy(request);
  }

  const url = new URL(request.url);

  return loadCheckoutCampaignResponse(request, {
    authenticatedShopDomain: normalizeShopDomain(url.searchParams.get("shop")),
  });
};
