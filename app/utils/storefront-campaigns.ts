import type {
  BadgeSettings,
  Campaign,
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
import {
  campaignTranslationFields,
  type CampaignTextField,
} from "../types/localization";
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
  campaignId: string;
  visitorId: string;
  sessionId: string;
  doNotTrack: boolean;
  consentGranted: boolean | null;
  behaviorProfile: VisitorBehaviorProfile | null;
};

export type StorefrontCampaignSource = Omit<
  Campaign,
  "lastSavedAt" | "publishedAt" | "publishedSnapshot"
> & {
  lastSavedAt?: Date;
  publishedAt?: Date | null;
  publishedSnapshot?: Prisma.JsonValue | null;
  placements: CampaignPlacement[];
  targeting: CampaignTargeting | null;
  design: CampaignDesign | null;
  timerSettings: TimerSettings | null;
  freeShippingSettings: FreeShippingSettings | null;
  deliveryCutoffSettings: DeliveryCutoffSettings | null;
  lowStockSettings: LowStockSettings | null;
  badgeSettings: BadgeSettings | null;
  discountSync: DiscountSync | null;
  marketCampaignRules: MarketCampaignRule[];
  translations: CampaignTranslation[];
  experiments: Array<Experiment & { variants: ExperimentVariant[] }>;
};

export type StorefrontCampaignResponseItem = {
  id: string;
  type: string;
  goal: string;
  placement: string;
  placementSelector: string;
  design: ReturnType<typeof serializeDesign>;
  timer: ReturnType<typeof serializeTimer>;
  freeShipping: ReturnType<typeof serializeFreeShipping>;
  deliveryCutoff: ReturnType<typeof serializeDeliveryCutoff>;
  lowStock: ReturnType<typeof serializeLowStock>;
  badge: ReturnType<typeof serializeBadge>;
  texts: Record<CampaignTextField | "ctaUrl", string>;
  discount: ReturnType<typeof serializeDiscount>;
  experiment: ReturnType<typeof serializeExperiment>;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
};

export function parseStorefrontCampaignContext(
  url: URL,
): StorefrontCampaignContext {
  const searchParams = url.searchParams;

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
    placement: readString(searchParams, "placement").toUpperCase(),
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
    getMatchingPlacement(campaign, context) &&
    isTargetingEligible(campaign.targeting, context),
  );
}

export function serializeStorefrontCampaign(
  campaign: StorefrontCampaignSource,
  context: StorefrontCampaignContext,
): StorefrontCampaignResponseItem | null {
  const placement = getMatchingPlacement(campaign, context);

  if (!placement || !isTargetingEligible(campaign.targeting, context)) {
    return null;
  }

  const serializedCampaign = {
    id: campaign.id,
    type: campaign.type,
    goal: campaign.goal,
    placement: placement.placementType,
    placementSelector: placement.customSelector ?? "",
    design: serializeDesign(campaign.design, context.device),
    timer: serializeTimer(campaign.timerSettings),
    freeShipping: serializeFreeShipping(campaign.freeShippingSettings, context),
    deliveryCutoff: serializeDeliveryCutoff(
      campaign.deliveryCutoffSettings,
      context,
    ),
    lowStock: serializeLowStock(campaign.lowStockSettings),
    badge: serializeBadge(campaign.badgeSettings),
    texts: serializeTexts(campaign, context.locale),
    discount: serializeDiscount(campaign.discountSync),
    experiment: serializeExperiment(campaign.experiments),
    startsAt: campaign.startsAt ? campaign.startsAt.toISOString() : null,
    endsAt: campaign.endsAt ? campaign.endsAt.toISOString() : null,
    timezone: campaign.timezone,
  };

  return applyMarketCampaignRule(
    serializedCampaign,
    campaign.marketCampaignRules,
    context,
  );
}

export function serializeStorefrontCampaigns(
  campaigns: StorefrontCampaignSource[],
  context: StorefrontCampaignContext,
) {
  return campaigns
    .filter(
      (campaign) => !context.campaignId || campaign.id === context.campaignId,
    )
    .map((campaign) => serializeStorefrontCampaign(campaign, context))
    .filter(
      (campaign): campaign is StorefrontCampaignResponseItem =>
        campaign !== null,
    );
}

export function shouldBypassStorefrontCache(
  context: StorefrontCampaignContext,
) {
  return context.cartSubtotal !== null || context.utmSource.length > 0;
}

