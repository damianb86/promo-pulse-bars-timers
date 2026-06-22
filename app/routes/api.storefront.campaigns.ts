import { PlacementType } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AnalyticsIngestionError,
  recordAnalyticsEvent,
  validateAnalyticsEventPayload,
} from "../models/analytics.server";
import { getActiveCampaignsForShop } from "../models/campaign.server";
import { getShopByDomain } from "../models/shop.server";
import {
  hasReachedMonthlyImpressions,
  isCampaignAllowedByPlan,
} from "../services/planLimits.server";
import { buildVisitorBehaviorProfile } from "../services/behavior/behaviorTargeting.server";
import {
  applySettingsToStorefrontContext,
  getShopSettingsOrDefaults,
  serializePublicShopSettings,
} from "../services/shopSettings.server";
import {
  getBehaviorTargetingLookbackDays,
  hasBehaviorTargetingRules,
} from "../types/behavior-targeting";
import { checkStorefrontRateLimit } from "../utils/storefront-rate-limit.server";
import {
  parseStorefrontCampaignContext,
  serializeStorefrontCampaigns,
  shouldBypassStorefrontCache,
} from "../utils/storefront-campaigns";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  let context = parseStorefrontCampaignContext(url);

  if (!context.shop) {
    return jsonResponse(
      { error: "The shop query parameter is required." },
      { status: 400, cacheControl: "no-store" },
    );
  }

  const rateLimit = checkStorefrontRateLimit(
    `${getClientIp(request)}:${context.shop}`,
  );

  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        cacheControl: "no-store",
        rateLimit,
      },
    );
  }

  const shop = await getShopByDomain(context.shop);

  if (!shop) {
    return jsonResponse(
      { campaigns: [], settings: null },
      {
        cacheControl: getCacheControlHeader(context),
        rateLimit,
      },
    );
  }

  const shopSettings = await getShopSettingsOrDefaults(shop.id);
  const publicSettings = serializePublicShopSettings(shopSettings);
  context = applySettingsToStorefrontContext(context, shopSettings);

  const placementTypes = getPlacementTypes(context.placements ?? []);
  const placementType =
    placementTypes.length === 1 ? placementTypes[0] : undefined;

  if (
    context.placement &&
    placementTypes.length !== (context.placements ?? []).length
  ) {
    return jsonResponse(
      { campaigns: [], settings: publicSettings },
      {
        cacheControl: getCacheControlHeader(context),
        rateLimit,
      },
    );
  }

  if (await hasReachedMonthlyImpressions(shop)) {
    return jsonResponse(
      { campaigns: [], settings: publicSettings },
      {
        cacheControl: "no-store",
        rateLimit,
      },
    );
  }

  const campaigns = await getActiveCampaignsForShop(
    shop.id,
    new Date(),
    placementType,
  );
  const planAllowedCampaigns = campaigns.filter((campaign) =>
    isCampaignAllowedByPlan(shop, campaign, placementType),
  );
  const behaviorLookbackDays = getMaxBehaviorLookbackDays(planAllowedCampaigns);
  const behaviorProfile =
    behaviorLookbackDays > 0
      ? await buildVisitorBehaviorProfile({
          shopId: shop.id,
          visitorId: context.visitorId,
          sessionId: context.sessionId,
          settings: shopSettings,
          privacy: {
            doNotTrack: context.doNotTrack,
            consentGranted: context.consentGranted,
          },
          lookbackDays: behaviorLookbackDays,
        })
      : null;
  const storefrontCampaigns = serializeStorefrontCampaigns(
    planAllowedCampaigns,
    { ...context, behaviorProfile },
  );

  return jsonResponse(
    { campaigns: storefrontCampaigns, settings: publicSettings },
    {
      cacheControl: getCacheControlHeader(context, behaviorLookbackDays > 0),
      rateLimit,
    },
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Use GET for campaigns or POST for analytics events." },
      { status: 405, cacheControl: "no-store" },
    );
  }

  const body = await readJsonBody(request);
  const validation = validateAnalyticsEventPayload({
    ...body,
    userAgent: body.userAgent ?? request.headers.get("user-agent") ?? undefined,
  });

  if (!validation.ok) {
    return jsonResponse(
      { error: "Invalid analytics event.", details: validation.errors },
      { status: 400, cacheControl: "no-store" },
    );
  }

  try {
    const result = await recordAnalyticsEvent(validation.payload);

    return jsonResponse(
      {
        ok: true,
        saved: result.saved,
        deduped: result.deduped,
        ignored: result.ignored ?? false,
        reason: result.reason,
        eventId: result.eventId,
      },
      { status: result.saved ? 201 : 202, cacheControl: "no-store" },
    );
  } catch (error) {
    if (error instanceof AnalyticsIngestionError) {
      return jsonResponse(
        { error: error.message },
        { status: error.status, cacheControl: "no-store" },
      );
    }

    console.error(
      "Failed to record Promo Pulse app proxy analytics event",
      error,
    );

    return jsonResponse(
      { error: "Analytics event could not be recorded." },
      { status: 500, cacheControl: "no-store" },
    );
  }
};

function getCacheControlHeader(
  context: ReturnType<typeof parseStorefrontCampaignContext>,
  hasBehaviorTargeting = false,
) {
  if (hasBehaviorTargeting || shouldBypassStorefrontCache(context)) {
    return "no-store";
  }

  return "public, max-age=45, stale-while-revalidate=30";
}

function getMaxBehaviorLookbackDays(
  campaigns: Awaited<ReturnType<typeof getActiveCampaignsForShop>>,
) {
  return campaigns.reduce((maxLookbackDays, campaign) => {
    const behaviorRules = campaign.targeting?.behaviorRules;

    if (!hasBehaviorTargetingRules(behaviorRules)) return maxLookbackDays;

    return Math.max(
      maxLookbackDays,
      getBehaviorTargetingLookbackDays(behaviorRules),
    );
  }, 0);
}

function jsonResponse(
  body: unknown,
  options: {
    status?: number;
    cacheControl: string;
    rateLimit?: ReturnType<typeof checkStorefrontRateLimit>;
  },
) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": options.cacheControl,
    "Access-Control-Allow-Origin": "*",
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

  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers,
  });
}

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function readJsonBody(request: Request) {
  try {
    const body = await request.json();

    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function getPlacementType(value: string) {
  if (!value) return undefined;

  return Object.values(PlacementType).includes(value as PlacementType)
    ? (value as PlacementType)
    : undefined;
}

function getPlacementTypes(values: string[]) {
  return values.reduce<PlacementType[]>((placements, value) => {
    const placement = getPlacementType(value);

    if (placement && !placements.includes(placement)) {
      placements.push(placement);
    }

    return placements;
  }, []);
}
