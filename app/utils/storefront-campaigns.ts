import type {
  BadgeSettings,
  Campaign,
  CartRescueSettings,
  CampaignDesign,
  CampaignPlacement,
  CampaignTargeting,
  CampaignTranslation,
  DeliveryCutoffSettings,
  DiscountSync,
  Experiment,
  ExperimentVariant,
  FreeShippingSettings,
  LowStockSettings,
  MarketCampaignRule,
  Prisma,
  TimerSettings,
} from "@prisma/client";

import {
  campaignMatchesBehaviorTargeting,
  type VisitorBehaviorProfile,
} from "../services/behavior/behaviorTargeting";
import { applyMarketCampaignRule } from "../services/markets/marketOverrides";
import {
  defaultCampaignDesignValues,
  type CampaignDesignValues,
} from "../types/campaign-design";
import { parseCustomMessages } from "./custom-messages";
import { resolveMobileCampaignDesign } from "./responsive-design";
import {
  campaignTranslationFields,
  type CampaignTextField,
} from "../types/localization";
import {
  defaultCartRescueSettingsValues,
  isSupportedCartRescueReason,
  isSupportedCartRescueTimerStart,
} from "../types/cart-rescue";
import {
  getCampaignText,
  normalizeStorefrontLocale,
  type CampaignTranslationRecord,
} from "./campaign-localization";

export type StorefrontCampaignContext = {
  shop: string;
  path: string;
  locale: string;
  country: string;
  market: string;
  productId: string;
  collectionIds: string[];
  productTags: string[];
  customerTags: string[];
  device: string;
  utmSource: string;
  cartSubtotal: number | null;
  currency: string;
  placement: string;
  placements?: string[];
  campaignId: string;
  visitorId: string;
  sessionId: string;
  doNotTrack: boolean;
  consentGranted: boolean | null;
  behaviorProfile: VisitorBehaviorProfile | null;
};

export type StorefrontCampaignSource = Omit<
  Campaign,
  "lastSavedAt" | "publishedAt" | "publishedSnapshot" | "assetsRequested"
> & {
  lastSavedAt?: Date;
  publishedAt?: Date | null;
  publishedSnapshot?: Prisma.JsonValue | null;
  placements: CampaignPlacement[];
  targeting: CampaignTargeting | null;
  design: CampaignDesign | null;
  timerSettings: TimerSettings | null;
  cartRescueSettings?: CartRescueSettings | null;
  freeShippingSettings: FreeShippingSettings | null;
  deliveryCutoffSettings: DeliveryCutoffSettings | null;
  lowStockSettings: LowStockSettings | null;
  badgeSettings: BadgeSettings | null;
  discountSync: DiscountSync | null;
  marketCampaignRules: MarketCampaignRule[];
  translations: CampaignTranslation[];
  experiments: Array<Experiment & { variants: ExperimentVariant[] }>;
};

export type StorefrontCampaignPlacementDescriptor = {
  placement: string;
  placementSelector: string;
  placementStyle: string;
};

export type StorefrontCampaignResponseItem = {
  id: string;
  type: string;
  goal: string;
  placement: string;
  placementSelector?: string;
  placementStyle?: string;
  // Every placement this campaign renders in. The campaign payload is emitted
  // once (not duplicated per placement); the storefront expands this list back
  // into one render target per descriptor. `placement`/`placementSelector`/
  // `placementStyle` above mirror the first (primary) descriptor for callers
  // that only need one.
  placements?: StorefrontCampaignPlacementDescriptor[];
  design: ReturnType<typeof serializeDesign>;
  timer: ReturnType<typeof serializeTimer>;
  cartRescue?: ReturnType<typeof serializeCartRescue>;
  freeShipping: ReturnType<typeof serializeFreeShipping>;
  deliveryCutoff: ReturnType<typeof serializeDeliveryCutoff>;
  lowStock: ReturnType<typeof serializeLowStock>;
  badge: ReturnType<typeof serializeBadge>;
  texts: Record<CampaignTextField | "ctaUrl", string>;
  discount: ReturnType<typeof serializeDiscount>;
  experimentId?: string;
  variantId?: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
};

type StorefrontEmbeddedFreeShipping = NonNullable<
  StorefrontCampaignResponseItem["freeShipping"]
> & {
  thresholdRules?: Record<string, unknown>;
};

type StorefrontEmbeddedDeliveryCutoff = NonNullable<
  StorefrontCampaignResponseItem["deliveryCutoff"]
> & {
  countryRules?: Record<string, unknown>;
};

export type StorefrontEmbeddedCampaignResponseItem = Omit<
  StorefrontCampaignResponseItem,
  "deliveryCutoff" | "freeShipping"
> & {
  freeShipping: StorefrontEmbeddedFreeShipping | null;
  deliveryCutoff: StorefrontEmbeddedDeliveryCutoff | null;
  targeting?: StorefrontEmbeddedCampaignTargeting;
  marketRules?: StorefrontEmbeddedMarketRule[];
  mobileDesign?: StorefrontCampaignResponseItem["design"];
  textLocales?: Record<
    string,
    Partial<Record<CampaignTextField | "ctaUrl", string>>
  >;
};

export type StorefrontEmbeddedCampaignTargeting = {
  countries?: string[];
  markets?: string[];
  locales?: string[];
  productIds?: string[];
  collectionIds?: string[];
  productTags?: string[];
  customerTags?: string[];
  urlContains?: string[];
  excludedUrlContains?: string[];
  utmSources?: string[];
  devices?: string[];
  excludeProductIds?: string[];
  excludeCollectionIds?: string[];
  behaviorRules?: unknown;
};

export type StorefrontEmbeddedMarketRule = {
  id?: string;
  enabled?: boolean;
  marketId?: string;
  countryCode?: string;
  locale?: string;
  currencyCode?: string;
  thresholdAmount?: string;
  deliverySettings?: Record<string, unknown>;
  textOverrides?: Record<string, unknown>;
};