function getMatchingPlacement(
  campaign: StorefrontCampaignSource,
  context: StorefrontCampaignContext,
) {
  const enabledPlacements = campaign.placements.filter(
    (placement) => placement.enabled,
  );

  if (!context.placement) return enabledPlacements[0] ?? null;

  return (
    enabledPlacements.find(
      (placement) => placement.placementType === context.placement,
    ) ?? (context.campaignId ? (enabledPlacements[0] ?? null) : null)
  );
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
  const mobileDesign =
    isMobileDesignDevice(device)
      ? readCampaignDesignJsonObject(design?.mobileDesign)
      : null;

  return {
    ...desktopDesign,
    ...mobileDesign,
    customCss:
      typeof mobileDesign?.customCss === "string"
        ? mobileDesign.customCss
        : desktopDesign.customCss,
  };
}

function isMobileDesignDevice(device: string) {
  return device === "mobile" || device === "tablet";
}

function serializeDesktopDesign(design: CampaignDesign | null) {
  if (!design) return defaultCampaignDesignValues;

  const desktopDesign = { ...design } as Partial<CampaignDesignValues> & {
    mobileDesign?: unknown;
    customCss?: string | null;
  };
  delete desktopDesign.mobileDesign;

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

  return {
    mode: timerSettings.mode,
    durationMinutes: timerSettings.durationMinutes,
    recurringDays: timerSettings.recurringDays,
    resetBehavior: timerSettings.resetBehavior,
    expiredBehavior: timerSettings.expiredBehavior,
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

  return {
    thresholdAmount: resolvedThresholdAmount.toFixed(2),
    baseThresholdAmount: settings.thresholdAmount.toString(),
    currencyCode: settings.currencyCode,
    includeDiscountedSubtotal: settings.includeDiscountedSubtotal,
    emptyCartMessage: settings.emptyCartMessage ?? "",
    successMessage: settings.successMessage,
    progressStyle: settings.progressStyle,
  };
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

  return {
    afterCutoffBehavior: resolvedSettings.afterCutoffBehavior,
    cutoffHour: resolvedSettings.cutoffHour,
    cutoffMinute: resolvedSettings.cutoffMinute,
    processingDays: resolvedSettings.processingDays,
    minDeliveryDays: resolvedSettings.minDeliveryDays,
    maxDeliveryDays: resolvedSettings.maxDeliveryDays,
    workingDays: resolvedSettings.workingDays,
    holidays: resolvedSettings.holidays,
  };
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

  return {
    badgeText: settings.badgeText,
    badgeShape: readBadgeShape(settings.badgeShape),
    badgePosition: readBadgePosition(settings.badgePosition),
  };
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

function serializeDiscount(discountSync: DiscountSync | null) {
  if (!discountSync) return null;

  const showCodeOnStorefront =
    (discountSync as { showCodeOnStorefront?: boolean | null })
      .showCodeOnStorefront !== false;

  return {
    method: discountSync.method,
    discountCode: showCodeOnStorefront ? discountSync.discountCode : null,
    uniqueCode:
      discountSync.method === "UNIQUE_CODE"
        ? {
            endpoint: "/api/storefront/unique-code/assign",
            autoApply: discountSync.uniqueCodeAutoApply,
            expiresMinutes: discountSync.uniqueCodeExpiresMinutes,
          }
        : null,
  };
}

function serializeExperiment(
  experiments: StorefrontCampaignSource["experiments"],
  now = new Date(),
) {
  const experiment = experiments.find(
    (item) =>
      item.status === "RUNNING" &&
      (!item.startsAt || item.startsAt <= now) &&
      (!item.endsAt || item.endsAt >= now),
  );

  if (!experiment) return null;

  const variants = experiment.variants
    .filter(
      (variant) =>
        (variant.status === "ACTIVE" || variant.status === "WINNER") &&
        Number(variant.weight) >= 0,
    )
    .map((variant) => ({
      id: variant.id,
      name: variant.name,
      weight: variant.weight,
      status: variant.status,
      designOverride: jsonObject(variant.designOverride),
      textOverride: jsonObject(variant.textOverride),
      discountOverride: jsonObject(variant.discountOverride),
      placementOverride: jsonObject(variant.placementOverride),
    }));

  if (variants.length === 0) return null;

  return {
    id: experiment.id,
    name: experiment.name,
    status: experiment.status,
    trafficSplitStrategy: experiment.trafficSplitStrategy,
    primaryMetric: experiment.primaryMetric,
    variants,
  };
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
  if (!path) return false;

  const normalizedPath = path.toLowerCase();

  return allowedValues.some((allowedValue) =>
    normalizedPath.includes(allowedValue.toLowerCase()),
  );
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

function findTranslation(
  translations: CampaignTranslation[],
  locale: "en" | "es" | "pt-BR" | "fr" | "de",
) {
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
