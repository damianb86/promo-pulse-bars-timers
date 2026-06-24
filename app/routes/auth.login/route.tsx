import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import { ShopifyReconnectPage } from "../../components/ShopifyReconnectPage";
import { login } from "../../shopify.server";
import { buildEmbeddedAppRedirect } from "../../utils/shopify-embedded-redirect.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const appRedirect = url.searchParams.get("shop")
    ? null
    : buildEmbeddedAppRedirect(request, "/auth/login");

  if (appRedirect) {
    throw redirect(appRedirect);
  }

  await login(request);

  return {};
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const appRedirect = url.searchParams.get("shop")
    ? null
    : buildEmbeddedAppRedirect(request, "/auth/login");

  if (appRedirect) {
    throw redirect(appRedirect);
  }

  await login(request);

  return {};
};

export default function Auth() {
  return (
    <ShopifyReconnectPage message="Open Promo Pulse from your Shopify admin to reconnect the embedded app." />
  );
}