export function parseStorefrontCampaignContext(
  url: URL,
): StorefrontCampaignContext {
  const searchParams = url.searchParams;
  const rawPlacement = readString(searchParams, "placement").toUpperCase();
  const placements = readPlacementList(rawPlacement);
  // The general token is not a real placement; expose it only through the
  // expanded `placements` list so single-placement guards keep working.
  const placement =
    rawPlacement === ALL_FRONT_DEFAULT_PLACEMENTS_TOKEN ? "" : rawPlacement;

  return {
    shop: normalizeShopDomain(searchParams.get("shop")),
    path: readString(searchParams, "path") || "/",
    locale: readString(searchParams, "locale") || "en",
    country: readString(searchParams, "country").toUpperCase(),
    market: readString(searchParams, "market").toUpperCase(),
    productId: readString(searchParams, "productId"),
    collectionIds: readList(searchParams, "collectionIds"),
    productTags: readList(searchParams, "productTags"),
    customerTags: readList(searchParams, "customerTags"),
    device: readString(searchParams, "device").toLowerCase(),
    utmSource: readString(searchParams, "utmSource"),
    cartSubtotal: readNumber(searchParams, "cartSubtotal"),
    currency: readString(searchParams, "currency").toUpperCase(),
    placement,
    placements,
    campaignId: readString(searchParams, "campaignId"),
    visitorId: readString(searchParams, "visitorId"),
    sessionId: readString(searchParams, "sessionId"),
    doNotTrack: readBoolean(searchParams, "doNotTrack"),
    consentGranted: readNullableBoolean(searchParams, "consentGranted"),
    behaviorProfile: null,
  };
}

