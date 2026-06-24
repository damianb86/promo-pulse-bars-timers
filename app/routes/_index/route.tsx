import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import { ShopifyReconnectPage } from "../../components/ShopifyReconnectPage";
import { buildEmbeddedAppRedirect } from "../../utils/shopify-embedded-redirect.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const appRedirect = buildEmbeddedAppRedirect(request);

  if (appRedirect) {
    throw redirect(appRedirect);
  }

  return {};
};

export default function App() {
  return (
    <ShopifyReconnectPage message="Open Promo Pulse from Shopify admin so the app can attach to the correct store." />
  );
}
