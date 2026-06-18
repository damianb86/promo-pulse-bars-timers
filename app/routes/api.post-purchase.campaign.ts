import type { LoaderFunctionArgs } from "react-router";

import { loadPostPurchaseCampaignResponse } from "../services/post-purchase/postPurchaseCampaignEndpoint.server";
import { normalizePostPurchaseSurface } from "../services/post-purchase/postPurchaseCampaignViewModel";
import { isE2ETestMode } from "../services/e2e-test.server";
import { authenticate } from "../shopify.server";
import { normalizeShopDomain } from "../utils/storefront-campaigns";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (isE2ETestMode()) {
    return loadPostPurchaseCampaignResponse(request);
  }

  const surface = normalizePostPurchaseSurface(
    new URL(request.url).searchParams.get("surface"),
  );
  const authOptions = {
    corsHeaders: [
      "Cache-Control",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],
  };
  const { sessionToken, cors } =
    surface === "ORDER_STATUS_PAGE"
      ? await authenticate.public.customerAccount(request, authOptions)
      : await authenticate.public.checkout(request, authOptions);

  return loadPostPurchaseCampaignResponse(request, {
    authenticatedShopDomain: normalizeShopDomain(
      String(sessionToken.dest ?? ""),
    ),
    cors,
  });
};
