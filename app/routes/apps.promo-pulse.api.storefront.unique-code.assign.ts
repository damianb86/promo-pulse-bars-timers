import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  handleUniqueCodeAssignAction,
  loadUniqueCodeAssignResponse,
} from "../services/storefront-unique-code-assign.server";
import { isE2ETestMode } from "../services/e2e-test.server";
import { authenticate } from "../shopify.server";
import { normalizeShopDomain } from "../utils/storefront-campaigns";

export const loader = async (args: LoaderFunctionArgs) => {
  if (args.request.method !== "OPTIONS") {
    await authenticateAppProxy(args.request);
  }

  return loadUniqueCodeAssignResponse(args.request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const trustedAppProxy = await authenticateAppProxy(request);

  return handleUniqueCodeAssignAction(request, {
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
