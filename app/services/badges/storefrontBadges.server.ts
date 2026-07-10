import { createHash } from "node:crypto";

import {
  CampaignStatus,
  CampaignType,
  PlacementType,
  ShopPlan,
  Stage2RuleStatus,
} from "@prisma/client";

import prisma from "../../db.server";
import { getActiveCampaignsForShop } from "../../models/campaign.server";
import { getShopByDomain } from "../../models/shop.server";
import { campaignDetailsInclude } from "../../types/campaign";
import {
  parseStorefrontCampaignContext,
  serializeStorefrontCampaign,
  serializeStorefrontCampaigns,
  serializeDesign,
  shouldBypassStorefrontCache,
  type StorefrontCampaignContext,
  type StorefrontCampaignResponseItem,
} from "../../utils/storefront-campaigns";
import { checkStorefrontRateLimit } from "../../utils/storefront-rate-limit.server";
import {
  hasReachedMonthlyImpressions,
  isCampaignAllowedByPlan,
} from "../planLimits.server";
import { canUsePremiumFeature } from "../premiumFeatures.server";
import {
  applySettingsToStorefrontContext,
  defaultShopSettingsValues,
  getShopSettingsOrDefaults,
  serializePublicShopSettings,
  type PublicShopSettings,
} from "../shopSettings.server";
import {
  buildCorsHeaders,
  type StorefrontAccessOptions,
  verifyStorefrontAccess,
} from "../storefront-security.server";
import {
  evaluateBadgeRules,
  readDesign,
  type BadgeProductContext,
  type EvaluatedBadge,
} from "./badgeRuleEngine";

export type StorefrontBadge = {
  id: string;
  ruleId: string | null;
  campaignId: string;
  text: string;
  priority: number;
  placement: string;
  design: ReturnType<typeof serializeDesign>;
  timer: StorefrontCampaignResponseItem["timer"];
  badge: {
    badgeText: string;
    badgeShape?: string;
    badgePosition?: string;
    url?: string;
  };
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
};

type AdvancedBadgeRuleSource = Awaited<
  ReturnType<typeof findActiveAdvancedBadgeRules>
>[number];

type BadgeBatchContext = {
  key: string;
  context: StorefrontCampaignContext;
  productContext: BadgeProductContext;
};

export async function loadStorefrontBadgesResponse(request: Request) {
  return loadStorefrontBadgesPayload(request);
}

export async function loadStorefrontBadgesPayload(
  request: Request,
  accessOptions: StorefrontAccessOptions = {},
) {
  const url = new URL(request.url);
  let context = parseStorefrontCampaignContext(url);
  const access = verifyStorefrontAccess(request, context.shop, accessOptions);

  if (!access.ok) {
    return jsonResponse(
      { error: access.error },
      { status: access.status, cacheControl: "no-store", access, request },
    );
  }

  const rateLimit = checkStorefrontRateLimit(
    `${getClientIp(request)}:badges:${context.shop}`,
  );

  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Too many requests. Try again shortly." },
      { status: 429, cacheControl: "no-store", rateLimit, access, request },
    );
  }

  const shop = await getShopByDomain(context.shop);

  if (!shop) {
    return jsonResponse(
      { badges: [], settings: null },
      {
        cacheControl: getBadgeCacheControl(context),
        rateLimit,
        access,
        request,
      },
    );
  }

  const shopSettings = await getShopSettingsOrDefaults(shop.id);
  const publicSettings = serializePublicShopSettings(shopSettings);
  context = applySettingsToStorefrontContext(context, shopSettings);

  const placementType = getPlacementType(context.placement);

  if (context.placement && !placementType) {
    return jsonResponse(
      { badges: [], settings: publicSettings },
      {
        cacheControl: getBadgeCacheControl(context),
        rateLimit,
        access,
        request,
      },
    );
  }

  if (await hasReachedMonthlyImpressions(shop)) {
    return jsonResponse(
      { badges: [], settings: publicSettings },
      { cacheControl: "no-store", rateLimit, access, request },
    );
  }

  const batchContexts = parseBadgeBatchContexts(url, context);
  const productContext = parseBadgeProductContext(url, context);
  const advancedGate = canUsePremiumFeature(shop, "ADVANCED_BADGES");

  if (batchContexts.length > 0) {
    const badgeGroups = await loadBadgeGroups({
      advancedAllowed: advancedGate.allowed,
      batchContexts,
      placementType,
      shop,
    });

    return jsonResponse(
      {
        badgeGroups,
        settings: publicSettings,
        gated: !advancedGate.allowed,
        requiredPlan: advancedGate.requiredPlan,
      },
      {
        cacheControl: getBadgeCacheControl(context),
        rateLimit,
        access,
        request,
      },
    );
  }

  const badges = advancedGate.allowed
    ? await loadAdvancedBadges({
        context,
        placementType,
        productContext,
        shop,
      })
    : [];
  const fallbackBadges =
    badges.length > 0
      ? []
      : await loadSimpleBadgeFallback({
          context,
          placementType,
          shop,
        });

  return jsonResponse(
    {
      badges: badges.length > 0 ? badges : fallbackBadges,
      settings: publicSettings,
      gated: !advancedGate.allowed,
      requiredPlan: advancedGate.requiredPlan,
    },
    { cacheControl: getBadgeCacheControl(context), rateLimit, access, request },
  );
}