export function normalizeShopDomain(value: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

export function isCampaignEligibleForStorefront(
  campaign: StorefrontCampaignSource,
  context: StorefrontCampaignContext,
) {
  return Boolean(
    getMatchingPlacements(campaign, context).length > 0 &&
    isTargetingEligible(campaign.targeting, context),
  );
}

export function serializeStorefrontCampaign(
  campaign: StorefrontCampaignSource,
  context: StorefrontCampaignContext,
): StorefrontCampaignResponseItem | null {
  const placement = getMatchingPlacements(campaign, context)[0] ?? null;

  if (!placement || !isTargetingEligible(campaign.targeting, context)) {
    return null;
  }

  return serializeStorefrontCampaignForPlacement(campaign, context, placement);
}

function serializeStorefrontCampaignForPlacement(
  campaign: StorefrontCampaignSource,
  context: StorefrontCampaignContext,
  placement: CampaignPlacement,
) {
  const serializedCampaign: StorefrontCampaignResponseItem = {
    id: campaign.id,
    type: campaign.type,
    goal: campaign.goal,
    placement: placement.placementType,
    placementSelector: placement.customSelector ?? "",
    placementStyle: placement.customStyle ?? "",
    design: serializeDesign(campaign.design, context.device),
    timer: serializeTimer(campaign.timerSettings),
    cartRescue: serializeCartRescue(campaign.cartRescueSettings ?? null),
    freeShipping:
      campaign.type === "FREE_SHIPPING_GOAL" ||
      campaign.goal === "FREE_SHIPPING"
        ? serializeFreeShipping(campaign.freeShippingSettings, context)
        : null,
    deliveryCutoff: serializeDeliveryCutoff(
      campaign.deliveryCutoffSettings,
      context,
    ),
    lowStock: serializeLowStock(campaign.lowStockSettings),
    badge: serializeBadge(campaign.badgeSettings),
    texts: serializeTexts(campaign, context.locale),
    discount: serializeDiscount(campaign.discountSync),
    startsAt: campaign.startsAt ? campaign.startsAt.toISOString() : null,
    endsAt: campaign.endsAt ? campaign.endsAt.toISOString() : null,
    timezone: campaign.timezone,
  };

  const marketCampaign = applyMarketCampaignRule(
    serializedCampaign,
    campaign.marketCampaignRules,
    context,
  );

  if (!marketCampaign) return null;

  return applyAssignedExperimentVariant(marketCampaign, campaign, context);
}

export function serializeStorefrontCampaigns(
  campaigns: StorefrontCampaignSource[],
  context: StorefrontCampaignContext,
) {
  const perPlacementItems = campaigns
    .filter(
      (campaign) => !context.campaignId || campaign.id === context.campaignId,
    )
    .flatMap((campaign) => {
      if (!isTargetingEligible(campaign.targeting, context)) return [];

      return getMatchingPlacements(campaign, context).map((placement) =>
        serializeStorefrontCampaignForPlacement(campaign, context, placement),
      );
    })
    .filter(
      (campaign): campaign is StorefrontCampaignResponseItem =>
        campaign !== null,
    );

  // A campaign enabled on several placements is serialized once per matching
  // placement above (the payload is identical apart from the placement fields).
  // Collapse those into a single entry that carries every placement in a
  // `placements` array so the JSON never repeats the same campaign - the
  // storefront expands the list back into one render target per descriptor.
  return dedupeByCampaignPlacements(perPlacementItems);
}

export function serializeStorefrontCampaignsForEmbedding(
  campaigns: StorefrontCampaignSource[],
  context: StorefrontCampaignContext,
): StorefrontEmbeddedCampaignResponseItem[] {
  const perPlacementItems = campaigns
    .flatMap((campaign) =>
      getMatchingPlacements(campaign, context).map((placement) =>
        serializeStorefrontCampaignForPlacement(campaign, context, placement),
      ),
    )
    .filter(
      (campaign): campaign is StorefrontCampaignResponseItem =>
        campaign !== null,
    );
  const byId = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

  return dedupeByCampaignPlacements(perPlacementItems).map((campaign) => {
    const source = byId.get(campaign.id);
    const targeting = serializeEmbeddedTargeting(source?.targeting ?? null);
    const marketRules = serializeEmbeddedMarketRules(
      source?.marketCampaignRules ?? [],
    );

    return {
      ...campaign,
      ...(targeting ? { targeting } : {}),
      ...(marketRules.length > 0 ? { marketRules } : {}),
    };
  });
}

export function serializeOptimizedStorefrontCampaignsForEmbedding(
  campaigns: StorefrontCampaignSource[],
  context: StorefrontCampaignContext,
  locales: string[],
): StorefrontEmbeddedCampaignResponseItem[] {
  const defaultLocale = context.locale || locales[0] || "en";
  const desktopContext = {
    ...context,
    device: "desktop",
    locale: defaultLocale,
  };
  const perPlacementItems = campaigns
    .flatMap((campaign) =>
      getMatchingPlacements(campaign, desktopContext).map((placement) =>
        serializeStorefrontCampaignForPlacement(
          campaign,
          desktopContext,
          placement,
        ),
      ),
    )
    .filter(
      (campaign): campaign is StorefrontCampaignResponseItem =>
        campaign !== null,
    );
  const byId = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

  return dedupeByCampaignPlacements(perPlacementItems).map((campaign) => {
    const source = byId.get(campaign.id);
    const targeting = serializeEmbeddedTargeting(source?.targeting ?? null);
    const marketRules = serializeEmbeddedMarketRules(
      source?.marketCampaignRules ?? [],
    );
    const desktopDesign = source
      ? serializeDesign(source.design, "desktop")
      : campaign.design;
    const mobileDesign = source ? serializeDesign(source.design, "mobile") : {};
    const texts = source
      ? serializeTexts(source, defaultLocale)
      : campaign.texts;
    const textLocales = source
      ? serializeEmbeddedTextLocales(source, texts, locales, defaultLocale)
      : null;

    const optimizedCampaign: StorefrontEmbeddedCampaignResponseItem = {
      ...campaign,
      design: desktopDesign,
      texts,
      ...(sameJsonPayload(desktopDesign, mobileDesign) ? {} : { mobileDesign }),
      ...(textLocales ? { textLocales } : {}),
      ...(targeting ? { targeting } : {}),
      ...(marketRules.length > 0 ? { marketRules } : {}),
    };

    addOptimizedContextRules(optimizedCampaign, source);

    return optimizedCampaign;
  });
}

function dedupeByCampaignPlacements(
  items: StorefrontCampaignResponseItem[],
): StorefrontCampaignResponseItem[] {
  const byId = new Map<string, StorefrontCampaignResponseItem>();

  for (const item of items) {
    const descriptor: StorefrontCampaignPlacementDescriptor = {
      placement: item.placement,
      placementSelector: item.placementSelector ?? "",
      placementStyle: item.placementStyle ?? "",
    };
    const existing = byId.get(item.id);

    if (!existing) {
      byId.set(item.id, { ...item, placements: [descriptor] });
      continue;
    }

    const alreadyListed = existing.placements?.some(
      (entry) =>
        entry.placement === descriptor.placement &&
        entry.placementSelector === descriptor.placementSelector &&
        entry.placementStyle === descriptor.placementStyle,
    );

    if (!alreadyListed) {
      existing.placements = [...(existing.placements ?? []), descriptor];
    }
  }

  return Array.from(byId.values());
}

function serializeEmbeddedTargeting(
  targeting: CampaignTargeting | null,
): StorefrontEmbeddedCampaignTargeting | null {
  if (!targeting) return null;

  const payload = compactObject({
    countries: jsonStringList(targeting.countries),
    markets: jsonStringList(targeting.markets),
    locales: jsonStringList(targeting.locales),
    productIds: jsonStringList(targeting.productIds),
    collectionIds: jsonStringList(targeting.collectionIds),
    productTags: jsonStringList(targeting.productTags),
    customerTags: jsonStringList(targeting.customerTags),
    urlContains: jsonStringList(targeting.urlContains),
    excludedUrlContains: jsonStringList(
      (targeting as CampaignTargeting & { excludedUrlContains?: unknown })
        .excludedUrlContains,
    ),
    utmSources: jsonStringList(targeting.utmSources),
    devices: jsonStringList(targeting.devices),
    excludeProductIds: jsonStringList(targeting.excludeProductIds),
    excludeCollectionIds: jsonStringList(targeting.excludeCollectionIds),
    behaviorRules: jsonObjectOrNull(targeting.behaviorRules),
  });

  return Object.keys(payload).length > 0
    ? (payload as StorefrontEmbeddedCampaignTargeting)
    : null;
}

function serializeEmbeddedMarketRules(
  rules: MarketCampaignRule[],
): StorefrontEmbeddedMarketRule[] {
  return rules
    .map((rule) =>
      compactObject({
        id: rule.id,
        enabled: rule.enabled,
        marketId: rule.marketId ?? "",
        countryCode: rule.countryCode ?? "",
        locale: rule.locale ?? "",
        currencyCode: rule.currencyCode ?? "",
        thresholdAmount: rule.thresholdAmount?.toString() ?? "",
        deliverySettings: jsonObjectOrNull(rule.deliverySettings),
        textOverrides: jsonObjectOrNull(rule.textOverrides),
      }),
    )
    .filter(
      (rule): rule is StorefrontEmbeddedMarketRule =>
        Object.keys(rule).length > 0,
    );
}

function serializeEmbeddedTextLocales(
  campaign: StorefrontCampaignSource,
  defaultTexts: Record<CampaignTextField | "ctaUrl", string>,
  locales: string[],
  defaultLocale: string,
) {
  const normalizedDefaultLocale = normalizeStorefrontLocale(defaultLocale);
  const textLocales = Array.from(new Set(locales))
    .map((locale) => ({
      locale,
      normalizedLocale: normalizeStorefrontLocale(locale),
    }))
    .filter(
      ({ normalizedLocale }) =>
        normalizedLocale && normalizedLocale !== normalizedDefaultLocale,
    )
    .reduce<
      Record<string, Partial<Record<CampaignTextField | "ctaUrl", string>>>
    >((translations, { locale }) => {
      const texts = serializeTexts(campaign, locale);
      const delta = diffTextPayload(defaultTexts, texts);

      if (Object.keys(delta).length > 0) {
        translations[locale] = delta;
      }

      return translations;
    }, {});

  return Object.keys(textLocales).length > 0 ? textLocales : null;
}

function diffTextPayload(
  base: Record<CampaignTextField | "ctaUrl", string>,
  next: Record<CampaignTextField | "ctaUrl", string>,
) {
  return (Object.keys(next) as Array<CampaignTextField | "ctaUrl">).reduce<
    Partial<Record<CampaignTextField | "ctaUrl", string>>
  >((delta, key) => {
    if (next[key] !== base[key]) {
      delta[key] = next[key];
    }

    return delta;
  }, {});
}

function sameJsonPayload(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function addOptimizedContextRules(
  campaign: StorefrontEmbeddedCampaignResponseItem,
  source: StorefrontCampaignSource | undefined,
) {
  const thresholdRules = jsonObjectOrNull(
    source?.freeShippingSettings?.thresholdRules,
  );
  const countryRules = jsonObjectOrNull(
    source?.deliveryCutoffSettings?.countryRules,
  );

  if (thresholdRules && campaign.freeShipping) {
    campaign.freeShipping = {
      ...campaign.freeShipping,
      thresholdRules,
    };
  }

  if (countryRules && campaign.deliveryCutoff) {
    campaign.deliveryCutoff = {
      ...campaign.deliveryCutoff,
      countryRules,
    };
  }
}

export function shouldBypassStorefrontCache(
  context: StorefrontCampaignContext,
) {
  return context.cartSubtotal !== null || context.utmSource.length > 0;
}

function getMatchingPlacements(
  campaign: StorefrontCampaignSource,
  context: StorefrontCampaignContext,
) {
  const enabledPlacements = campaign.placements.filter(
    (placement) => placement.enabled,
  );
  const requestedPlacements =
    (context.placements ?? []).length > 0
      ? (context.placements ?? [])
      : context.placement
        ? [context.placement]
        : [];

  if (requestedPlacements.length === 0) {
    return enabledPlacements[0] ? [enabledPlacements[0]] : [];
  }

  const matchingPlacements = enabledPlacements.filter((placement) =>
    requestedPlacements.includes(placement.placementType),
  );

  if (matchingPlacements.length > 0) {
    return matchingPlacements;
  }

  if (context.campaignId && requestedPlacements.includes("CUSTOM_SELECTOR")) {
    return [];
  }

  return context.campaignId && requestedPlacements.length === 1
    ? enabledPlacements[0]
      ? [enabledPlacements[0]]
      : []
    : [];
}

function isTargetingEligible(
  targeting: CampaignTargeting | null,
  context: StorefrontCampaignContext,
) {
  if (!targeting) return true;

  if (
    matchesAny(jsonStringList(targeting.excludeProductIds), [context.productId])
  ) {
    return false;
  }

  if (
    matchesAny(
      jsonStringList(targeting.excludeCollectionIds),
      context.collectionIds,
    )
  ) {
    return false;
  }

  if (
    matchesPathContains(
      jsonStringList(
        (targeting as CampaignTargeting & { excludedUrlContains?: unknown })
          .excludedUrlContains,
      ),
      context.path,
    )
  ) {
    return false;
  }

  return (
    matchesOptionalExactList(
      jsonStringList(targeting.countries),
      context.country,
    ) &&
    matchesOptionalExactList(
      jsonStringList(targeting.markets),
      context.market,
    ) &&
    matchesOptionalLocaleList(
      jsonStringList(targeting.locales),
      context.locale,
    ) &&
    matchesOptionalExactList(
      jsonStringList(targeting.productIds),
      context.productId,
    ) &&
    matchesOptionalIntersection(
      jsonStringList(targeting.collectionIds),
      context.collectionIds,
    ) &&
    matchesOptionalIntersection(
      jsonStringList(targeting.productTags),
      context.productTags,
    ) &&
    matchesOptionalIntersection(
      jsonStringList(targeting.customerTags),
      context.customerTags,
    ) &&
    matchesOptionalPathContains(
      jsonStringList(targeting.urlContains),
      context.path,
    ) &&
    matchesOptionalExactList(
      jsonStringList(targeting.utmSources),
      context.utmSource,
    ) &&
    matchesOptionalExactList(
      jsonStringList(targeting.devices),
      context.device,
    ) &&
    campaignMatchesBehaviorTargeting(
      targeting.behaviorRules,
      context.behaviorProfile,
    )
  );
}

export function serializeDesign(
  design: CampaignDesign | null,
  device: string = "desktop",
) {
  const desktopDesign = serializeDesktopDesign(design);
  const isMobileDevice = isMobileDesignDevice(device);
  const mobileDesign = isMobileDevice
    ? readCampaignDesignJsonObject(design?.mobileDesign)
    : null;
  const resolvedDesign = isMobileDevice
    ? resolveMobileCampaignDesign(desktopDesign, mobileDesign)
    : desktopDesign;

  const structure = serializeStructure(
    design,
    isMobileDevice ? mobileDesign : null,
  );

  return compactDesignPayload({
    ...resolvedDesign,
    showIcon: resolvedDesign.icon !== "NONE",
    // In structure mode the merchant custom CSS is already baked into
    // structure.css, so don't ship it twice.
    customCss: structure ? "" : resolvedDesign.customCss,
    structure,
  });
}

// Emits the per-campaign structural HTML (dictionary-packed AST) + CSS for the
// storefront. Returns null when a campaign has no saved structure, in which case
// the theme extension uses its built-in surface builder. On mobile the mobile
// override (stored in the mobile design JSON) is used when present; otherwise
// the desktop structure is reused (so identical mobile HTML is never duplicated).
function serializeStructure(
  design: CampaignDesign | null,
  mobileOverride: Partial<CampaignDesignValues> | null,
) {
  if (!design) return null;

  const mobileSource = mobileOverride as {
    mobileStructureCompact?: string | null;
    mobileStructureCss?: string | null;
    mobileStructureVersion?: number | null;
  } | null;

  const mobilePacked = readStructureCompact(
    mobileSource?.mobileStructureCompact,
  );
  if (mobilePacked) {
    return compactStructurePayload({
      packed: mobilePacked,
      css: mobileSource?.mobileStructureCss ?? "",
      version: mobileSource?.mobileStructureVersion ?? 1,
    });
  }

  const structureDesign = design as CampaignDesign & {
    structureCompact?: string | null;
    structureCss?: string | null;
    structureMessages?: string | null;
    structureVersion?: number | null;
  };

  const packed = readStructureCompact(structureDesign.structureCompact);
  if (!packed) return null;

  return compactStructurePayload({
    packed,
    css: structureDesign.structureCss ?? "",
    // Custom reusable message snippets the merchant placed via
    // data-cp-slot="custom-<id>" - shipped alongside the structure so the
    // storefront can fill those slots (and interpolate the dynamic variables).
    messages: parseCustomMessages(structureDesign.structureMessages),
    version: structureDesign.structureVersion ?? 1,
  });
}

function readStructureCompact(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function compactStructurePayload(input: {
  packed: string;
  css: string;
  messages?: ReturnType<typeof parseCustomMessages>;
  version: number;
}) {
  return {
    packed: input.packed,
    ...(input.css ? { css: input.css } : {}),
    ...(input.messages && input.messages.length > 0
      ? { messages: input.messages }
      : {}),
    ...(input.version !== 1 ? { version: input.version } : {}),
  };
}

function compactDesignPayload(
  design: CampaignDesignValues & {
    structure: ReturnType<typeof serializeStructure>;
  },
) {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(design)) {
    if (key === "structure") {
      if (value) output.structure = value;
      continue;
    }

    if (
      value === undefined ||
      value === null ||
      value === "" ||
      isDesignDefaultValue(key, value)
    ) {
      continue;
    }

    output[key] = value;
  }

  return output;
}

function isDesignDefaultValue(key: string, value: unknown) {
  const defaultValue =
    defaultCampaignDesignValues[key as keyof CampaignDesignValues];

  if (defaultValue === undefined) return false;

  if (isColorLikeValue(defaultValue) || isColorLikeValue(value)) {
    return (
      normalizeColorLikeValue(defaultValue) === normalizeColorLikeValue(value)
    );
  }

  return value === defaultValue;
}

function isColorLikeValue(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value);
}

function normalizeColorLikeValue(value: unknown) {
  return typeof value === "string" ? value.toUpperCase() : value;
}

function isMobileDesignDevice(device: string) {
  return device === "mobile" || device === "tablet";
}

function serializeDesktopDesign(design: CampaignDesign | null) {
  if (!design) return defaultCampaignDesignValues;

  const desktopDesign = { ...design } as Partial<CampaignDesignValues> & {
    campaignId?: unknown;
    mobileDesign?: unknown;
    customCss?: string | null;
    structureCompact?: unknown;
    structureCss?: unknown;
    structureMessages?: unknown;
    structureVersion?: unknown;
    structureEdited?: unknown;
  };
  delete desktopDesign.campaignId;
  delete desktopDesign.mobileDesign;
  // Internal structure storage columns: the storefront only consumes the decoded
  // `structure` field (see serializeStructure), so never leak the raw stored
  // copy into the payload.
  delete desktopDesign.structureCompact;
  delete desktopDesign.structureCss;
  delete desktopDesign.structureMessages;
  delete desktopDesign.structureVersion;
  delete desktopDesign.structureEdited;

  return {
    ...defaultCampaignDesignValues,
    ...desktopDesign,
    customCss: design.customCss ?? "",
  };
}

function readCampaignDesignJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<CampaignDesignValues>)
    : null;
}

