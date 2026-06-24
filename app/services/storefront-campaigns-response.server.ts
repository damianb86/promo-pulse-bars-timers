import { PlacementType } from "@prisma/client";

import {
  AnalyticsIngestionError,
  recordAnalyticsEvent,
  validateAnalyticsEventPayload,
} from "../models/analytics.server";
import {
  filterActivePublishedCampaigns,
  getPublishedCampaignsForShop,
} from "../models/campaign.server";
import { getShopByDomain } from "../models/shop.server";
import {
  hasReachedMonthlyImpressions,
  isCampaignAllowedByPlan,
} from "./planLimits.server";
import { buildVisitorBehaviorProfile } from "./behavior/behaviorTargeting.server";
import {
  applySettingsToStorefrontContext,
  getShopSettingsOrDefaults,
  serializePublicShopSettings,
} from "./shopSettings.server";
import {
  getBehaviorTargetingLookbackDays,
  hasBehaviorTargetingRules,
} from "../types/behavior-targeting";
import { checkStorefrontRateLimit } from "../utils/storefront-rate-limit.server";
import {
  parseStorefrontCampaignContext,
  serializeStorefrontCampaigns,
  shouldBypassStorefrontCache,
  type StorefrontCampaignSource,
} from "../utils/storefront-campaigns";
import {
  buildCorsHeaders,
  type StorefrontAccessOptions,
  verifyStorefrontAccess,
} from "./storefront-security.server";
import {
  buildStorefrontPayloadCacheKey,
  buildStorefrontPayloadEntry,
  getCachedStorefrontImpressionGate,
  getCachedStorefrontPayload,
  getCachedStorefrontPayloadFromFile,
  getCachedStorefrontSnapshot,
  nextStorefrontCampaignBoundary,
  requestMatchesStorefrontEtag,
  setCachedStorefrontPayload,
  storefrontActiveSignature,
  storefrontCacheHeaders,
} from "./storefront-cache.server";

export async function loadStorefrontCampaignsResponse(
  request: Request,
  accessOptions: StorefrontAccessOptions = {},
) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(undefined),
    });
  }

  const url = new URL(request.url);
  let context = parseStorefrontCampaignContext(url);
  const access = verifyStorefrontAccess(request, context.shop, accessOptions);

  if (!access.ok) {
    return jsonResponse(
      { error: access.error },
      { status: access.status, cacheControl: "no-store", access },
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
        access,
      },
    );
  }

  const snapshot = await getCachedStorefrontSnapshot(context.shop, async () => {
    const shop = await getShopByDomain(context.shop);

    if (!shop) {
      return {
        shop: null,
        settings: null,
        publicSettings: null,
        campaigns: [],
      };
    }

    const settings = await getShopSettingsOrDefaults(shop.id);

    return {
      shop,
      settings,
      publicSettings: serializePublicShopSettings(settings),
      campaigns: await getPublishedCampaignsForShop(shop.id),
    };
  });

  if (!snapshot) {
    return jsonResponse(buildStorefrontPayload([], null), {
      cacheControl: getCacheControlHeader(context),
      rateLimit,
      access,
    });
  }

  const {
    campaigns: publishedCampaigns,
    publicSettings,
    settings: shopSettings,
    shop,
  } = snapshot;
  context = applySettingsToStorefrontContext(context, shopSettings);

  const placementTypes = getPlacementTypes(context.placements ?? []);
  const placementType =
    placementTypes.length === 1 ? placementTypes[0] : undefined;

  if (
    context.placement &&
    placementTypes.length !== (context.placements ?? []).length
  ) {
    return jsonResponse(buildStorefrontPayload([], publicSettings), {
      cacheControl: getCacheControlHeader(context),
      rateLimit,
      access,
    });
  }

  if (
    await getCachedStorefrontImpressionGate(shop.id, () =>
      hasReachedMonthlyImpressions(shop),
    )
  ) {
    return jsonResponse(buildStorefrontPayload([], publicSettings), {
      cacheControl: "no-store",
      rateLimit,
      access,
    });
  }

  const now = new Date();
  const campaigns = filterActivePublishedCampaigns(
    publishedCampaigns.map((campaign) => ({
      ...campaign,
      cartRescueSettings: campaign.cartRescueSettings ?? null,
    })),
    now,
    placementType,
  );
  const planAllowedCampaigns = campaigns.filter((campaign) =>
    isCampaignAllowedByPlan(shop, campaign, placementType),
  );
  const behaviorLookbackDays = getMaxBehaviorLookbackDays(planAllowedCampaigns);
  const hasActiveExperiment = planAllowedCampaigns.some((campaign) =>
    campaign.experiments.some((experiment) =>
      isExperimentActiveForCache(experiment, now),
    ),
  );
  const isPayloadCacheable = shouldUseStorefrontPayloadCache(
    context,
    behaviorLookbackDays,
  );
  const payloadCacheKey = isPayloadCacheable
    ? buildStorefrontPayloadCacheKey({
        context,
        snapshotVersion: snapshot.version,
      })
    : "";
  const cachedPayload = payloadCacheKey
    ? (getCachedStorefrontPayload(payloadCacheKey) ??
      (await getCachedStorefrontPayloadFromFile(payloadCacheKey)))
    : null;

  if (cachedPayload) {
    if (requestMatchesStorefrontEtag(request, cachedPayload)) {
      return notModifiedResponse({
        cacheControl: getCacheControlHeader(
          context,
          behaviorLookbackDays > 0 || hasActiveExperiment,
        ),
        rateLimit,
        access,
        headers: storefrontCacheHeaders(cachedPayload),
      });
    }

    return jsonResponse(cachedPayload.body, {
      cacheControl: getCacheControlHeader(
        context,
        behaviorLookbackDays > 0 || hasActiveExperiment,
      ),
      rateLimit,
      access,
      headers: storefrontCacheHeaders(cachedPayload),
    });
  }

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
  const payload = buildStorefrontPayload(storefrontCampaigns, publicSettings);
  const cacheEntry =
    payloadCacheKey && isPayloadCacheable
      ? buildStorefrontPayloadEntry({
          activeSignature: storefrontActiveSignature(planAllowedCampaigns),
          body: payload,
          cacheKey: payloadCacheKey,
          nextBoundaryAt: nextStorefrontCampaignBoundary(
            publishedCampaigns,
            now,
          ),
          snapshotVersion: snapshot.version,
        })
      : null;

  if (cacheEntry) {
    setCachedStorefrontPayload(payloadCacheKey, cacheEntry);

    if (requestMatchesStorefrontEtag(request, cacheEntry)) {
      return notModifiedResponse({
        cacheControl: getCacheControlHeader(
          context,
          behaviorLookbackDays > 0 || hasActiveExperiment,
        ),
        rateLimit,
        access,
        headers: storefrontCacheHeaders(cacheEntry),
      });
    }
  }

  return jsonResponse(payload, {
    cacheControl: getCacheControlHeader(
      context,
      behaviorLookbackDays > 0 || hasActiveExperiment,
    ),
    rateLimit,
    access,
    headers: cacheEntry ? storefrontCacheHeaders(cacheEntry) : undefined,
  });
}