export function parseBadgeProductContext(
  url: URL,
  context: StorefrontCampaignContext = parseStorefrontCampaignContext(url),
): BadgeProductContext {
  const price = readNumber(url.searchParams.get("price"));
  const compareAtPrice = readNumber(url.searchParams.get("compareAtPrice"));

  return {
    productId: context.productId,
    productTags: context.productTags,
    collectionIds: context.collectionIds,
    vendor: readString(url.searchParams.get("vendor")),
    inventoryQuantity: readNumber(url.searchParams.get("inventoryQuantity")),
    discountActive:
      readBoolean(url.searchParams.get("discountActive")) ??
      (price !== null && compareAtPrice !== null
        ? compareAtPrice > price
        : undefined),
    price,
    compareAtPrice,
    metafields: readMetafields(url.searchParams.get("metafields")),
    market: context.market,
    country: context.country,
    locale: context.locale,
  };
}

function parseBadgeBatchContexts(
  url: URL,
  baseContext: StorefrontCampaignContext,
): BadgeBatchContext[] {
  const raw = url.searchParams.get("badgeContexts");
  let parsed: unknown;

  if (!raw) return [];

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .slice(0, 64)
    .map((item, index) => parseBadgeBatchContextItem(item, index, baseContext))
    .filter((item): item is BadgeBatchContext => item !== null);
}

function parseBadgeBatchContextItem(
  value: unknown,
  index: number,
  baseContext: StorefrontCampaignContext,
): BadgeBatchContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const price = readContextNumber(input.price);
  const compareAtPrice = readContextNumber(input.compareAtPrice);
  const context = {
    ...baseContext,
    collectionIds: readContextList(input.collectionIds),
    country: readContextString(input.country) || baseContext.country,
    locale: readContextString(input.locale) || baseContext.locale,
    market: readContextString(input.market) || baseContext.market,
    productId: readContextString(input.productId),
    productTags: readContextList(input.productTags),
  };

  return {
    context,
    key: readContextString(input.key) || `context-${index + 1}`,
    productContext: {
      productId: context.productId,
      productTags: context.productTags,
      collectionIds: context.collectionIds,
      vendor: readContextString(input.vendor),
      inventoryQuantity: readContextNumber(input.inventoryQuantity),
      discountActive:
        readContextBoolean(input.discountActive) ??
        (price !== null && compareAtPrice !== null
          ? compareAtPrice > price
          : undefined),
      price,
      compareAtPrice,
      metafields: readContextMetafields(input.metafields),
      market: context.market,
      country: context.country,
      locale: context.locale,
    },
  };
}

async function loadAdvancedBadges({
  context,
  placementType,
  productContext,
  shop,
}: {
  context: StorefrontCampaignContext;
  placementType: PlacementType | undefined;
  productContext: BadgeProductContext;
  shop: { id: string; plan: ShopPlan };
}) {
  const rules = await findActiveAdvancedBadgeRules(shop.id, placementType);
  const eligibleRules = rules.filter((rule) =>
    isRuleCampaignEligible(rule, context, shop, placementType),
  );
  const ruleById = new Map(eligibleRules.map((rule) => [rule.id, rule]));
  const evaluated = evaluateBadgeRules(
    productContext,
    eligibleRules.map((rule) => ({
      id: rule.id,
      campaignId: rule.campaignId,
      priority: rule.priority,
      status: rule.status,
      conditions: rule.conditions,
      design: rule.design,
    })),
  );

  return evaluated
    .map((badge) => {
      const rule = ruleById.get(badge.id);

      return rule ? toAdvancedStorefrontBadge(badge, rule, context) : null;
    })
    .filter((badge): badge is StorefrontBadge => badge !== null);
}