function serializeTimer(timerSettings: TimerSettings | null) {
  if (!timerSettings) return null;

  return compactObject({
    mode: timerSettings.mode,
    durationMinutes: timerSettings.durationMinutes,
    recurringDays: timerSettings.recurringDays,
    resetBehavior: timerSettings.resetBehavior,
    expiredBehavior: timerSettings.expiredBehavior,
  });
}

function serializeCartRescue(settings: CartRescueSettings | null) {
  if (!settings) return null;

  return {
    rescueReason: isSupportedCartRescueReason(settings.rescueReason)
      ? settings.rescueReason
      : defaultCartRescueSettingsValues.rescueReason,
    showTimer: settings.showTimer,
    showButton: settings.showButton,
    timerStart: isSupportedCartRescueTimerStart(settings.timerStart)
      ? settings.timerStart
      : defaultCartRescueSettingsValues.timerStart,
    armBeforeStart: settings.armBeforeStart === true,
  };
}

function serializeFreeShipping(
  settings: FreeShippingSettings | null,
  context: StorefrontCampaignContext,
) {
  if (!settings) return null;

  const resolvedThresholdAmount = resolveFreeShippingThreshold(
    settings,
    context,
  );

  return compactObject({
    thresholdAmount: resolvedThresholdAmount.toFixed(2),
    baseThresholdAmount: settings.thresholdAmount.toString(),
    currencyCode: settings.currencyCode,
    includeDiscountedSubtotal: settings.includeDiscountedSubtotal,
    emptyCartMessage: settings.emptyCartMessage ?? "",
    successMessage: settings.successMessage,
    progressStyle: settings.progressStyle,
  });
}

