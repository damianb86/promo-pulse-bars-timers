import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  handleStorefrontCampaignsAction,
  loadStorefrontCampaignsResponse,
} from "../services/storefront-campaigns-response.server";
import { isE2ETestMode } from "../services/e2e-test.server";
import { authenticate } from "../shopify.server";
import { normalizeShopDomain } from "../utils/storefront-campaigns";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const trustedAppProxy = await authenticateAppProxy(request);

  return loadStorefrontCampaignsResponse(request, {
    authenticatedShopDomain: readRequestedShop(request),
    trustedAppProxy,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const trustedAppProxy = await authenticateAppProxy(request);

  return handleStorefrontCampaignsAction(request, {
    authenticatedShopDomain: readRequestedShop(request),
    trustedAppProxy,
  });
};

async function authenticateAppProxy(request: Request) {
  if (isE2ETestMode()) return false;

  await authenticate.public.appProxy(request);

  return true;
}

function readRequestedShop(request: Request) {
  return normalizeShopDomain(new URL(request.url).searchParams.get("shop"));
}
