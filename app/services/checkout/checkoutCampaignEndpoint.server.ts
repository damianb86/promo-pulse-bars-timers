import { getActiveCampaignsForShop } from "../../models/campaign.server";
import { getShopByDomain } from "../../models/shop.server";
import { canUsePremiumFeature } from "../premiumFeatures.server";
import { isCampaignAllowedByPlan } from "../planLimits.server";
import { checkStorefrontRateLimit } from "../../utils/storefront-rate-limit.server";
import {
  normalizeShopDomain,
  parseStorefrontCampaignContext,
  serializeStorefrontCampaigns,
} from "../../utils/storefront-campaigns";
import {
  normalizeCheckoutCampaignMode,
  selectCheckoutCampaignViewModel,
} from "./checkoutCampaignViewModel";

type CorsHelper = (response: Response) => Response;

export type CheckoutCampaignEndpointOptions = {
  authenticatedShopDomain?: string;
  cors?: CorsHelper;
};

export async function loadCheckoutCampaignResponse(
  request: Request,
  options: CheckoutCampaignEndpointOptions = {},
) {
  const url = new URL(request.url);
  const requestedShopDomain = normalizeShopDomain(url.searchParams.get("shop"));
  const authenticatedShopDomain = normalizeShopDomain(
    options.authenticatedShopDomain ?? "",
  );
  const shopDomain = authenticatedShopDomain || requestedShopDomain;
  const mode = normalizeCheckoutCampaignMode(url.searchParams.get("mode"));
  const campaignId =
    mode === "SPECIFIC_CAMPAIGN"
      ? (url.searchParams.get("campaignId") ?? "").trim()
      : "";
  const compactMode = readBoolean(url.searchParams.get("compactMode"), false);
  const showTimer = readBoolean(url.searchParams.get("showTimer"), true);

  if (!shopDomain) {
    return jsonResponse(
      { campaign: null, error: "The shop query parameter is required." },
      { status: 400, cors: options.cors },
    );
  }

  if (
    authenticatedShopDomain &&
    requestedShopDomain &&
    authenticatedShopDomain !== requestedShopDomain
  ) {
    return jsonResponse(
      { campaign: null, error: "The authenticated shop does not match shop." },
      { status: 403, cors: options.cors },
    );
  }

  const rateLimit = checkStorefrontRateLimit(
    `${getClientIp(request)}:checkout:${shopDomain}`,
  );

  if (!rateLimit.allowed) {
    return jsonResponse(
      { campaign: null, error: "Too many requests. Try again shortly." },
      { status: 429, cors: options.cors, rateLimit },
    );
  }

  const shop = await getShopByDomain(shopDomain);

  if (!shop) {
    return jsonResponse(
      {
        campaign: null,
        mode,
      },
      { cors: options.cors, rateLimit },
    );
  }

  const gate = canUsePremiumFeature(shop, "CHECKOUT_EXTENSIONS");

  if (!gate.allowed) {
    return jsonResponse(
      {
        campaign: null,
        gated: true,
        error: gate.reason,
        requiredPlan: gate.requiredPlan ?? null,
        mode,
      },
      { status: 403, cors: options.cors, rateLimit },
    );
  }

  if (mode === "SPECIFIC_CAMPAIGN" && !campaignId) {
    return jsonResponse(
      {
        campaign: null,
        error: "campaignId is required when mode is SPECIFIC_CAMPAIGN.",
        mode,
      },
      { status: 400, cors: options.cors, rateLimit },
    );
  }

  const now = new Date();
  const context = {
    ...parseStorefrontCampaignContext(url),
    shop: shopDomain,
    path: "/checkout",
    placement: "",
    campaignId,
  };
  const campaigns = await getActiveCampaignsForShop(shop.id, now);
  const storefrontCampaigns = serializeStorefrontCampaigns(
    campaigns.filter((campaign) => isCampaignAllowedByPlan(shop, campaign)),
    context,
  );
  const campaign = selectCheckoutCampaignViewModel({
    campaigns: storefrontCampaigns,
    cartSubtotal: context.cartSubtotal,
    currencyCode: context.currency,
    locale: context.locale,
    compactMode,
    showTimer,
    now,
  });

  return jsonResponse(
    {
      campaign,
      mode,
      requestedCampaignId: campaignId || null,
    },
    { cors: options.cors, rateLimit },
  );
}

function jsonResponse(
  body: unknown,
  options: {
    status?: number;
    cors?: CorsHelper;
    rateLimit?: ReturnType<typeof checkStorefrontRateLimit>;
  } = {},
) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  });

  if (options.rateLimit) {
    headers.set("X-RateLimit-Limit", String(options.rateLimit.limit));
    headers.set("X-RateLimit-Remaining", String(options.rateLimit.remaining));
    headers.set(
      "X-RateLimit-Reset",
      String(Math.ceil(options.rateLimit.resetAt / 1000)),
    );
  }

  const response = new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers,
  });

  return options.cors ? options.cors(response) : response;
}

function readBoolean(value: string | null, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;

  return fallback;
}

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
