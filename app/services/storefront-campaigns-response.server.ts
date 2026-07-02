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
  defaultShopSettingsValues,
  getShopSettingsOrDefaults,
  serializePublicShopSettings,
  type PublicShopSettings,
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
  const hasBadgeCampaigns = hasStorefrontBadgeCampaigns(planAllowedCampaigns);
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
        visitorScoped: hasActiveExperiment,
      })
    : "";
  const cachedPayload = payloadCacheKey
    ? (getCachedStorefrontPayload(payloadCacheKey) ??
      (await getCachedStorefrontPayloadFromFile(payloadCacheKey)))
    : null;

  if (cachedPayload) {
    if (requestMatchesStorefrontEtag(request, cachedPayload)) {
      return notModifiedResponse({
        cacheControl: getCacheControlHeader(context, behaviorLookbackDays > 0),
        rateLimit,
        access,
        headers: storefrontCacheHeaders(cachedPayload),
      });
    }

    return jsonResponse(cachedPayload.body, {
      cacheControl: getCacheControlHeader(context, behaviorLookbackDays > 0),
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
  const payload = buildStorefrontPayload(storefrontCampaigns, publicSettings, {
    hasBadgeCampaigns,
  });
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
        cacheControl: getCacheControlHeader(context, behaviorLookbackDays > 0),
        rateLimit,
        access,
        headers: storefrontCacheHeaders(cacheEntry),
      });
    }
  }

  return jsonResponse(payload, {
    cacheControl: getCacheControlHeader(context, behaviorLookbackDays > 0),
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
  const userAgent = request.headers.get("user-agent") ?? undefined;
  // Accept either a single event (legacy) or a batched { events: [...] } payload
  // so the storefront can flush all of a page's events in one request.
  const isBatch = Array.isArray((body as { events?: unknown }).events);
  const rawEvents = isBatch
    ? ((body as { events: unknown[] }).events ?? [])
    : [body];

  if (rawEvents.length === 0 || rawEvents.length > MAX_ANALYTICS_BATCH_SIZE) {
    return jsonResponse(
      {
        error: `Send between 1 and ${MAX_ANALYTICS_BATCH_SIZE} analytics events per request.`,
      },
      { status: 400, cacheControl: "no-store" },
    );
  }

  const validations = rawEvents.map((event) =>
    validateAnalyticsEventPayload({
      // Top-level shop/consent act as defaults for every batched event.
      shop: (body as { shop?: unknown }).shop,
      doNotTrack: (body as { doNotTrack?: unknown }).doNotTrack,
      consentGranted: (body as { consentGranted?: unknown }).consentGranted,
      ...(event as Record<string, unknown>),
      userAgent:
        (event as { userAgent?: string }).userAgent ??
        (body as { userAgent?: string }).userAgent ??
        userAgent,
    }),
  );
  const validPayloads = validations
    .filter((validation) => validation.ok)
    .map((validation) => validation.payload);

  if (validPayloads.length === 0) {
    const firstError = validations.find((validation) => !validation.ok);

    return jsonResponse(
      {
        error: "Invalid analytics event.",
        details: firstError && !firstError.ok ? firstError.errors : undefined,
      },
      { status: 400, cacheControl: "no-store" },
    );
  }

  // Every event in a batch targets the page's shop; verify access once.
  const access = verifyStorefrontAccess(
    request,
    validPayloads[0].shop,
    accessOptions,
  );

  if (!access.ok) {
    return jsonResponse(
      { error: access.error },
      { status: access.status, cacheControl: "no-store", access },
    );
  }

  try {
    const results = await Promise.all(
      validPayloads.map((payload) => recordAnalyticsEvent(payload)),
    );

    if (!isBatch) {
      const result = results[0];

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
    }

    const savedCount = results.filter((result) => result.saved).length;

    return jsonResponse(
      {
        ok: true,
        received: rawEvents.length,
        processed: results.length,
        saved: savedCount,
        deduped: results.filter((result) => result.deduped).length,
      },
      {
        status: savedCount > 0 ? 201 : 202,
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

const MAX_ANALYTICS_BATCH_SIZE = 50;

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
  options: { hasBadgeCampaigns?: boolean } = {},
) {
  // Drop null/undefined/empty-string fields so the payload only carries
  // meaningful data; the storefront applies the same defaults the backend
  // omits (it already reads every field through `|| fallback`, `safeColor`,
  // `clamp`, and `!== false` guards). false/0/arrays are preserved because the
  // theme distinguishes them from "absent".
  const compactCampaigns = campaigns.map((campaign) =>
    compactStorefrontValue(campaign),
  );
  const placements = compactCampaigns.reduce<Record<string, string[]>>(
    (groups, campaign) => {
      // A campaign is emitted once but can target several placements; index its
      // id under every placement it renders in.
      const descriptors =
        Array.isArray(campaign.placements) && campaign.placements.length > 0
          ? campaign.placements
          : [{ placement: campaign.placement }];

      for (const descriptor of descriptors) {
        const placement =
          (descriptor as { placement?: string }).placement || "UNKNOWN";

        groups[placement] ??= [];
        if (!groups[placement].includes(campaign.id)) {
          groups[placement].push(campaign.id);
        }
      }

      return groups;
    },
    {},
  );
  const settingsPayload = compactSettingsPayload(settings);

  return {
    ...(compactCampaigns.length > 0 ? { campaigns: compactCampaigns } : {}),
    // `placements` only indexes campaigns by placement; it carries IDs (not the
    // full objects, which already live in `campaigns`) to keep the payload small.
    ...(Object.keys(placements).length > 0 ? { placements } : {}),
    ...(settingsPayload ? { settings: settingsPayload } : {}),
    ...(options.hasBadgeCampaigns ? { badges: true as const } : {}),
  };
}

function compactSettingsPayload(settings: PublicShopSettings | null) {
  if (!settings) return null;

  const output = Object.entries(settings).reduce<Record<string, unknown>>(
    (values, [key, value]) => {
      if (isEmptyStorefrontValue(value)) return values;
      if (isDefaultSettingValue(key, value)) return values;

      values[key] = value;
      return values;
    },
    {},
  );

  return Object.keys(output).length > 0 ? output : null;
}

function isDefaultSettingValue(key: string, value: unknown) {
  const defaultValue =
    defaultShopSettingsValues[key as keyof typeof defaultShopSettingsValues];

  if (Array.isArray(value) && Array.isArray(defaultValue)) {
    return arraysEqual(value, defaultValue);
  }

  if (isPlainObject(value) && isPlainObject(defaultValue)) {
    return JSON.stringify(value) === JSON.stringify(defaultValue);
  }

  return value === defaultValue;
}

function arraysEqual(first: unknown[], second: unknown[]) {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

function hasStorefrontBadgeCampaigns(campaigns: StorefrontCampaignSource[]) {
  return campaigns.some((campaign) =>
    campaign.placements.some(
      (placement) =>
        placement.enabled &&
        (placement.placementType === PlacementType.PRODUCT_PAGE_BADGE ||
          placement.placementType === PlacementType.COLLECTION_CARD),
    ),
  );
}

function compactStorefrontValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => compactStorefrontValue(item)) as unknown as T;
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      if (entry === null || entry === undefined || entry === "") continue;
      const compactedEntry = compactStorefrontValue(entry);

      if (isEmptyStorefrontValue(compactedEntry)) continue;

      result[key] = compactedEntry;
    }

    return result as T;
  }

  return value;
}

function isEmptyStorefrontValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (isPlainObject(value) && Object.keys(value).length === 0)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