function resolveFreeShippingThreshold(
  settings: FreeShippingSettings,
  context: StorefrontCampaignContext,
) {
  const fallback = Number(settings.thresholdAmount.toString());
  const rules = jsonObject(settings.thresholdRules);

  return (
    readThresholdRule(rules.markets, context.market) ??
    readThresholdRule(rules.countries, context.country) ??
    readThresholdRule(rules, `${context.market}:${context.country}`) ??
    readThresholdRule(rules, context.market) ??
    readThresholdRule(rules, context.country) ??
    readNumericThreshold(rules.default) ??
    (Number.isFinite(fallback) ? fallback : 0)
  );
}

function serializeDeliveryCutoff(
  settings: DeliveryCutoffSettings | null,
  context: StorefrontCampaignContext,
) {
  if (!settings) return null;
  const resolvedSettings = resolveDeliveryCutoffSettings(settings, context);

  return compactObject({
    afterCutoffBehavior: resolvedSettings.afterCutoffBehavior,
    cutoffHour: resolvedSettings.cutoffHour,
    cutoffMinute: resolvedSettings.cutoffMinute,
    processingDays: resolvedSettings.processingDays,
    minDeliveryDays: resolvedSettings.minDeliveryDays,
    maxDeliveryDays: resolvedSettings.maxDeliveryDays,
    workingDays: resolvedSettings.workingDays,
    holidays: resolvedSettings.holidays,
  });
}