export async function handleStorefrontCampaignsAction(
  request: Request,
  accessOptions: StorefrontAccessOptions = {},
) {
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

  const access = verifyStorefrontAccess(
    request,
    validation.payload.shop,
    accessOptions,
  );

  if (!access.ok) {
    return jsonResponse(
      { error: access.error },
      { status: access.status, cacheControl: "no-store", access },
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
      {
        status: result.saved ? 201 : 202,
        cacheControl: "no-store",
        access,
      },
    );
  } catch (error) {
    if (error instanceof AnalyticsIngestionError) {
      return jsonResponse(
        { error: error.message },
        { status: error.status, cacheControl: "no-store", access },
      );
    }

    console.error(
      "Failed to record Promo Pulse app proxy analytics event",
      error,
    );

    return jsonResponse(
      { error: "Analytics event could not be recorded." },
      { status: 500, cacheControl: "no-store", access },
    );
  }
}

function getCacheControlHeader(
  context: ReturnType<typeof parseStorefrontCampaignContext>,
  hasBehaviorTargeting = false,
) {
  if (hasBehaviorTargeting || shouldBypassStorefrontCache(context)) {
    return "no-store";
  }

  return "no-cache, max-age=0, must-revalidate";
}

function getMaxBehaviorLookbackDays(campaigns: StorefrontCampaignSource[]) {
  return campaigns.reduce((maxLookbackDays, campaign) => {
    const behaviorRules = campaign.targeting?.behaviorRules;

    if (!hasBehaviorTargetingRules(behaviorRules)) return maxLookbackDays;

    return Math.max(
      maxLookbackDays,
      getBehaviorTargetingLookbackDays(behaviorRules),
    );
  }, 0);
}

function isExperimentActiveForCache(
  experiment: StorefrontCampaignSource["experiments"][number],
  now: Date,
) {
  return (
    experiment.status === "RUNNING" &&
    (!experiment.startsAt || experiment.startsAt <= now) &&
    (!experiment.endsAt || experiment.endsAt >= now)
  );
}

function jsonResponse(
  body: unknown,
  options: {
    status?: number;
    cacheControl: string;
    rateLimit?: ReturnType<typeof checkStorefrontRateLimit>;
    access?: ReturnType<typeof verifyStorefrontAccess>;
    headers?: HeadersInit;
  },
) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": options.cacheControl,
    ...buildCorsHeaders(options.access),
  });
  new Headers(options.headers).forEach((value, key) => {
    headers.set(key, value);
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

function notModifiedResponse(options: {
  cacheControl: string;
  rateLimit?: ReturnType<typeof checkStorefrontRateLimit>;
  access?: ReturnType<typeof verifyStorefrontAccess>;
  headers?: HeadersInit;
}) {
  const headers = new Headers({
    "Cache-Control": options.cacheControl,
    ...buildCorsHeaders(options.access),
  });
  new Headers(options.headers).forEach((value, key) => {
    headers.set(key, value);
  });

  if (options.rateLimit) {
    headers.set("X-RateLimit-Limit", String(options.rateLimit.limit));
    headers.set("X-RateLimit-Remaining", String(options.rateLimit.remaining));
    headers.set(
      "X-RateLimit-Reset",
      String(Math.ceil(options.rateLimit.resetAt / 1000)),
    );
  }

  return new Response(null, { status: 304, headers });
}

function buildStorefrontPayload(
  campaigns: ReturnType<typeof serializeStorefrontCampaigns>,
  settings: ReturnType<typeof serializePublicShopSettings> | null,
) {
  return {
    campaigns,
    placements: campaigns.reduce<Record<string, typeof campaigns>>(
      (groups, campaign) => {
        const placement = campaign.placement || "UNKNOWN";

        groups[placement] ??= [];
        groups[placement].push(campaign);

        return groups;
      },
      {},
    ),
    settings,
  };
}

function shouldUseStorefrontPayloadCache(
  context: ReturnType<typeof parseStorefrontCampaignContext>,
  behaviorLookbackDays: number,
) {
  return (
    behaviorLookbackDays === 0 &&
    !context.campaignId &&
    !shouldBypassStorefrontCache(context)
  );
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
