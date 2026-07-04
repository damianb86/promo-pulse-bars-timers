import type {} from "react-router";
import {
  ExperimentPrimaryMetric,
  ExperimentStatus,
  ExperimentVariantStatus,
  } from "@prisma/client";

import {
  type AdvancedDiscountRuleRow,
} from "../components/AdvancedDiscountRulesEditor";
import {
  type EmailTimerRow,
} from "../components/EmailTimerEditor";
import {
  type MarketOptionRow,
  type MarketRuleRow,
} from "../components/CampaignMarketsEditor";
import {
  type ExperimentRow,
} from "../components/ExperimentsEditor";
import {
  type UniqueCodePoolRow,
  type UniqueCodeRow,
  } from "../components/UniqueCodesEditor";
import {
  getCampaignForShop,
  updateDiscountSyncForShop,
  } from "../models/campaign.server";
import {
  type ExperimentResults,
  } from "../services/experiments";
import {
  buildEmailTimerImageUrl,
  buildEmailTimerSnippet,
  } from "../services/email-timers/emailTimers.server";
import {
  fetchShopMarkets,
  type ShopifyMarket,
} from "../services/markets/markets.server";
import {
  createAutomaticFreeShippingDiscount,
  getDiscountByCodeOrId,
  listCodeDiscounts,
  SHOPIFY_DISCOUNT_SCOPE_MESSAGE,
  syncCampaignDatesFromDiscount,
  updateAutomaticFreeShippingDiscount,
  type ShopifyGraphqlClient,
  type ShopifyDiscountSummary,
} from "../services/shopifyDiscounts.server";
import {
  defaultBadgeSettingsValues,
  toBadgePosition,
  toBadgeShape,
  type BadgeSettingsValues,
} from "../types/badge";
import type {
  CampaignDesignValues,
} from "../types/campaign-design";
import {
  defaultCampaignDesignValues,
  } from "../types/campaign-design";
import {
  campaignEditableStatusOptions,
  campaignGoalOptions,
  campaignTypeOptions,
  placementTypeOptions,
  type CampaignGoalValue,
  type CampaignTypeValue,
  type EditableCampaignStatusValue,
  type PlacementTypeValue,
} from "../types/campaign-options";
import {
  defaultCampaignFormValues,
  type CampaignFormValues,
  type CountrySelectionValue,
  type ProductSelectionValue,
} from "../types/campaign-form";
import {
  defaultDeliveryCutoffSettingsValues,
  toAfterCutoffBehavior,
  type DeliveryCutoffSettingsValues,
} from "../types/delivery-cutoff";
import {
  defaultDiscountSettingsValues,
  type DiscountOption,
  type DiscountSettingsValues,
} from "../types/discount";
import {
  defaultFreeShippingSettingsValues,
  type FreeShippingSettingsValues,
} from "../types/free-shipping";
import {
  defaultLowStockSettingsValues,
  type LowStockSettingsValues,
} from "../types/low-stock";
import type {
  } from "../types/localization";
import {
  decodePackedStructure,
  treeToHtml,
  unpackTree,
} from "../utils/campaign-structure";
import {
  isSeparateMobileDesignEnabled,
  resolveMobileCampaignDesign,
} from "../utils/responsive-design";
import { toDateTimeLocalValue } from "./campaign-editor-form.server";

