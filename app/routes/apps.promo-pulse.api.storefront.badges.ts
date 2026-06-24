import type { LoaderFunctionArgs } from "react-router";

import { loadStorefrontBadgesPayload } from "../services/badges/storefrontBadges.server";
import { isE2ETestMode } from "../services/e2e-test.server";
import { authenticate } from "../shopify.server";
import { normalizeShopDomain } from "../utils/storefront-campaigns";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const trustedAppProxy = await authenticateAppProxy(request);

  return loadStorefrontBadgesPayload(request, {
    authenticatedShopDomain: normalizeShopDomain(
      new URL(request.url).searchParams.get("shop"),
    ),
    trustedAppProxy,
  });
};

async function authenticateAppProxy(request: Request) {
  if (isE2ETestMode()) return false;

  await authenticate.public.appProxy(request);

  return true;
}