function resolveDeliveryCutoffSettings(
  settings: DeliveryCutoffSettings,
  context: StorefrontCampaignContext,
) {
  const rules = jsonObject(settings.countryRules);
  const countryRules = jsonObject(rules.countries);
  const marketRules = jsonObject(rules.markets);
  const override =
    readRuleObject(marketRules[context.market]) ??
    readRuleObject(countryRules[context.country]) ??
    readRuleObject(rules[context.market]) ??
    readRuleObject(rules[context.country]) ??
    {};

  return {
    afterCutoffBehavior:
      readDeliveryAfterCutoffBehavior(override.afterCutoffBehavior) ??
      settings.afterCutoffBehavior,
    cutoffHour: readIntegerOverride(override.cutoffHour) ?? settings.cutoffHour,
    cutoffMinute:
      readIntegerOverride(override.cutoffMinute) ?? settings.cutoffMinute,
    holidays: Array.isArray(override.holidays)
      ? override.holidays
      : settings.holidays,
    maxDeliveryDays:
      readIntegerOverride(override.maxDeliveryDays) ?? settings.maxDeliveryDays,
    minDeliveryDays:
      readIntegerOverride(override.minDeliveryDays) ?? settings.minDeliveryDays,
    processingDays:
      readIntegerOverride(override.processingDays) ?? settings.processingDays,
    workingDays: Array.isArray(override.workingDays)
      ? override.workingDays
      : settings.workingDays,
  };
}

function serializeLowStock(settings: LowStockSettings | null) {
  if (!settings) return null;

  return {
    threshold: settings.threshold,
    showExactQuantity: settings.showExactQuantity,
    fallbackMessage: settings.fallbackMessage,
  };
}

function serializeBadge(settings: BadgeSettings | null) {
  if (!settings) return null;

  return compactObject({
    badgeText: settings.badgeText,
    badgeShape:
      readBadgeShape(settings.badgeShape) === "PILL"
        ? ""
        : readBadgeShape(settings.badgeShape),
    badgePosition:
      readBadgePosition(settings.badgePosition) === "TOP_RIGHT"
        ? ""
        : readBadgePosition(settings.badgePosition),
  });
}

function serializeTexts(campaign: StorefrontCampaignSource, locale: string) {
  const texts = campaignTranslationFields.reduce(
    (values, field) => {
      values[field.key] = getCampaignText(
        {
          name: campaign.name,
          type: campaign.type,
          goal: campaign.goal,
          translations: campaign.translations as CampaignTranslationRecord[],
        },
        locale,
        field.key,
      );
      return values;
    },
    {} as Record<CampaignTextField | "ctaUrl", string>,
  );

  texts.ctaUrl = getCampaignCtaUrl(campaign.translations, locale);

  return texts;
}

function getCampaignCtaUrl(
  translations: CampaignTranslation[],
  locale: string,
) {
  const normalizedLocale = normalizeStorefrontLocale(locale);
  const requestedTranslation = normalizedLocale
    ? findTranslation(translations, normalizedLocale)
    : null;
  const englishTranslation = findTranslation(translations, "en");
  const firstTranslationWithUrl = translations.find((translation) =>
    hasText(translation.ctaUrl),
  );

  return (
    readText(requestedTranslation?.ctaUrl) ||
    readText(englishTranslation?.ctaUrl) ||
    readText(firstTranslationWithUrl?.ctaUrl) ||
    "#"
  );
}

function sanitizeDiscountOverride(
  override: Record<string, unknown>,
  showDiscountCode: boolean,
): Record<string, unknown> {
  // Never expose the internal Shopify discount id to the storefront, and only
  // reveal an A/B variant's discount code when the campaign is configured to
  // show codes, mirroring serializeDiscount so experiment overrides cannot
  // bypass the showCodeOnStorefront gate and leak a restricted code.
  const rest = { ...override };

  delete rest.shopifyDiscountId;

  if (!showDiscountCode) {
    delete rest.discountCode;
  }

  return rest;
}

function campaignShowsDiscountCode(discountSync: DiscountSync | null) {
  if (!discountSync) return false;

  return (
    (discountSync as { showCodeOnStorefront?: boolean | null })
      .showCodeOnStorefront !== false
  );
}

type StorefrontDiscountPayload = {
  method: DiscountSync["method"];
  discountCode?: string | null;
  uniqueCode?: {
    endpoint: string;
    autoApply: boolean;
    expiresMinutes: number | null;
  } | null;
};

function serializeDiscount(
  discountSync: DiscountSync | null,
): StorefrontDiscountPayload | null {
  if (!discountSync) return null;

  const showCodeOnStorefront = campaignShowsDiscountCode(discountSync);

  if (!showCodeOnStorefront) {
    return {
      method: discountSync.method,
    };
  }

  return compactObject({
    method: discountSync.method,
    discountCode: discountSync.discountCode,
    uniqueCode:
      discountSync.method === "UNIQUE_CODE"
        ? {
            endpoint: "/api/storefront/unique-code/assign",
            autoApply: discountSync.uniqueCodeAutoApply,
            expiresMinutes: discountSync.uniqueCodeExpiresMinutes,
          }
        : null,
  }) as StorefrontDiscountPayload;
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.entries(value).reduce<Record<string, unknown>>(
    (output, [key, entry]) => {
      if (
        entry === null ||
        entry === undefined ||
        entry === "" ||
        (Array.isArray(entry) && entry.length === 0)
      ) {
        return output;
      }

      output[key] = entry;
      return output;
    },
    {},
  ) as Partial<T>;
}