export function toExperimentRow(
  experiment: {
    id: string;
    name: string;
    status: string;
    primaryMetric: string;
    trafficSplitStrategy: string;
    startsAt: Date | string | null;
    endsAt: Date | string | null;
    winnerVariantId: string | null;
    winnerAppliedAt?: Date | string | null;
    autoWinnerEnabled: boolean;
    autoWinnerMinSampleSize: number;
    autoWinnerMinRuntimeHours: number;
    autoWinnerConfidenceThreshold: number;
    variants: Array<{
      id: string;
      name: string;
      weight: number;
      status: string;
      designOverride: unknown;
      textOverride: unknown;
      discountOverride: unknown;
      placementOverride: unknown;
    }>;
  },
  results: ExperimentResults,
): ExperimentRow {
  const variantTrafficSplitById = new Map(
    experiment.variants.map((variant) => [variant.id, variant.weight]),
  );

  return {
    id: experiment.id,
    name: experiment.name,
    status: experiment.status,
    primaryMetric: experiment.primaryMetric,
    trafficSplitStrategy: experiment.trafficSplitStrategy,
    startsAt: toShortDateTime(experiment.startsAt),
    endsAt: toShortDateTime(experiment.endsAt),
    winnerVariantId: experiment.winnerVariantId ?? "",
    winnerAppliedAt: toShortDateTime(experiment.winnerAppliedAt ?? null),
    autoWinnerEnabled: experiment.autoWinnerEnabled,
    autoWinnerMinSampleSize: experiment.autoWinnerMinSampleSize,
    autoWinnerMinRuntimeHours: experiment.autoWinnerMinRuntimeHours,
    autoWinnerConfidenceThreshold: experiment.autoWinnerConfidenceThreshold,
    variants: sortExperimentVariants(experiment.variants).map((variant) => ({
      id: variant.id,
      name: variant.name,
      weight: variant.weight,
      status: variant.status,
      designOverrideJson: jsonTextareaValue(variant.designOverride),
      textOverrideJson: jsonTextareaValue(variant.textOverride),
      discountOverrideJson: jsonTextareaValue(variant.discountOverride),
      placementOverrideJson: jsonTextareaValue(variant.placementOverride),
    })),
    results: {
      runtimeHours: results.runtimeHours,
      currencyCode: results.currencyCode,
      variants: results.variants.map((variant) => ({
        variantId: variant.variantId,
        variantName: variant.variantName,
        trafficSplit: variantTrafficSplitById.get(variant.variantId) ?? 0,
        impressions: variant.impressions,
        clicks: variant.clicks,
        ctr: variant.ctr,
        addToCart: variant.addToCart,
        checkoutStarted: variant.checkoutStarted,
        orders: variant.orders,
        revenue: variant.revenue,
        revenuePerVisitor: variant.revenuePerVisitor,
        conversionRate: variant.conversionRate,
        visitors: variant.visitors,
        primaryMetricValue: variant.primaryMetricValue,
      })),
    },
  };
}

export function emptyExperimentResults(experiment: {
  id: string;
  campaignId: string;
  status: string;
  primaryMetric: string;
  winnerVariantId: string | null;
  autoWinnerEnabled: boolean;
  autoWinnerMinSampleSize: number;
  autoWinnerMinRuntimeHours: number;
  autoWinnerConfidenceThreshold: number;
  variants: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}): ExperimentResults {
  return {
    experimentId: experiment.id,
    campaignId: experiment.campaignId,
    status: experiment.status as ExperimentStatus,
    primaryMetric: experiment.primaryMetric as ExperimentPrimaryMetric,
    winnerVariantId: experiment.winnerVariantId,
    runtimeHours: 0,
    currencyCode: "USD",
    autoWinner: {
      enabled: experiment.autoWinnerEnabled,
      minSampleSize: experiment.autoWinnerMinSampleSize,
      minRuntimeHours: experiment.autoWinnerMinRuntimeHours,
      confidenceThreshold: experiment.autoWinnerConfidenceThreshold,
    },
    variants: sortExperimentVariants(experiment.variants).map((variant) => ({
      variantId: variant.id,
      variantName: variant.name,
      status: variant.status as ExperimentVariantStatus,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      addToCart: 0,
      addToCartRate: 0,
      checkoutStarted: 0,
      checkoutRate: 0,
      orders: 0,
      revenue: 0,
      revenuePerVisitor: 0,
      conversionRate: 0,
      visitors: 0,
      primaryMetricValue: 0,
    })),
  };
}

export function sortExperimentVariants<T extends { name: string }>(variants: T[]) {
  return [...variants].sort((left, right) => {
    const leftRank = experimentVariantSortRank(left.name);
    const rightRank = experimentVariantSortRank(right.name);

    if (leftRank !== rightRank) return leftRank - rightRank;

    return left.name.localeCompare(right.name);
  });
}

export function experimentVariantSortRank(name: string) {
  const normalized = name.trim().toLowerCase();

  if (normalized === "control") return 0;

  const variantLetter = normalized.match(/^variant\s+([a-z])$/);

  if (variantLetter?.[1]) {
    return 10 + variantLetter[1].charCodeAt(0) - "a".charCodeAt(0);
  }

  return 100;
}

export function jsonTextareaValue(value: unknown) {
  if (!value || typeof value !== "object") return "";

  return JSON.stringify(value, null, 2);
}

export function toUniqueCodePoolRow(pool: {
  id: string;
  prefix: string;
  discountType: string;
  value: { toString(): string } | null;
  status: string;
  totalGenerated: number;
  totalAssigned: number;
  totalUsed: number;
  reassignExpiredUnused: boolean;
  expiresAt: Date | string | null;
}): UniqueCodePoolRow {
  return {
    id: pool.id,
    prefix: pool.prefix,
    discountType: formatEnum(pool.discountType),
    value: pool.value?.toString() ?? "",
    status: formatEnum(pool.status),
    totalGenerated: pool.totalGenerated,
    totalAssigned: pool.totalAssigned,
    totalUsed: pool.totalUsed,
    reassignExpiredUnused: pool.reassignExpiredUnused,
    expiresAt: toShortDateTime(pool.expiresAt),
  };
}