async function loadBadgeGroups({
  advancedAllowed,
  batchContexts,
  placementType,
  shop,
}: {
  advancedAllowed: boolean;
  batchContexts: BadgeBatchContext[];
  placementType: PlacementType | undefined;
  shop: { id: string; plan: ShopPlan };
}) {
  const [rules, fallbackCampaigns] = await Promise.all([
    advancedAllowed
      ? findActiveAdvancedBadgeRules(shop.id, placementType)
      : Promise.resolve([]),
    loadSimpleBadgeFallbackCampaigns({ placementType, shop }),
  ]);

  return batchContexts.map(({ context, key, productContext }) => {
    const badges = advancedAllowed
      ? buildAdvancedBadgesForContext({
          context,
          placementType,
          productContext,
          rules,
          shop,
        })
      : [];
    const fallbackBadges =
      badges.length > 0
        ? []
        : buildSimpleBadgeFallback({
            campaigns: fallbackCampaigns,
            context,
            placementType,
            shop,
          });

    return {
      badges: badges.length > 0 ? badges : fallbackBadges,
      key,
    };
  });
}

function buildAdvancedBadgesForContext({
  context,
  placementType,
  productContext,
  rules,
  shop,
}: {
  context: StorefrontCampaignContext;
  placementType: PlacementType | undefined;
  productContext: BadgeProductContext;
  rules: AdvancedBadgeRuleSource[];
  shop: { plan: ShopPlan };
}) {
  const eligibleRules = rules.filter((rule) =>
    isRuleCampaignEligible(rule, context, shop, placementType),
  );
  const ruleById = new Map(eligibleRules.map((rule) => [rule.id, rule]));
  const evaluated = evaluateBadgeRules(
    productContext,
    eligibleRules.map((rule) => ({
      id: rule.id,
      campaignId: rule.campaignId,
      priority: rule.priority,
      status: rule.status,
      conditions: rule.conditions,
      design: rule.design,
    })),
  );

  return evaluated
    .map((badge) => {
      const rule = ruleById.get(badge.id);

      return rule ? toAdvancedStorefrontBadge(badge, rule, context) : null;
    })
    .filter((badge): badge is StorefrontBadge => badge !== null);
}