// A variant's designOverride can carry a nested `mobileDesign` override plus a
// `separateMobileDesign` flag. Resolve it to a flat, device-appropriate override
// (the storefront merges this over the already device-resolved campaign design).
function resolveVariantDesignOverride(
  rawOverride: Record<string, unknown>,
  device: string,
) {
  const { mobileDesign, separateMobileDesign, ...desktopOverride } =
    rawOverride;

  if (
    separateMobileDesign &&
    isMobileDesignDevice(device) &&
    mobileDesign &&
    typeof mobileDesign === "object" &&
    !Array.isArray(mobileDesign)
  ) {
    return {
      ...desktopOverride,
      ...(mobileDesign as Record<string, unknown>),
    };
  }

  return desktopOverride;
}

function applyAssignedExperimentVariant(
  campaign: StorefrontCampaignResponseItem,
  source: StorefrontCampaignSource,
  context: StorefrontCampaignContext,
) {
  const assignment = selectAssignedExperimentVariant(
    source.experiments,
    context.visitorId,
  );

  if (!assignment) return campaign;

  const { experiment, variant } = assignment;
  const designOverride = resolveVariantDesignOverride(
    jsonObject(variant.designOverride),
    context.device,
  );
  const textOverride = jsonObject(variant.textOverride);
  const discountOverride = sanitizeDiscountOverride(
    jsonObject(variant.discountOverride),
    campaignShowsDiscountCode(source.discountSync),
  );
  const placementOverride = jsonObject(variant.placementOverride);
  const nextCampaign: StorefrontCampaignResponseItem = {
    ...campaign,
    experimentId: experiment.id,
    variantId: variant.id,
    design: mergeDesignPayload(campaign.design, designOverride),
    texts: {
      ...campaign.texts,
      ...textOverride,
    },
    discount: mergeNullablePayload(campaign.discount, discountOverride),
  };

  applyPlacementOverride(nextCampaign, placementOverride);

  return nextCampaign;
}

function selectAssignedExperimentVariant(
  experiments: StorefrontCampaignSource["experiments"],
  visitorId: string,
  now = new Date(),
) {
  if (!visitorId) return null;

  const experiment = experiments.find(
    (item) =>
      item.status === "RUNNING" &&
      (!item.startsAt || item.startsAt <= now) &&
      (!item.endsAt || item.endsAt >= now),
  );

  if (!experiment) return null;

  const variants = experiment.variants
    .filter(isAssignableExperimentVariant)
    .sort(
      (first, second) => first.createdAt.getTime() - second.createdAt.getTime(),
    );

  if (variants.length === 0) return null;

  const variant = selectExperimentVariant(experiment.id, visitorId, variants);

  return variant ? { experiment, variant } : null;
}

function isAssignableExperimentVariant(variant: ExperimentVariant) {
  return (
    (variant.status === "ACTIVE" || variant.status === "WINNER") &&
    Number(variant.weight) > 0
  );
}

function selectExperimentVariant(
  experimentId: string,
  visitorId: string,
  variants: ExperimentVariant[],
) {
  const totalWeight = variants.reduce(
    (total, variant) =>
      total + Math.max(0, Math.trunc(Number(variant.weight) || 0)),
    0,
  );

  if (!visitorId || totalWeight <= 0) return null;

  let bucket =
    hashAssignmentBucket(`${experimentId}:${visitorId}`) % totalWeight;

  for (const variant of variants) {
    bucket -= Math.max(0, Math.trunc(Number(variant.weight) || 0));
    if (bucket < 0) return variant;
  }

  return variants[variants.length - 1] ?? null;
}

function hashAssignmentBucket(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mergeDesignPayload(
  design: StorefrontCampaignResponseItem["design"],
  override: Record<string, unknown>,
) {
  if (Object.keys(override).length === 0) return design;
  const currentDesign = design as {
    structure?: ReturnType<typeof serializeStructure>;
  };
  const overrideStructure = override.structure as
    | ReturnType<typeof serializeStructure>
    | undefined;

  return compactDesignPayload({
    ...defaultCampaignDesignValues,
    ...design,
    ...override,
    structure: overrideStructure ?? currentDesign.structure ?? null,
  });
}

function mergeNullablePayload<T extends Record<string, unknown> | null>(
  base: T,
  override: Record<string, unknown>,
) {
  if (Object.keys(override).length === 0) return base;

  return compactObject({
    ...(base ?? {}),
    ...override,
  }) as T;
}

function applyPlacementOverride(
  campaign: StorefrontCampaignResponseItem,
  override: Record<string, unknown>,
) {
  const nextDescriptor: StorefrontCampaignPlacementDescriptor = {
    placement: campaign.placement,
    placementSelector: campaign.placementSelector ?? "",
    placementStyle: campaign.placementStyle ?? "",
  };

  if (typeof override.placement === "string") {
    nextDescriptor.placement = override.placement;
  }
  if (typeof override.placementType === "string") {
    nextDescriptor.placement = override.placementType;
  }
  if (typeof override.placementSelector === "string") {
    nextDescriptor.placementSelector = override.placementSelector;
  }
  if (typeof override.customSelector === "string") {
    nextDescriptor.placementSelector = override.customSelector;
  }
  if (typeof override.placementStyle === "string") {
    nextDescriptor.placementStyle = override.placementStyle;
  }
  if (typeof override.customStyle === "string") {
    nextDescriptor.placementStyle = override.customStyle;
  }

  campaign.placement = nextDescriptor.placement;
  campaign.placementSelector = nextDescriptor.placementSelector;
  campaign.placementStyle = nextDescriptor.placementStyle;
  campaign.placements = [nextDescriptor];
}

function readString(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key)?.trim() ?? "";
}