export function toUniqueCodeRow(code: {
  id: string;
  code: string;
  status: string;
  visitorId: string | null;
  assignedAt: Date | string | null;
  expiresAt: Date | string | null;
  usedAt: Date | string | null;
}): UniqueCodeRow {
  return {
    id: code.id,
    code: code.code,
    status: formatEnum(code.status),
    visitorId: code.visitorId ?? "",
    assignedAt: toShortDateTime(code.assignedAt),
    expiresAt: toShortDateTime(code.expiresAt),
    usedAt: toShortDateTime(code.usedAt),
  };
}

export function toEmailTimerRow(
  timer: {
    id: string;
    publicToken: string;
    mode: string;
    endsAt: Date | string | null;
    expiredBehavior: string;
    design: unknown;
    createdAt: Date | string;
  },
  request: Request,
): EmailTimerRow {
  const design = readJsonObject(timer.design);
  const width = clampIntegerValue(design.width, 240, 1200, 600);
  const height = clampIntegerValue(design.height, 80, 400, 180);
  const imageUrl = buildEmailTimerImageUrl(request, timer.publicToken);

  return {
    id: timer.id,
    imageUrl,
    snippet: buildEmailTimerSnippet(imageUrl, width),
    width,
    height,
    preset: formatEmailTimerPreset(readStringValue(design.presetKey, "custom")),
    fontFamily: formatEnum(readStringValue(design.fontFamily, "BLOCK")),
    mode: formatEnum(timer.mode),
    expiredBehavior: formatEnum(timer.expiredBehavior),
    endsAt: toShortDateTime(timer.endsAt),
    createdAt: toShortDateTime(timer.createdAt),
  };
}

export function toAdvancedDiscountRuleRow(rule: {
  id: string;
  title: string;
  ruleType: string;
  status: string;
  thresholds: unknown;
  productIds: unknown;
  collectionIds: unknown;
  discountValue: { toString(): string } | null;
  shippingDiscountValue: { toString(): string } | null;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  shopifyDiscountId: string | null;
}): AdvancedDiscountRuleRow {
  return {
    id: rule.id,
    title: rule.title,
    ruleType: rule.ruleType,
    status: rule.status,
    thresholdsJson: jsonTextareaValue(rule.thresholds),
    productIds: jsonListText(rule.productIds),
    collectionIds: jsonListText(rule.collectionIds),
    discountValue: rule.discountValue?.toString() ?? "",
    shippingDiscountValue: rule.shippingDiscountValue?.toString() ?? "",
    startsAt: toShortDateTime(rule.startsAt),
    endsAt: toShortDateTime(rule.endsAt),
    shopifyDiscountId: rule.shopifyDiscountId ?? "",
  };
}

export function jsonListText(value: unknown) {
  return Array.isArray(value) ? value.join("\n") : "";
}

export function readJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readStringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function clampIntegerValue(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;

  return Math.max(min, Math.min(max, parsed));
}

export function toShortDateTime(date: Date | string | null) {
  if (!date) return "";

  const parsedDate = typeof date === "string" ? new Date(date) : date;

  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toISOString().slice(0, 16).replace("T", " ");
}

