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
  getShopSettingsOrDefaults,
  serializePublicShopSettings,
} from "../shopSettings.server";
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
  design: {
    backgroundColor: string;
    textColor: string;
    accentColor: string;
    fontSize: number;
    borderRadius: number;
  };
  badge: {
    badgeText: string;
    badgeShape: string;
    badgePosition: string;
    url: string;
  };
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
};

type AdvancedBadgeRuleSource = Awaited<
  ReturnType<typeof findActiveAdvancedBadgeRules>
>[number];

export async function loadStorefrontBadgesResponse(request: Request) {
  const url = new URL(request.url);
  let context = parseStorefrontCampaignContext(url);

  if (!context.shop) {
    return jsonResponse(
      { error: "The shop query parameter is required." },
      { status: 400, cacheControl: "no-store" },
    );
  }

  const rateLimit = checkStorefrontRateLimit(
    `${getClientIp(request)}:badges:${context.shop}`,
  );

  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Too many requests. Try again shortly." },
      { status: 429, cacheControl: "no-store", rateLimit },
    );
  }

  const shop = await getShopByDomain(context.shop);

  if (!shop) {
    return jsonResponse(
      { badges: [], settings: null },
      { cacheControl: getBadgeCacheControl(context), rateLimit },
    );
  }

  const shopSettings = await getShopSettingsOrDefaults(shop.id);
  const publicSettings = serializePublicShopSettings(shopSettings);
  context = applySettingsToStorefrontContext(context, shopSettings);

  const placementType = getPlacementType(context.placement);

  if (context.placement && !placementType) {
    return jsonResponse(
      { badges: [], settings: publicSettings },
      { cacheControl: getBadgeCacheControl(context), rateLimit },
    );
  }

  if (await hasReachedMonthlyImpressions(shop)) {
    return jsonResponse(
      { badges: [], settings: publicSettings },
      { cacheControl: "no-store", rateLimit },
    );
  }

  const productContext = parseBadgeProductContext(url, context);
  const advancedGate = canUsePremiumFeature(shop, "ADVANCED_BADGES");
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
    { cacheControl: getBadgeCacheControl(context), rateLimit },
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
  const campaigns = await getActiveCampaignsForShop(
    shop.id,
    new Date(),
    placementType,
  );
  const serializedCampaigns = serializeStorefrontCampaigns(
    campaigns.filter(
      (campaign) =>
        campaign.type === CampaignType.PRODUCT_BADGE &&
        isCampaignAllowedByPlan(shop, campaign, placementType),
    ),
    context,
  );

  return serializedCampaigns
    .filter((campaign) => campaign.badge)
    .map(toSimpleStorefrontBadge);
}

function toAdvancedStorefrontBadge(
  badge: EvaluatedBadge,
  rule: AdvancedBadgeRuleSource,
  context: StorefrontCampaignContext,
): StorefrontBadge {
  const ruleDesign = readDesign(rule.design);
  const campaignDesign = rule.campaign.design;

  return {
    id: rule.campaignId,
    ruleId: rule.id,
    campaignId: rule.campaignId,
    text: badge.text,
    priority: badge.priority,
    placement: getCampaignPlacement(rule.campaign, context),
    design: {
      backgroundColor:
        ruleDesign.backgroundColor ??
        campaignDesign?.backgroundColor ??
        "#111827",
      textColor: ruleDesign.textColor ?? campaignDesign?.textColor ?? "#FFFFFF",
      accentColor:
        ruleDesign.accentColor ?? campaignDesign?.accentColor ?? "#22C55E",
      fontSize: ruleDesign.fontSize ?? campaignDesign?.fontSize ?? 13,
      borderRadius:
        ruleDesign.borderRadius ?? campaignDesign?.borderRadius ?? 999,
    },
    badge: {
      badgeText: badge.text,
      badgeShape: readBadgeShape(ruleDesign.shape),
      badgePosition: readBadgePosition(ruleDesign.position),
      url: ruleDesign.url ?? "",
    },
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
    placement: campaign.placement,
    design: {
      backgroundColor: campaign.design.backgroundColor,
      textColor: campaign.design.textColor,
      accentColor: campaign.design.accentColor,
      fontSize: campaign.design.fontSize,
      borderRadius: campaign.design.borderRadius,
    },
    badge: {
      badgeText: campaign.badge?.badgeText || campaign.texts.badgeText,
      badgeShape: campaign.badge?.badgeShape ?? "PILL",
      badgePosition: campaign.badge?.badgePosition ?? "TOP_RIGHT",
      url: "",
    },
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    timezone: campaign.timezone,
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
  if (
    context.productId ||
    context.productTags.length > 0 ||
    context.collectionIds.length > 0
  ) {
    return "no-store";
  }

  return "public, max-age=45, stale-while-revalidate=30";
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
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": options.cacheControl,
    "Content-Type": "application/json; charset=utf-8",
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
