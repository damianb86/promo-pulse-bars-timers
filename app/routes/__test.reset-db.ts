import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  resetE2ETestDatabase,
  requireE2ETestMode,
  type E2ETestScenario,
} from "../services/e2e-test.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return reset(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return reset(request);
};

async function reset(request: Request) {
  requireE2ETestMode();

  const url = new URL(request.url);
  const scenario = readScenario(url.searchParams.get("scenario"));
  const result = await resetE2ETestDatabase(scenario);

  return new Response(
    JSON.stringify({
      ok: true,
      campaignCount: result.campaignCount,
      scenario: result.scenario,
      shop: result.shop.shopifyDomain,
    }),
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}

function readScenario(value: string | null): E2ETestScenario {
  if (
    value === "countdown" ||
    value === "campaign-type-countdown" ||
    value === "campaign-type-product-timer" ||
    value === "campaign-type-cart-timer" ||
    value === "campaign-type-free-shipping" ||
    value === "campaign-type-free-shipping-circular" ||
    value === "campaign-type-delivery-cutoff" ||
    value === "campaign-type-low-stock" ||
    value === "campaign-type-product-badge" ||
    value === "campaign-targeting-filters" ||
    value === "campaign-custom-selector" ||
    value === "countdown-consent-strict" ||
    value === "targeting" ||
    value === "behavior-targeting" ||
    value === "free-shipping" ||
    value === "delivery-cutoff" ||
    value === "delivery-cutoff-after" ||
    value === "cart-drawer" ||
    value === "analytics" ||
    value === "premium" ||
    value === "ab-test" ||
    value === "auto-winner" ||
    value === "unique-discount" ||
    value === "unique-discount-expired" ||
    value === "reports" ||
    value === "recommendations" ||
    value === "agency" ||
    value === "template-library" ||
    value === "post-purchase"
  ) {
    return value;
  }

  return "empty";
}