export function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatEmailTimerPreset(value: string) {
  if (value === "custom") return "Custom";

  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toCampaignGoal(value: string, type: string): CampaignGoalValue {
  if (campaignGoalOptions.some((option) => option.value === value)) {
    return value as CampaignGoalValue;
  }

  if (type === "DELIVERY_CUTOFF") return "DELIVERY_CUTOFF";
  if (type === "PRODUCT_BADGE") return "PRODUCT_BADGE";
  return "ANNOUNCEMENT";
}

export function toCampaignType(value: string): CampaignTypeValue {
  if (campaignTypeOptions.some((option) => option.value === value)) {
    return value as CampaignTypeValue;
  }

  return "COUNTDOWN_BAR";
}

export function toCampaignStatus(value: string): EditableCampaignStatusValue {
  if (campaignEditableStatusOptions.some((option) => option.value === value)) {
    return value as EditableCampaignStatusValue;
  }

  return "DRAFT";
}

export function toPlacementType(value: string): PlacementTypeValue {
  if (placementTypeOptions.some((option) => option.value === value)) {
    return value as PlacementTypeValue;
  }

  return "TOP_BAR";
}

export type CampaignTargetingRecord = {
  countries?: unknown;
  productIds?: unknown;
  collectionIds?: unknown;
  productTags?: unknown;
  excludeProductIds?: unknown;
} | null;

export function inferProductSelection(
  targeting: CampaignTargetingRecord,
): ProductSelectionValue {
  if (targetingStringList(targeting?.productIds).length > 0) {
    return "SPECIFIC_PRODUCTS";
  }
  if (targetingStringList(targeting?.collectionIds).length > 0) {
    return "COLLECTIONS";
  }
  if (targetingStringList(targeting?.productTags).length > 0) return "TAGS";

  return "ALL_PRODUCTS";
}

export function inferCountrySelection(
  targeting: CampaignTargetingRecord,
): CountrySelectionValue {
  return targetingStringList(targeting?.countries).length > 0
    ? "SPECIFIC_COUNTRIES"
    : "ALL_WORLD";
}

export function targetingListText(value: unknown) {
  return targetingStringList(value).join("\n");
}

export function targetingStringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export type CampaignDesignRecord =
  | (Partial<Omit<CampaignDesignValues, "customCss">> & {
      customCss?: string | null;
      mobileDesign?: unknown;
    })
  | null;

// Decodes the saved structural HTML (packed AST) back into clean editor HTML so
// the design HTML modal can show a merchant's hand-edited structure.
export function decodeStructureHtml(compact: string | null | undefined): string {
  const packed = decodePackedStructure(compact);
  if (!packed) return "";
  try {
    return treeToHtml(unpackTree(packed));
  } catch {
    return "";
  }
}

// Reads the mobile structure override (stored inside the mobile design JSON).
export function readMobileStructure(value: unknown): {
  mobileStructureCompact?: string | null;
  mobileStructureCss?: string | null;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const compact = record.mobileStructureCompact;
  if (typeof compact !== "string" || !compact) return null;
  return {
    mobileStructureCompact: compact,
    mobileStructureCss:
      typeof record.mobileStructureCss === "string"
        ? record.mobileStructureCss
        : "",
  };
}

export function toCampaignDesignValues(
  design: CampaignDesignRecord,
): CampaignDesignValues {
  const baseDesign = { ...(design ?? {}) } as Partial<CampaignDesignValues> & {
    mobileDesign?: unknown;
  };
  const mobileDesign =
    design && readCampaignDesignJsonObject(design.mobileDesign);
  delete baseDesign.mobileDesign;

  return {
    ...defaultCampaignDesignValues,
    ...baseDesign,
    customCss: design?.customCss ?? "",
    separateMobileDesign: isSeparateMobileDesignEnabled(mobileDesign),
  };
}

export function toCampaignMobileDesignValues(
  design: CampaignDesignRecord,
  desktopValues: CampaignDesignValues,
): CampaignDesignValues {
  const mobileDesign =
    design && readCampaignDesignJsonObject(design.mobileDesign);

  return resolveMobileCampaignDesign(desktopValues, mobileDesign);
}

export function readCampaignDesignJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<CampaignDesignValues>)
    : null;
}

export function toFreeShippingSettingsValues(
  settings: {
    thresholdAmount: { toString(): string };
    currencyCode: string;
    includeDiscountedSubtotal: boolean;
    emptyCartMessage?: string | null;
    successMessage?: string | null;
    progressStyle: string;
    thresholdRules?: unknown;
  } | null,
): FreeShippingSettingsValues {
  if (!settings) return defaultFreeShippingSettingsValues;

  return {
    thresholdAmount: settings.thresholdAmount.toString(),
    currencyCode: settings.currencyCode,
    includeDiscountedSubtotal: settings.includeDiscountedSubtotal,
    emptyCartMessage:
      settings.emptyCartMessage ??
      defaultFreeShippingSettingsValues.emptyCartMessage,
    successMessage:
      settings.successMessage ??
      defaultFreeShippingSettingsValues.successMessage,
    progressStyle: isFreeShippingProgressStyle(settings.progressStyle)
      ? settings.progressStyle
      : defaultFreeShippingSettingsValues.progressStyle,
    thresholdRulesJson: settings.thresholdRules
      ? JSON.stringify(settings.thresholdRules, null, 2)
      : "",
  };
}

export function toCampaignFreeShippingFormValues(
  settings: {
    thresholdAmount: { toString(): string };
    currencyCode: string;
    includeDiscountedSubtotal: boolean;
    emptyCartMessage?: string | null;
    successMessage?: string | null;
    progressStyle: string;
  } | null,
  discountSync: {
    method?: string | null;
    shopifyDiscountId?: string | null;
    discountCode?: string | null;
    title?: string | null;
    valueType?: string | null;
    minimumSubtotal?: { toString(): string } | string | number | null;
    appliesOncePerCustomer?: boolean | null;
    showCodeOnStorefront?: boolean | null;
  } | null,
): Pick<
  CampaignFormValues,
  | "freeShippingThresholdAmount"
  | "freeShippingCurrencyCode"
  | "freeShippingIncludeDiscountedSubtotal"
  | "freeShippingProgressStyle"
  | "freeShippingEmptyCartMessage"
  | "freeShippingSuccessMessage"
  | "freeShippingAutoDiscount"
  | "freeShippingExistingDiscount"
  | "freeShippingDiscountCode"
  | "freeShippingDiscountTitle"
  | "freeShippingDiscountAppliesOncePerCustomer"
  | "freeShippingShowDiscountCode"
