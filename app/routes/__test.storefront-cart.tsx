import type { LoaderFunctionArgs } from "react-router";

import { buildE2EStorefrontHtml } from "../services/e2e-storefront-html.server";
import { requireE2ETestMode } from "../services/e2e-test.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  requireE2ETestMode();

  return new Response(buildE2EStorefrontHtml(request, "cart"), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
};