function readList(searchParams: URLSearchParams, key: string) {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

// Single token the storefront can send instead of listing every placement, to
// keep the campaigns request compact. The backend expands it to the full set of
// front (storefront-renderable) placements.
export const ALL_FRONT_DEFAULT_PLACEMENTS_TOKEN =
  "ALL_FRONT_DEFAULT_PLACEMENTS";

// Placements rendered from the campaigns endpoint. Badge placements
// (PRODUCT_PAGE_BADGE, COLLECTION_CARD) are intentionally excluded: they are
// served by the dedicated badges endpoint, so including them here only made the
// campaigns payload return the same campaign once per badge placement.
export const STOREFRONT_FRONT_PLACEMENTS = [
  "TOP_BAR",
  "BOTTOM_BAR",
  "CUSTOM_SELECTOR",
  "PRODUCT_PAGE",
  "CART_PAGE",
  "CART_DRAWER",
] as const;

function readPlacementList(value: string) {
  const items = Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  if (!items.includes(ALL_FRONT_DEFAULT_PLACEMENTS_TOKEN)) {
    return items;
  }

  const expanded = items.filter(
    (item) => item !== ALL_FRONT_DEFAULT_PLACEMENTS_TOKEN,
  );

  for (const placement of STOREFRONT_FRONT_PLACEMENTS) {
    if (!expanded.includes(placement)) {
      expanded.push(placement);
    }
  }

  return expanded;
}

function readNumber(searchParams: URLSearchParams, key: string) {
  const rawValue = readString(searchParams, key);
  if (!rawValue) return null;

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function readBoolean(searchParams: URLSearchParams, key: string) {
  const value = readString(searchParams, key).toLowerCase();

  return value === "1" || value === "true" || value === "yes";
}

function readNullableBoolean(searchParams: URLSearchParams, key: string) {
  const value = readString(searchParams, key).toLowerCase();

  if (!value) return null;

  return value === "1" || value === "true" || value === "yes";
}

function jsonStringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function jsonObjectOrNull(value: unknown): Record<string, unknown> | null {
  const object = jsonObject(value);

  return Object.keys(object).length > 0 ? object : null;
}

function readRuleObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readThresholdRule(value: unknown, key: string) {
  if (!key || !value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return readNumericThreshold((value as Record<string, unknown>)[key]);
}

function readNumericThreshold(value: unknown) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function readIntegerOverride(value: unknown) {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function readDeliveryAfterCutoffBehavior(value: unknown) {
  return value === "SHOW_NEXT_WINDOW" ||
    value === "SHOW_AFTER_CUTOFF_MESSAGE" ||
    value === "HIDE"
    ? value
    : null;
}

function readBadgeShape(value: unknown) {
  if (value === "ROUNDED" || value === "SQUARE" || value === "PILL") {
    return value;
  }

  if (value === "RECTANGLE") return "ROUNDED";
  if (value === "RIBBON") return "SQUARE";

  return "PILL";
}

function readBadgePosition(value: unknown) {
  return value === "TOP_LEFT" ||
    value === "TOP_RIGHT" ||
    value === "BOTTOM_LEFT" ||
    value === "BOTTOM_RIGHT"
    ? value
    : "TOP_RIGHT";
}

function matchesOptionalExactList(
  allowedValues: string[],
  actualValue: string,
) {
  if (allowedValues.length === 0) return true;
  if (!actualValue) return false;

  return allowedValues.some(
    (allowedValue) =>
      allowedValue.trim().toLowerCase() === actualValue.trim().toLowerCase(),
  );
}

function matchesOptionalLocaleList(allowedValues: string[], locale: string) {
  if (allowedValues.length === 0) return true;

  const normalizedLocale = normalizeStorefrontLocale(locale);
  if (!normalizedLocale) return false;

  return allowedValues.some(
    (allowedValue) =>
      normalizeStorefrontLocale(allowedValue) === normalizedLocale,
  );
}

function matchesOptionalIntersection(
  allowedValues: string[],
  actualValues: string[],
) {
  if (allowedValues.length === 0) return true;

  return matchesAny(allowedValues, actualValues);
}

function matchesOptionalPathContains(allowedValues: string[], path: string) {
  if (allowedValues.length === 0) return true;

  return matchesPathContains(allowedValues, path);
}

function matchesPathContains(allowedValues: string[], path: string) {
  if (allowedValues.length === 0 || !path) return false;

  const normalizedPath = normalizePathTarget(path);

  return allowedValues.some((allowedValue) => {
    const normalizedTarget = normalizePathTarget(allowedValue);

    if (normalizedTarget.startsWith("page:")) {
      return matchesStorefrontPageTarget(normalizedTarget, normalizedPath);
    }

    return normalizedPath.includes(normalizedTarget);
  });
}

function normalizePathTarget(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) return "";
  if (/^page:[a-z]+$/i.test(trimmedValue)) return trimmedValue.toLowerCase();

  try {
    const url = new URL(trimmedValue);
    return `${url.pathname}${url.search}`.toLowerCase();
  } catch {
    return trimmedValue.toLowerCase();
  }
}

function matchesStorefrontPageTarget(target: string, normalizedPath: string) {
  const pathname = normalizedPath.split("?")[0]?.replace(/\/+$/, "") || "/";

  if (target === "page:home") return pathname === "/";
  if (target === "page:product") {
    return (
      pathname.startsWith("/products/") ||
      /^\/collections\/[^/]+\/products\//.test(pathname)
    );
  }
  if (target === "page:collection") {
    return /^\/collections\/[^/]+$/.test(pathname);
  }
  if (target === "page:collections") return pathname === "/collections";
  if (target === "page:page") return pathname.startsWith("/pages/");
  if (target === "page:cart") return pathname === "/cart";
  if (target === "page:search") return pathname === "/search";
  if (target === "page:blog") return pathname.startsWith("/blogs/");

  return false;
}

function matchesAny(allowedValues: string[], actualValues: string[]) {
  const normalizedActualValues = new Set(
    actualValues
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  );

  return allowedValues.some((allowedValue) =>
    normalizedActualValues.has(allowedValue.trim().toLowerCase()),
  );
}

function findTranslation(translations: CampaignTranslation[], locale: string) {
  return translations.find(
    (translation) => normalizeStorefrontLocale(translation.locale) === locale,
  );
}

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function hasText(value: string | null | undefined) {
  return readText(value).length > 0;
}