> {
  const freeShippingValues = toFreeShippingSettingsValues(settings);
  const hasFreeShippingDiscount = discountSync?.valueType === "FREE_SHIPPING";

  return {
    freeShippingThresholdAmount:
      freeShippingValues.thresholdAmount ||
      readStringLike(discountSync?.minimumSubtotal) ||
      defaultFreeShippingSettingsValues.thresholdAmount,
    freeShippingCurrencyCode: freeShippingValues.currencyCode,
    freeShippingIncludeDiscountedSubtotal:
      freeShippingValues.includeDiscountedSubtotal,
    freeShippingProgressStyle: freeShippingValues.progressStyle,
    freeShippingEmptyCartMessage: freeShippingValues.emptyCartMessage,
    freeShippingSuccessMessage: freeShippingValues.successMessage,
    freeShippingAutoDiscount: hasFreeShippingDiscount,
    freeShippingExistingDiscount:
      discountSync?.method === "CODE" ? (discountSync.discountCode ?? "") : "",
    freeShippingDiscountCode:
      discountSync?.discountCode ??
      defaultCampaignFormValues.freeShippingDiscountCode,
    freeShippingDiscountTitle:
      discountSync?.title ??
      defaultCampaignFormValues.freeShippingDiscountTitle,
    freeShippingDiscountAppliesOncePerCustomer:
      discountSync?.appliesOncePerCustomer ?? false,
    freeShippingShowDiscountCode:
      discountSync?.showCodeOnStorefront ??
      defaultCampaignFormValues.freeShippingShowDiscountCode,
  };
}

export function readStringLike(
  value:
    | {
        toString(): string;
      }
    | string
    | number
    | null
    | undefined,
) {
  if (value === null || value === undefined) return "";

  return String(value);
}

export function toCampaignDeliveryCutoffFormValues(
  settings: {
    cutoffHour: number;
    cutoffMinute: number;
    processingDays: number;
    minDeliveryDays: number;
    maxDeliveryDays: number;
    workingDays: unknown;
    holidays: unknown;
    countryRules: unknown;
    afterCutoffBehavior?: string | null;
  } | null,
  campaignTimezone: string,
): Pick<
  CampaignFormValues,
  | "deliveryCutoffHour"
  | "deliveryCutoffMinute"
  | "deliveryProcessingDays"
  | "deliveryMinDays"
  | "deliveryMaxDays"
  | "deliveryWorkingDays"
  | "deliveryAfterCutoffBehavior"
> {
  const values = toDeliveryCutoffSettingsValues(settings, campaignTimezone);

  return {
    deliveryCutoffHour: values.cutoffHour,
    deliveryCutoffMinute: values.cutoffMinute,
    deliveryProcessingDays: values.processingDays,
    deliveryMinDays: values.minDeliveryDays,
    deliveryMaxDays: values.maxDeliveryDays,
    deliveryWorkingDays: readDeliveryWorkingDays(values.workingDaysJson),
    deliveryAfterCutoffBehavior: values.afterCutoffBehavior,
  };
}

export function toCampaignLowStockFormValues(
  settings: {
    threshold: number;
    showExactQuantity: boolean;
    fallbackMessage?: string | null;
  } | null,
): Pick<
  CampaignFormValues,
  "lowStockThreshold" | "lowStockShowExactQuantity" | "lowStockFallbackMessage"
> {
  const values = toLowStockSettingsValues(settings);

  return {
    lowStockThreshold: values.threshold,
    lowStockShowExactQuantity: values.showExactQuantity,
    lowStockFallbackMessage: values.fallbackMessage,
  };
}

export function toCampaignBadgeFormValues(
  settings: {
    badgeText: string;
    badgeShape: string;
    badgePosition: string;
  } | null,
): Pick<CampaignFormValues, "badgeText" | "badgeShape" | "badgePosition"> {
  const values = toBadgeSettingsValues(settings);

  return {
    badgeText: values.badgeText,
    badgeShape: values.badgeShape,
    badgePosition: values.badgePosition,
  };
}

export function readDeliveryWorkingDays(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      const days = parsed
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7);

      if (days.length > 0) return Array.from(new Set(days)).join(",");
    }
  } catch {
    return defaultCampaignFormValues.deliveryWorkingDays;
  }

  return defaultCampaignFormValues.deliveryWorkingDays;
}

