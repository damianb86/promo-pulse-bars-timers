import { PlacementType } from "@prisma/client";

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
  normalizePostPurchaseCampaignMode,
  normalizePostPurchaseSurface,
  selectPostPurchaseCampaignViewModel,
  type PostPurchaseSurface,
} from "./postPurchaseCampaignViewModel";

type CorsHelper = (response: Response) => Response;

export type PostPurchaseCampaignEndpointOptions = {
  authenticatedShopDomain?: string;
  cors?: CorsHelper;
};

export async function loadPostPurchaseCampaignResponse(
  request: Request,
  options: PostPurchaseCampaignEndpointOptions = {},
) {
  const url = new URL(request.url);
  const requestedShopDomain = normalizeShopDomain(url.searchParams.get("shop"));
  const authenticatedShopDomain = normalizeShopDomain(
    options.authenticatedShopDomain ?? "",
  );
  const shopDomain = authenticatedShopDomain || requestedShopDomain;
  const surface = normalizePostPurchaseSurface(url.searchParams.get("surface"));
  const placementType = getPlacementTypeForSurface(surface);
  const mode = normalizePostPurchaseCampaignMode(url.searchParams.get("mode"));
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

  if (mode === "SPECIFIC_CAMPAIGN" && !campaignId) {
    return jsonResponse(
      {
        campaign: null,
        error: "campaignId is required when mode is SPECIFIC_CAMPAIGN.",
        mode,
        surface,
      },
      { status: 400, cors: options.cors },
    );
  }

  const rateLimit = checkStorefrontRateLimit(
    `${getClientIp(request)}:post-purchase:${shopDomain}`,
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
        surface,
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
        surface,
      },
      { status: 403, cors: options.cors, rateLimit },
    );
  }

  const now = new Date();
  const context = {
    ...parseStorefrontCampaignContext(url),
    shop: shopDomain,
    path: surface === "THANK_YOU_PAGE" ? "/thank-you" : "/order-status",
    placement: placementType,
    campaignId,
  };
  const campaigns = await getActiveCampaignsForShop(
    shop.id,
    now,
    placementType,
  );
  const storefrontCampaigns = serializeStorefrontCampaigns(
    campaigns.filter((campaign) =>
      isCampaignAllowedByPlan(shop, campaign, placementType),
    ),
    context,
  );
  const campaign = selectPostPurchaseCampaignViewModel({
    campaigns: storefrontCampaigns,
    surface,
    appliedDiscountCodes: readAppliedDiscountCodes(url.searchParams),
    locale: context.locale,
    compactMode,
    showTimer,
    now,
  });

  return jsonResponse(
    {
      campaign,
      mode,
      surface,
      requestedCampaignId: campaignId || null,
    },
    { cors: options.cors, rateLimit },
  );
}

export function getPlacementTypeForSurface(surface: PostPurchaseSurface) {
  return surface === "ORDER_STATUS_PAGE"
    ? PlacementType.ORDER_STATUS_PAGE
    : PlacementType.THANK_YOU_PAGE;
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

function readAppliedDiscountCodes(searchParams: URLSearchParams) {
  return [
    ...searchParams.getAll("appliedDiscountCode"),
    ...searchParams
      .getAll("appliedDiscountCodes")
      .flatMap((value) => value.split(",")),
  ]
    .map((code) => code.trim())
    .filter(Boolean);
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