function findActiveAdvancedBadgeRules(
  shopId: string,
  placementType: PlacementType | undefined,
) {
  const now = new Date();

  return prisma.advancedBadgeRule.findMany({
    where: {
      shopId,
      status: Stage2RuleStatus.ACTIVE,
      campaign: {
        shopId,
        status: CampaignStatus.ACTIVE,
        type: CampaignType.PRODUCT_BADGE,
        ...(placementType
          ? {
              placements: {
                some: {
                  enabled: true,
                  placementType,
                },
              },
            }
          : {}),
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
    },
    include: {
      campaign: {
        include: campaignDetailsInclude,
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

function isRuleCampaignEligible(
  rule: AdvancedBadgeRuleSource,
  context: StorefrontCampaignContext,
  shop: { plan: ShopPlan },
  placementType: PlacementType | undefined,
) {
  return Boolean(
    isCampaignAllowedByPlan(shop, rule.campaign, placementType) &&
    serializeStorefrontCampaign(rule.campaign, context),
  );
}

async function loadSimpleBadgeFallback({
  context,
  placementType,
  shop,
}: {
  context: StorefrontCampaignContext;
  placementType: PlacementType | undefined;
  shop: { id: string; plan: ShopPlan };
}) {
  const campaigns = await loadSimpleBadgeFallbackCampaigns({
    placementType,
    shop,
  });

  return buildSimpleBadgeFallback({ campaigns, context, placementType, shop });
}

async function loadSimpleBadgeFallbackCampaigns({
  placementType,
  shop,
}: {
  placementType: PlacementType | undefined;
  shop: { id: string; plan: ShopPlan };
}) {
  const campaigns = await getActiveCampaignsForShop(
    shop.id,
    new Date(),
    placementType,
  );

  // Any active campaign the merchant placed on a badge placement renders as a
  // simple badge (using its badge text), not only PRODUCT_BADGE-type campaigns.
  return campaigns.filter((campaign) =>
    isCampaignAllowedByPlan(shop, campaign, placementType),
  );
}

function buildSimpleBadgeFallback({
  campaigns,
  context,
}: {
  campaigns: Awaited<ReturnType<typeof loadSimpleBadgeFallbackCampaigns>>;
  context: StorefrontCampaignContext;
  placementType: PlacementType | undefined;
  shop: { id: string; plan: ShopPlan };
}) {
  const serializedCampaigns = serializeStorefrontCampaigns(campaigns, context);

  return serializedCampaigns
    .filter(
      (campaign) => campaign.badge?.badgeText || campaign.texts?.badgeText,
    )
    .map(toSimpleStorefrontBadge);
}

function toAdvancedStorefrontBadge(
  badge: EvaluatedBadge,
  rule: AdvancedBadgeRuleSource,
  context: StorefrontCampaignContext,
): StorefrontBadge {
  const ruleDesign = readDesign(rule.design);
  const campaignDesign = serializeDesign(rule.campaign.design, context.device);

  return {
    id: rule.campaignId,
    ruleId: rule.id,
    campaignId: rule.campaignId,
    text: badge.text,
    priority: badge.priority,
    placement: getCampaignPlacement(rule.campaign, context),
    design: mergeBadgeDesign(campaignDesign, ruleDesign),
    timer: serializeStorefrontCampaign(rule.campaign, context)?.timer ?? null,
    badge: compactBadgePayload({
      text: badge.text,
      shape: readBadgeShape(ruleDesign.shape),
      position: readBadgePosition(ruleDesign.position),
      url: ruleDesign.url,
    }),
    startsAt: rule.campaign.startsAt?.toISOString() ?? null,
    endsAt: rule.campaign.endsAt?.toISOString() ?? null,
    timezone: rule.campaign.timezone,
  };
}

function toSimpleStorefrontBadge(
  campaign: StorefrontCampaignResponseItem,
): StorefrontBadge {
  return {
    id: campaign.id,
    ruleId: null,
    campaignId: campaign.id,
    text: campaign.badge?.badgeText || campaign.texts.badgeText,
    priority: 0,
    placement: campaign.placements?.[0]?.placement ?? "",
    design: campaign.design,
    timer: campaign.timer,
    badge: compactBadgePayload({
      text: campaign.badge?.badgeText || campaign.texts.badgeText,
      shape: campaign.badge?.badgeShape,
      position: campaign.badge?.badgePosition,
    }),
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    timezone: campaign.timezone,
  };
}

function compactBadgePayload({
  text,
  shape,
  position,
  url,
}: {
  text: string;
  shape?: string;
  position?: string;
  url?: string | null;
}) {
  const normalizedShape = readBadgeShape(shape);
  const normalizedPosition = readBadgePosition(position);

  return {
    badgeText: text,
    ...(normalizedShape !== "PILL" ? { badgeShape: normalizedShape } : {}),
    ...(normalizedPosition !== "TOP_RIGHT"
      ? { badgePosition: normalizedPosition }
      : {}),
    ...(url ? { url } : {}),
  };
}

function mergeBadgeDesign(
  campaignDesign: ReturnType<typeof serializeDesign>,
  ruleDesign: ReturnType<typeof readDesign>,
) {
  return {
    ...campaignDesign,
    ...(ruleDesign.backgroundColor
      ? {
          backgroundType: "SOLID" as const,
          backgroundColor: ruleDesign.backgroundColor,
        }
      : {}),
    ...(ruleDesign.textColor ? { textColor: ruleDesign.textColor } : {}),
    ...(ruleDesign.accentColor ? { accentColor: ruleDesign.accentColor } : {}),
    ...(ruleDesign.fontSize ? { fontSize: ruleDesign.fontSize } : {}),
    ...(ruleDesign.borderRadius !== undefined
      ? { borderRadius: ruleDesign.borderRadius }
      : {}),
  };
}

function getCampaignPlacement(
  campaign: AdvancedBadgeRuleSource["campaign"],
  context: StorefrontCampaignContext,
) {
  return (
    campaign.placements.find(
      (placement) =>
        placement.enabled && placement.placementType === context.placement,
    )?.placementType ??
    campaign.placements.find((placement) => placement.enabled)?.placementType ??
    "COLLECTION_CARD"
  );
}

function getBadgeCacheControl(context: StorefrontCampaignContext) {
  if (shouldBypassStorefrontCache(context)) {
    return "no-store";
  }

  return "public, max-age=300, stale-while-revalidate=60";
}

function jsonResponse(
  body: unknown,
  options: {
    status?: number;
    cacheControl: string;
    rateLimit?: ReturnType<typeof checkStorefrontRateLimit>;
    access?: ReturnType<typeof verifyStorefrontAccess>;
    request?: Request;
  },
) {
  const compactBody = compactBadgeResponse(body);
  const noStore = /\bno-store\b/i.test(options.cacheControl);
  const etag =
    !noStore && (options.status ?? 200) >= 200 && (options.status ?? 200) < 300
      ? quoteEtag(stableHash(compactBody))
      : "";
  const headers = new Headers({
    "Cache-Control": options.cacheControl,
    ...buildCorsHeaders(options.access),
  });

  if (etag) {
    const maxAge = readCacheControlMaxAge(options.cacheControl);

    headers.set("ETag", etag);
    if (maxAge !== null) {
      headers.set(
        "X-Promo-Pulse-Cache-Expires-At",
        new Date(Date.now() + maxAge * 1000).toISOString(),
      );
      headers.set("X-Promo-Pulse-Client-Cache-Max-Age", String(maxAge));
    }
  }

  if (options.rateLimit) {
    headers.set("X-RateLimit-Limit", String(options.rateLimit.limit));
    headers.set("X-RateLimit-Remaining", String(options.rateLimit.remaining));
    headers.set(
      "X-RateLimit-Reset",
      String(Math.ceil(options.rateLimit.resetAt / 1000)),
    );
  }

  if (etag && requestMatchesEtag(options.request, etag)) {
    return new Response(null, { status: 304, headers });
  }

  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(compactBody), {
    status: options.status ?? 200,
    headers,
  });
}

function requestMatchesEtag(request: Request | undefined, etag: string) {
  const header = request?.headers.get("if-none-match");

  if (!header) return false;

  return header
    .split(",")
    .map((value) => value.trim())
    .includes(etag);
}

function readCacheControlMaxAge(value: string) {
  const match = value.match(/\bmax-age=(\d+)/i);

  return match ? Number(match[1]) : null;
}

function quoteEtag(value: string) {
  return `"ppb-${value}"`;
}

function stableHash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(normalizeForHash(value)))
    .digest("hex")
    .slice(0, 32);
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((output, key) => {
      output[key] = normalizeForHash((value as Record<string, unknown>)[key]);
      return output;
    }, {});
}

function compactBadgeResponse(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(compactBadgeResponse);
  }

  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    const compactedEntry =
      key === "settings" && entry
        ? compactSettingsPayload(entry as PublicShopSettings)
        : compactBadgeResponse(entry);

    if (isEmptyStorefrontValue(compactedEntry)) continue;

    output[key] = compactedEntry;
  }

  return output;
}

function compactSettingsPayload(settings: PublicShopSettings) {
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

function getPlacementType(value: string) {
  if (!value) return undefined;

  return Object.values(PlacementType).includes(value as PlacementType)
    ? (value as PlacementType)
    : undefined;
}

function readBadgeShape(value: string | undefined) {
  return value === "ROUNDED" || value === "SQUARE" ? value : "PILL";
}

function readBadgePosition(value: string | undefined) {
  return value === "TOP_LEFT" ||
    value === "BOTTOM_LEFT" ||
    value === "BOTTOM_RIGHT"
    ? value
    : "TOP_RIGHT";
}

function readContextString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readContextList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => readContextString(item))
      .filter((item) => item.length > 0);
  }

  return readContextString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readContextNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  return readNumber(readContextString(value));
}

function readContextBoolean(value: unknown) {
  if (typeof value === "boolean") return value;

  return readBoolean(readContextString(value));
}

function readContextMetafields(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).reduce<Record<string, string>>(
      (metafields, [key, metafieldValue]) => {
        if (typeof metafieldValue === "string") {
          metafields[key] = metafieldValue;
        }

        return metafields;
      },
      {},
    );
  }

  return readMetafields(readContextString(value));
}

function readMetafields(value: string | null) {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<Record<string, string>>(
      (metafields, [key, metafieldValue]) => {
        if (typeof metafieldValue === "string") {
          metafields[key] = metafieldValue;
        }

        return metafields;
      },
      {},
    );
  } catch {
    return {};
  }
}

function readString(value: string | null) {
  return value?.trim() ?? "";
}

function readNumber(value: string | null) {
  if (value == null || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function readBoolean(value: string | null) {
  if (value == null || value === "") return null;

  return value === "true" || value === "1";
}

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