export async function loadDiscountOptions(admin: ShopifyGraphqlClient): Promise<{
  discounts: DiscountOption[];
  error: string;
}> {
  try {
    return {
      discounts: await listCodeDiscounts(admin, { first: 20 }),
      error: "",
    };
  } catch (error) {
    return {
      discounts: [],
      error:
        error instanceof Error ? error.message : SHOPIFY_DISCOUNT_SCOPE_MESSAGE,
    };
  }
}

export async function loadMarketOptions(admin: ShopifyGraphqlClient): Promise<{
  markets: ShopifyMarket[];
  error: string;
}> {
  try {
    return {
      markets: await fetchShopMarkets(admin),
      error: "",
    };
  } catch (error) {
    return {
      markets: [],
      error:
        error instanceof Error
          ? error.message
          : "Shopify Markets could not be loaded.",
    };
  }
}

export function toMarketOptionRow(market: ShopifyMarket): MarketOptionRow {
  return {
    id: market.handle || market.id,
    name: market.name,
    handle: market.handle,
    enabled: market.enabled,
    primary: market.primary,
    countryCodes: market.countryCodes.join(", "),
    locale: market.locale,
    currencyCode: market.currencyCode,
  };
}

export function toMarketRuleRow(rule: {
  id: string;
  enabled: boolean;
  marketId: string | null;
  countryCode: string | null;
  locale: string | null;
  currencyCode: string | null;
  thresholdAmount: { toString(): string } | null;
  deliverySettings: unknown;
}): MarketRuleRow {
  return {
    id: rule.id,
    enabled: rule.enabled,
    marketId: rule.marketId ?? "",
    countryCode: rule.countryCode ?? "",
    locale: rule.locale ?? "",
    currencyCode: rule.currencyCode ?? "",
    thresholdAmount: rule.thresholdAmount?.toString() ?? "",
    deliverySettingsJson: jsonTextareaValue(rule.deliverySettings),
    scopeSummary: summarizeMarketRuleScope(rule),
  };
}

export function summarizeMarketRuleScope(rule: {
  marketId: string | null;
  countryCode: string | null;
  locale: string | null;
  currencyCode: string | null;
}) {
  const parts = [
    rule.marketId ? `market: ${rule.marketId}` : "",
    rule.countryCode ? `country: ${rule.countryCode}` : "",
    rule.locale ? `locale: ${rule.locale}` : "",
    rule.currencyCode ? `currency: ${rule.currencyCode}` : "",
  ].filter(Boolean);

  return parts.join(" | ") || "No scope";
}

export async function linkExistingDiscount({
  admin,
  campaignId,
  shopId,
  codeOrId,
  syncStartEnd,
}: {
  admin: ShopifyGraphqlClient;
  campaignId: string;
  shopId: string;
  codeOrId: string;
  syncStartEnd: boolean;
}) {
  try {
    const discount = await getDiscountByCodeOrId(admin, codeOrId);

    if (!discount) {
      throw new Error(
        "Shopify did not find that discount. Check the code or ID and try again.",
      );
    }

    await saveDiscountForCampaign({
      campaignId,
      shopId,
      discount,
      syncStartEnd,
    });

    return {
      discountCode: discount.code,
      shopifyDiscountId: discount.id,
      notice: "",
    };
  } catch (error) {
    const manualCode = codeOrId.startsWith("gid://shopify/Discount")
      ? null
      : codeOrId.trim().toUpperCase();
    const manualId = codeOrId.startsWith("gid://shopify/Discount")
      ? codeOrId.trim()
      : null;

    if (!manualCode && !manualId) {
      throw error;
    }

    await updateDiscountSyncForShop(campaignId, shopId, {
      shopifyDiscountId: manualId,
      discountCode: manualCode,
      method: "CODE",
      syncStartEnd: false,
      lastSyncedAt: null,
    });

    return {
      discountCode: manualCode,
      shopifyDiscountId: manualId,
      notice:
        error instanceof Error
          ? `${error.message} The manual discount reference was saved without date sync.`
          : "The manual discount reference was saved without date sync.",
    };
  }
}

export async function createOrLinkFreeShippingDiscountForCampaign({
  admin,
  campaignId,
  shopId,
  values,
  startsAt,
  endsAt,
}: {
  admin: ShopifyGraphqlClient;
  campaignId: string;
  shopId: string;
  values: CampaignFormValues;
  startsAt: Date | null;
  endsAt: Date | null;
}) {
  const thresholdAmount = Number(values.freeShippingThresholdAmount);
  const existingReference = values.freeShippingExistingDiscount.trim();
  let discount: ShopifyDiscountSummary | null = null;

  if (existingReference) {
    discount = await getDiscountByCodeOrId(
      admin,
      normalizeShopifyDiscountReference(existingReference),
    );

    if (!discount) {
      throw new Error(
        "The existing Shopify free shipping discount was not found.",
      );
    }

    if (!isShopifyFreeShippingDiscount(discount)) {
      throw new Error("Link an existing Shopify free shipping discount.");
    }

    return updateDiscountSyncForShop(campaignId, shopId, {
      shopifyDiscountId: discount.id,
      discountCode: discount.code || null,
      method: getDiscountSyncMethodForShopifyDiscount(discount),
      syncStartEnd: false,
      startsAt,
      endsAt,
      lastSyncedAt: new Date(),
      title: discount.title || values.freeShippingDiscountTitle,
      valueType: "FREE_SHIPPING",
      value: null,
      minimumSubtotal: thresholdAmount.toFixed(2),
      appliesOncePerCustomer: false,
      showCodeOnStorefront:
        values.freeShippingShowDiscountCode && Boolean(discount.code),
    });
  }

  const existingCampaign = await getCampaignForShop(campaignId, shopId);
  const existingAutomaticDiscountId =
    existingCampaign?.discountSync?.method === "AUTOMATIC" &&
    existingCampaign.discountSync.shopifyDiscountId?.startsWith(
      "gid://shopify/DiscountAutomaticNode/",
    )
      ? existingCampaign.discountSync.shopifyDiscountId
      : null;

  if (existingAutomaticDiscountId) {
    try {
      discount = await updateAutomaticFreeShippingDiscount(
        admin,
        existingAutomaticDiscountId,
        {
          title: values.freeShippingDiscountTitle,
          startsAt,
          endsAt,
          minimumSubtotal: thresholdAmount,
        },
      );
    } catch (error) {
      if (!isMissingShopifyDiscountError(error)) {
        throw error;
      }
    }
  }

  if (!discount) {
    discount = await createAutomaticFreeShippingDiscount(admin, {
      title: values.freeShippingDiscountTitle,
      startsAt,
      endsAt,
      minimumSubtotal: thresholdAmount,
    });
  }

  return updateDiscountSyncForShop(campaignId, shopId, {
    shopifyDiscountId: discount.id,
    discountCode: null,
    method: "AUTOMATIC",
    syncStartEnd: false,
    startsAt,
    endsAt,
    lastSyncedAt: new Date(),
    title: values.freeShippingDiscountTitle,
    valueType: "FREE_SHIPPING",
    value: null,
    minimumSubtotal: thresholdAmount.toFixed(2),
    appliesOncePerCustomer: false,
    showCodeOnStorefront: false,
  });
}

export function isShopifyFreeShippingDiscount(discount: ShopifyDiscountSummary) {
  return /FreeShipping/i.test(discount.type);
}

export function getDiscountSyncMethodForShopifyDiscount(
  discount: ShopifyDiscountSummary,
) {
  return /Automatic/i.test(discount.type) ? "AUTOMATIC" : "CODE";
}

export function isMissingShopifyDiscountError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return /not found|could not be found|does not exist|invalid id/i.test(
    message,
  );
}

export function normalizeShopifyDiscountReference(value: string) {
  const trimmed = value.trim();

  return trimmed.startsWith("gid://shopify/Discount")
    ? trimmed
    : trimmed.toUpperCase();
}

export async function saveDiscountForCampaign({
  campaignId,
  shopId,
  discount,
  syncStartEnd,
}: {
  campaignId: string;
  shopId: string;
  discount: ShopifyDiscountSummary;
  syncStartEnd: boolean;
}) {
  const syncedDates = syncCampaignDatesFromDiscount({ syncStartEnd }, discount);

  return updateDiscountSyncForShop(campaignId, shopId, {
    shopifyDiscountId: discount.id,
    discountCode: discount.code,
    method: "CODE",
    syncStartEnd,
    startsAt: syncedDates?.startsAt,
    endsAt: syncedDates?.endsAt,
    lastSyncedAt: syncedDates?.lastSyncedAt ?? null,
  });
}

export function toDiscountSettingsValues(
  settings: {
    shopifyDiscountId?: string | null;
    discountCode?: string | null;
    method?: string | null;
    syncStartEnd: boolean;
    title?: string | null;
    valueType?: string | null;
    value?: { toString(): string } | string | number | null;
    minimumSubtotal?: { toString(): string } | string | number | null;
    appliesOncePerCustomer?: boolean | null;
    uniqueCodePrefix?: string | null;
    uniqueCodeExpiresMinutes?: number | null;
    uniqueCodeAutoApply?: boolean | null;
    uniqueCodeReassignExpired?: boolean | null;
    uniqueCodeStartsAt?: Date | string | null;
    uniqueCodeEndsAt?: Date | string | null;
  } | null,
): DiscountSettingsValues {
  if (!settings) return defaultDiscountSettingsValues;

  if (settings.method === "UNIQUE_CODE") {
    return {
      ...defaultDiscountSettingsValues,
      mode: "UNIQUE_CODES",
      existingCodeOrId: "",
      discountCode: "",
      shopifyDiscountId: "",
      syncStartEnd: settings.syncStartEnd,
      title: settings.title ?? "",
      valueType: toDiscountValueType(settings.valueType),
      value: settings.value?.toString() ?? defaultDiscountSettingsValues.value,
      startsAt: toDateTimeLocalValue(settings.uniqueCodeStartsAt ?? null),
      endsAt: toDateTimeLocalValue(settings.uniqueCodeEndsAt ?? null),
      minimumSubtotal: settings.minimumSubtotal?.toString() ?? "",
      appliesOncePerCustomer: settings.appliesOncePerCustomer ?? false,
      uniqueCodePrefix:
        settings.uniqueCodePrefix ??
        defaultDiscountSettingsValues.uniqueCodePrefix,
      uniqueCodeExpiresMinutes:
        settings.uniqueCodeExpiresMinutes?.toString() ??
        defaultDiscountSettingsValues.uniqueCodeExpiresMinutes,
      uniqueCodeAutoApply:
        settings.uniqueCodeAutoApply ??
        defaultDiscountSettingsValues.uniqueCodeAutoApply,
      uniqueCodeReassignExpired:
        settings.uniqueCodeReassignExpired ??
        defaultDiscountSettingsValues.uniqueCodeReassignExpired,
    };
  }

  return {
    ...defaultDiscountSettingsValues,
    mode: "LINK_EXISTING",
    existingCodeOrId: settings.discountCode ?? settings.shopifyDiscountId ?? "",
    discountCode: settings.discountCode ?? "",
    shopifyDiscountId: settings.shopifyDiscountId ?? "",
    syncStartEnd: settings.syncStartEnd,
  };
}

export function toDiscountValueType(value: string | null | undefined) {
  if (
    value === "PERCENTAGE" ||
    value === "FIXED_AMOUNT" ||
    value === "FREE_SHIPPING"
  ) {
    return value;
  }

  return defaultDiscountSettingsValues.valueType;
}

export function toLowStockSettingsValues(
  settings: {
    threshold: number;
    showExactQuantity: boolean;
    fallbackMessage?: string | null;
  } | null,
): LowStockSettingsValues {
  if (!settings) return defaultLowStockSettingsValues;

  return {
    threshold: String(settings.threshold),
    showExactQuantity: settings.showExactQuantity,
    fallbackMessage:
      settings.fallbackMessage ?? defaultLowStockSettingsValues.fallbackMessage,
  };
}

export function toBadgeSettingsValues(
  settings: {
    badgeText: string;
    badgeShape: string;
    badgePosition: string;
  } | null,
): BadgeSettingsValues {
  if (!settings) return defaultBadgeSettingsValues;

  return {
    badgeText: settings.badgeText || defaultBadgeSettingsValues.badgeText,
    badgeShape: toBadgeShape(settings.badgeShape),
    badgePosition: toBadgePosition(settings.badgePosition),
  };
}

export function isFreeShippingProgressStyle(
  value: string,
): value is FreeShippingSettingsValues["progressStyle"] {
  return value === "BAR" || value === "COMPACT" || value === "CIRCULAR";
}

export function toDeliveryCutoffSettingsValues(
  settings: {
    cutoffHour: number;
    cutoffMinute: number;
    processingDays: number;
    minDeliveryDays: number;
    maxDeliveryDays: number;
    workingDays: unknown;
    holidays: unknown;
    countryRules: unknown;
    afterCutoffBehavior?: string | null;
  } | null,
  campaignTimezone: string,
): DeliveryCutoffSettingsValues {
  if (!settings) {
    return {
      ...defaultDeliveryCutoffSettingsValues,
      timezone:
        campaignTimezone || defaultDeliveryCutoffSettingsValues.timezone,
    };
  }

  return {
    afterCutoffBehavior: toAfterCutoffBehavior(settings.afterCutoffBehavior),
    countryRulesJson: stringifyJsonSetting(settings.countryRules, "{}"),
    cutoffHour: String(settings.cutoffHour),
    cutoffMinute: String(settings.cutoffMinute),
    holidaysJson: stringifyJsonSetting(settings.holidays, "[]"),
    maxDeliveryDays: String(settings.maxDeliveryDays),
    minDeliveryDays: String(settings.minDeliveryDays),
    processingDays: String(settings.processingDays),
    timezone: campaignTimezone || defaultDeliveryCutoffSettingsValues.timezone,
    workingDaysJson: stringifyJsonSetting(settings.workingDays, "[1,2,3,4,5]"),
  };
}

export function stringifyJsonSetting(value: unknown, fallback: string) {
  return value ? JSON.stringify(value, null, 2) : fallback;
}

