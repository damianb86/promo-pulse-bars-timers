import {
  CartRescueReason,
  CampaignStatus,
  CampaignType,
  Prisma,
  TimerExpiredBehavior,
  TimerMode,
  TimerResetBehavior,
  type CampaignGoal,
  type CampaignTemplate,
  type CampaignTemplateCategory,
  type PlacementType,
} from "@prisma/client";

import prisma from "../../db.server";
import {
  behaviorSegmentOptions,
  hasBehaviorTargetingRules,
  normalizeBehaviorTargetingRules,
  type BehaviorSegmentKey,
  type BehaviorTargetingRules,
} from "../../types/behavior-targeting";
import { defaultBadgeSettingsValues } from "../../types/badge";
import type { CampaignAiInput, CampaignAiShape } from "../../types/ai-campaign";
import {
  defaultCampaignDesignValues,
  designLayoutOptions,
  findCampaignDesignTemplate,
  type CampaignDesignValues,
} from "../../types/campaign-design";
import {
  getDefaultPlacementForCampaignType,
  type CampaignGoalValue,
  type CampaignTypeValue,
  type PlacementTypeValue,
} from "../../types/campaign-options";
import {
  defaultCampaignFormValues,
  type CampaignFormValues,
} from "../../types/campaign-form";
import { defaultDeliveryCutoffSettingsValues } from "../../types/delivery-cutoff";
import { defaultFreeShippingSettingsValues } from "../../types/free-shipping";
import { defaultLowStockSettingsValues } from "../../types/low-stock";
import { defaultEnabledStorefrontLocales } from "../../types/localization";
import {
  buildDefaultCampaignTranslations,
  normalizeStorefrontLocale,
} from "../../utils/campaign-localization";
import { toCampaignDesignWriteData } from "../../models/campaign.server";
import {
  buildSystemCampaignTemplates,
  templateMarkets,
} from "./systemTemplates.js";

export type TemplateLibraryFilters = {
  category?: string;
  goal?: string;
  country?: string;
  locale?: string;
  eventName?: string;
  query?: string;
  sort?: string;
  type?: string;
};

export type TemplateFilterOptions = {
  countries: string[];
  events: string[];
  goals: string[];
  locales: string[];
  types: string[];
};

export type TemplateLibraryRow = CampaignTemplate & {
  actionUrl: string;
  aiUrl: string;
};

type CampaignTemplateSource = Prisma.CampaignGetPayload<{
  include: {
    badgeSettings: true;
    deliveryCutoffSettings: true;
    design: true;
    freeShippingSettings: true;
    lowStockSettings: true;
    placements: true;
    targeting: true;
    timerSettings: true;
    translations: true;
  };
}>;

type CampaignTemplateSourceTranslation =
  CampaignTemplateSource["translations"][number];

export class TemplateLibraryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateLibraryError";
  }
}

export function getSystemCampaignTemplateInputs() {
  return buildSystemCampaignTemplates();
}

export async function syncSystemCampaignTemplates() {
  const templates = getSystemCampaignTemplateInputs();
  const templateKeys = templates.map((template) => template.key);

  await prisma.campaignTemplate.deleteMany({
    where: {
      isSystem: true,
      key: { notIn: templateKeys },
    },
  });

  for (const template of templates) {
    await prisma.campaignTemplate.upsert({
      where: { key: template.key },
      update: template,
      create: template,
    });
  }

  return templates.length;
}

export async function ensureSystemCampaignTemplates() {
  return syncSystemCampaignTemplates();
}

export async function listTemplateLibrary(
  shopId: string,
  filters: TemplateLibraryFilters = {},
) {
  const normalized = normalizeTemplateFilters(filters);
  const templates = await prisma.campaignTemplate.findMany({
    where: scopeTemplateWhere(shopId, buildTemplateWhere(normalized)),
    orderBy: getTemplateOrderBy(normalized.sort),
  });

  return templates.map((template) => ({
    ...template,
    actionUrl: `/app/templates?templateKey=${encodeURIComponent(template.key)}`,
    aiUrl: `/app/campaigns/new?templateKey=${encodeURIComponent(
      template.key,
    )}&aiFromTemplate=1`,
  }));
}

export async function getTemplateFilterOptions(
  shopId: string,
): Promise<TemplateFilterOptions> {
  const templates = await prisma.campaignTemplate.findMany({
    where: scopeTemplateWhere(shopId),
    select: {
      countryCode: true,
      eventName: true,
      goal: true,
      locale: true,
      type: true,
    },
    orderBy: [{ eventName: "asc" }],
  });

  return {
    countries: uniqueSorted(
      templates.map((template) => template.countryCode).filter(Boolean),
    ),
    events: uniqueSorted(templates.map((template) => template.eventName)),
    goals: uniqueSorted(templates.map((template) => template.goal)),
    locales: uniqueSorted(templates.map((template) => template.locale)),
    types: uniqueSorted(templates.map((template) => template.type)),
  };
}

export async function getCampaignTemplateByKey(key: string, shopId?: string) {
  return prisma.campaignTemplate.findFirst({
    where: {
      key,
      ...(shopId
        ? { OR: [{ isSystem: true }, { shopId }] }
        : { isSystem: true }),
    },
  });
}

export async function listTemplateSourceCampaigns(shopId: string) {
  const campaigns = await prisma.campaign.findMany({
    where: { shopId },
    select: {
      id: true,
      name: true,
      status: true,
      type: true,
      updatedAt: true,
      placements: {
        select: { placementType: true },
        where: { enabled: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 24,
  });

  return campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    placementTypes: campaign.placements.map(
      (placement) => placement.placementType,
    ),
    status: campaign.status,
    type: campaign.type,
    updatedAt: campaign.updatedAt,
  }));
}

export async function createTemplateFromCampaign(
  shopId: string,
  campaignId: string,
  options: { name?: string } = {},
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId },
    include: {
      badgeSettings: true,
      deliveryCutoffSettings: true,
      design: true,
      freeShippingSettings: true,
      lowStockSettings: true,
      placements: true,
      targeting: true,
      timerSettings: true,
      translations: true,
    },
  });

  if (!campaign) {
    throw new TemplateLibraryError("Campaign was not found.");
  }

  const name = options.name?.trim() || campaign.name;
  const translation =
    campaign.translations.find((candidate) => candidate.locale === "en") ??
    campaign.translations[0];

  return prisma.campaignTemplate.create({
    data: {
      shopId,
      key: buildCustomTemplateKey(shopId, name),
      category: readTemplateCategory(campaign.goal, campaign.type),
      countryCode: "US",
      locale: "en",
      eventName: name,
      goal: campaign.goal,
      type: campaign.type,
      defaultTexts: buildTemplateTextsFromCampaign(campaign, translation),
      defaultDesign: buildTemplateDesignFromCampaign(campaign.design),
      defaultSettings: buildTemplateSettingsFromCampaign(campaign),
      isSystem: false,
    },
    select: { key: true },
  });
}

export async function createDraftCampaignFromTemplate(
  shopId: string,
  templateKey: string,
) {
  const template = await getCampaignTemplateByKey(templateKey, shopId);

  if (!template) {
    throw new TemplateLibraryError("Template was not found.");
  }

  const texts = readTemplateTexts(template.defaultTexts);
  const settings = readTemplateSettings(template.defaultSettings);
  const design = readTemplateDesign(template.defaultDesign);
  const placementType = readPlacementType(
    settings.recommendedPlacement,
    template.type,
  );
  const placementTypes = resolveTemplatePlacements(settings, placementType);
  const behaviorRulesValue =
    settings.behaviorRules && hasBehaviorTargetingRules(settings.behaviorRules)
      ? (settings.behaviorRules as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;

  return prisma.campaign.create({
    data: {
      shopId,
      name: `${template.eventName} ${formatCampaignType(template.type)}`,
      status: CampaignStatus.DRAFT,
      type: template.type,
      goal: template.goal,
      startsAt: null,
      endsAt: null,
      timezone: settings.timezone ?? "UTC",
      placements: {
        create: placementTypes.map((type) => ({
          placementType: type,
          enabled: true,
        })),
      },
      targeting: {
        create: {
          countries: template.countryCode ? [template.countryCode] : [],
          markets: [],
          locales: template.locale ? [template.locale] : [],
          productIds: [],
          collectionIds: [],
          productTags: settings.productTags ?? [],
          customerTags: [],
          urlContains: settings.urlContains ?? [],
          utmSources: settings.utmSources ?? [],
          devices: settings.devices ?? [],
          excludeProductIds: [],
          excludeCollectionIds: [],
          behaviorRules: behaviorRulesValue,
        },
      },
      translations: {
        create: buildTemplateTranslations(template, texts),
      },
      design: {
        create: toCampaignDesignWriteData(design),
      },
      ...(shouldCreateTimerSettings(template.type)
        ? {
            timerSettings: {
              create: {
                mode: TimerMode.FIXED_DATE,
                durationMinutes: settings.suggestedDurationHours
                  ? Number(settings.suggestedDurationHours) * 60
                  : null,
                recurringDays: [],
                resetBehavior: TimerResetBehavior.NEVER,
                expiredBehavior: TimerExpiredBehavior.UNPUBLISH_TIMER,
              },
            },
          }
        : {}),
      ...(template.type === CampaignType.CART_TIMER
        ? {
            cartRescueSettings: {
              create: {
                rescueReason: CartRescueReason.CART_RESERVED,
                showButton: true,
                showTimer: true,
              },
            },
          }
        : {}),
      ...(template.type === CampaignType.FREE_SHIPPING_GOAL
        ? {
            freeShippingSettings: {
              create: {
                thresholdAmount:
                  settings.thresholdAmount ??
                  defaultFreeShippingSettingsValues.thresholdAmount,
                currencyCode:
                  settings.currencyCode ??
                  defaultFreeShippingSettingsValues.currencyCode,
                includeDiscountedSubtotal:
                  defaultFreeShippingSettingsValues.includeDiscountedSubtotal,
                emptyCartMessage:
                  texts.freeShippingEmptyText ??
                  defaultFreeShippingSettingsValues.emptyCartMessage,
                successMessage:
                  texts.freeShippingSuccessText ??
                  defaultFreeShippingSettingsValues.successMessage,
                progressStyle: defaultFreeShippingSettingsValues.progressStyle,
              },
            },
          }
        : {}),
      ...(template.type === CampaignType.DELIVERY_CUTOFF
        ? {
            deliveryCutoffSettings: {
              create: {
                cutoffHour: Number(
                  settings.cutoffHour ??
                    defaultDeliveryCutoffSettingsValues.cutoffHour,
                ),
                cutoffMinute: Number(
                  settings.cutoffMinute ??
                    defaultDeliveryCutoffSettingsValues.cutoffMinute,
                ),
                processingDays: Number(
                  settings.processingDays ??
                    defaultDeliveryCutoffSettingsValues.processingDays,
                ),
                minDeliveryDays: Number(
                  settings.minDeliveryDays ??
                    defaultDeliveryCutoffSettingsValues.minDeliveryDays,
                ),
                maxDeliveryDays: Number(
                  settings.maxDeliveryDays ??
                    defaultDeliveryCutoffSettingsValues.maxDeliveryDays,
                ),
                workingDays: [1, 2, 3, 4, 5],
                holidays: [],
                countryRules: {},
                afterCutoffBehavior:
                  defaultDeliveryCutoffSettingsValues.afterCutoffBehavior,
              },
            },
          }
        : {}),
      ...(template.type === CampaignType.LOW_STOCK
        ? {
            lowStockSettings: {
              create: {
                threshold: Number(defaultLowStockSettingsValues.threshold),
                showExactQuantity:
                  defaultLowStockSettingsValues.showExactQuantity,
                fallbackMessage:
                  texts.lowStockText ??
                  defaultLowStockSettingsValues.fallbackMessage,
              },
            },
          }
        : {}),
      ...(template.type === CampaignType.PRODUCT_BADGE
        ? {
            badgeSettings: {
              create: {
                badgeText:
                  texts.badgeText ?? defaultBadgeSettingsValues.badgeText,
                badgeShape: readBadgeShape(settings.badgeShape),
                badgePosition: readBadgePosition(settings.badgePosition),
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });
}

export function buildCampaignFormDefaultsFromTemplate(
  template: CampaignTemplate,
): CampaignFormValues {
  const texts = readTemplateTexts(template.defaultTexts);
  const settings = readTemplateSettings(template.defaultSettings);
  const placementType = readPlacementType(
    settings.recommendedPlacement,
    template.type,
  );

  return {
    ...defaultCampaignFormValues,
    goal: toEditableCampaignGoal(template.goal),
    type: template.type as CampaignTypeValue,
    name: `${template.eventName} ${formatCampaignType(template.type)}`,
    startsAt: "",
    endsAt: "",
    timezone: settings.timezone ?? "UTC",
    status: "DRAFT" as const,
    placementType: placementType as PlacementTypeValue,
    placementTypes: [placementType as PlacementTypeValue],
    headline: texts.headline ?? template.eventName,
    subheadline: texts.subheadline ?? "",
    ctaText: texts.ctaText ?? "",
    ctaUrl: texts.ctaUrl ?? "/collections/all",
    ...(template.type === "CART_TIMER"
      ? {
          cartRescueReason: "CART_RESERVED" as const,
          cartRescueShowButton: true,
          cartRescueShowTimer: true,
          cartTimerDurationMinutes: String(
            (settings.suggestedDurationHours ?? 2) * 60,
          ),
          cartTimerResetBehavior: "ON_SESSION_END" as const,
        }
      : {}),
    ...(template.type === "FREE_SHIPPING_GOAL"
      ? {
          freeShippingAutoDiscount: true,
          freeShippingDiscountCode: "",
          freeShippingExistingDiscount: "",
          freeShippingDiscountTitle: `${template.eventName} free shipping`,
        }
      : {}),
  };
}

export function buildCampaignAiInputFromTemplate(
  template: CampaignTemplate,
  locales: readonly string[] = defaultEnabledStorefrontLocales,
): CampaignAiInput {
  const texts = readTemplateTexts(template.defaultTexts);
  const settings = readTemplateSettings(template.defaultSettings);

  return {
    objective: toEditableCampaignGoal(template.goal),
    campaignNameHint: `${template.eventName} ${formatCampaignType(template.type)}`,
    campaignShape: readCampaignShape(template.type),
    goalAnswers: {},
    productContext: settings.productContext ?? "selected products",
    eventName: template.eventName,
    countryCode: template.countryCode ?? "",
    locale: normalizeTemplateLocale(template.locale),
    brandTone: readBrandTone(template.category),
    knownOffer: settings.knownOffer ?? "",
    quickStarts: [],
    merchantNotes: "",
    followUpAnswers: {},
    ctaUrl: texts.ctaUrl ?? "/collections/all",
    locales: [...locales],
    generateVisualAssets: false,
  };
}

export function normalizeTemplateLocale(locale: string | null | undefined) {
  const normalized = normalizeStorefrontLocale(locale ?? "en");

  return normalized ?? "en";
}

export function getTemplateLocaleFallbacks(locale: string | null | undefined) {
  const normalized = normalizeTemplateLocale(locale);

  return normalized === "en" ? ["en"] : [normalized, "en"];
}

function buildTemplateWhere(filters: TemplateLibraryFilters) {
  const where: Prisma.CampaignTemplateWhereInput = {};
  const and: Prisma.CampaignTemplateWhereInput[] = [];

  if (filters.category) {
    where.category = filters.category as CampaignTemplateCategory;
  }

  if (filters.goal) {
    where.goal = filters.goal as CampaignGoal;
  }

  if (filters.type) {
    where.type = filters.type as CampaignType;
  }

  if (filters.country) {
    and.push({
      OR: [{ countryCode: filters.country }, { countryCode: null }],
    });
  }

  if (filters.locale) {
    where.locale = { in: getTemplateLocaleFallbacks(filters.locale) };
  }

  if (filters.eventName) {
    where.eventName = { contains: filters.eventName };
  }

  if (filters.query) {
    and.push({
      OR: [
        { eventName: { contains: filters.query } },
        { key: { contains: filters.query } },
      ],
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

function normalizeTemplateFilters(filters: TemplateLibraryFilters) {
  return {
    category: filters.category?.trim() || "",
    goal: filters.goal?.trim() || "",
    country: filters.country?.trim().toUpperCase() || "",
    locale: filters.locale?.trim() || "",
    eventName: filters.eventName?.trim() || "",
    query: filters.query?.trim() || "",
    sort: filters.sort?.trim() || "",
    type: filters.type?.trim() || "",
  };
}

function scopeTemplateWhere(
  shopId: string,
  where: Prisma.CampaignTemplateWhereInput = {},
): Prisma.CampaignTemplateWhereInput {
  return {
    AND: [where, { OR: [{ isSystem: true }, { shopId }] }],
  };
}

function getTemplateOrderBy(sort: string | undefined) {
  if (sort === "name") {
    return [{ eventName: "asc" as const }, { category: "asc" as const }];
  }

  if (sort === "newest") {
    return [{ updatedAt: "desc" as const }, { eventName: "asc" as const }];
  }

  return [
    { isSystem: "asc" as const },
    { category: "asc" as const },
    { eventName: "asc" as const },
    { countryCode: "asc" as const },
    { locale: "asc" as const },
  ];
}

function buildTemplateTextsFromCampaign(
  campaign: CampaignTemplateSource,
  translation: CampaignTemplateSourceTranslation | undefined,
) {
  return {
    headline: translation?.headline || campaign?.name || "Campaign template",
    subheadline: translation?.subheadline || "",
    ctaText: translation?.ctaText || "Shop now",
    ctaUrl: translation?.ctaUrl || "/collections/all",
    expiredText: translation?.expiredText || "This campaign has ended.",
    freeShippingEmptyText:
      translation?.freeShippingEmptyText ||
      campaign?.freeShippingSettings?.emptyCartMessage ||
      "Add items to unlock free shipping.",
    freeShippingProgressText:
      translation?.freeShippingProgressText ||
      "You're {{remaining_amount}} away from free shipping.",
    freeShippingSuccessText:
      translation?.freeShippingSuccessText ||
      campaign?.freeShippingSettings?.successMessage ||
      "You've unlocked free shipping.",
    deliveryBeforeCutoffText:
      translation?.deliveryBeforeCutoffText ||
      "Order before {{cutoff}} for faster delivery.",
    deliveryAfterCutoffText:
      translation?.deliveryAfterCutoffText ||
      "Orders now ship in the next delivery window.",
    lowStockText:
      translation?.lowStockText ||
      campaign?.lowStockSettings?.fallbackMessage ||
      "Only {{quantity}} left in stock.",
    badgeText:
      translation?.badgeText ||
      campaign?.badgeSettings?.badgeText ||
      campaign?.name ||
      "Promo",
  };
}

function buildTemplateDesignFromCampaign(
  design: CampaignTemplateSource["design"],
) {
  if (!design) return defaultCampaignDesignValues;

  const templateDesign = { ...design };
  delete (templateDesign as { campaignId?: string }).campaignId;

  return templateDesign;
}

function buildTemplateSettingsFromCampaign(campaign: CampaignTemplateSource) {
  const enabledPlacements = campaign.placements
    .filter((candidate) => candidate.enabled)
    .map((candidate) => candidate.placementType);
  const targeting = campaign.targeting;
  const behaviorRules = hasBehaviorTargetingRules(targeting?.behaviorRules)
    ? normalizeBehaviorTargetingRules(targeting?.behaviorRules)
    : undefined;

  return {
    badgePosition: campaign.badgeSettings?.badgePosition,
    badgeShape: campaign.badgeSettings?.badgeShape,
    behaviorRules,
    currencyCode: campaign.freeShippingSettings?.currencyCode,
    cutoffHour: campaign.deliveryCutoffSettings?.cutoffHour,
    cutoffMinute: campaign.deliveryCutoffSettings?.cutoffMinute,
    description: buildCampaignTemplateDescription(campaign, behaviorRules),
    devices: jsonStringArray(targeting?.devices),
    knownOffer: campaign.name,
    maxDeliveryDays: campaign.deliveryCutoffSettings?.maxDeliveryDays,
    minDeliveryDays: campaign.deliveryCutoffSettings?.minDeliveryDays,
    placements: enabledPlacements,
    processingDays: campaign.deliveryCutoffSettings?.processingDays,
    productContext: "settings copied from an existing campaign",
    productTags: jsonStringArray(targeting?.productTags),
    recommendedPlacement:
      enabledPlacements[0] ?? getDefaultPlacementForCampaignType(campaign.type),
    suggestedDurationHours: campaign.timerSettings?.durationMinutes
      ? Math.max(1, Math.round(campaign.timerSettings.durationMinutes / 60))
      : 48,
    thresholdAmount: campaign.freeShippingSettings?.thresholdAmount?.toString(),
    timezone: campaign.timezone,
    urlContains: jsonStringArray(targeting?.urlContains),
    utmSources: jsonStringArray(targeting?.utmSources),
  };
}

const behaviorSegmentLabels: Record<BehaviorSegmentKey, string> =
  Object.fromEntries(
    behaviorSegmentOptions.map((option) => [option.key, option.label]),
  ) as Record<BehaviorSegmentKey, string>;

/**
 * Human-readable segment labels for a template's behavior rules, used to explain
 * the bundled targeting on the template card. Returns an empty array when the
 * template has no behavior targeting.
 */
export function summarizeBehaviorSegments(behaviorRules: unknown): string[] {
  if (!hasBehaviorTargetingRules(behaviorRules)) return [];

  return normalizeBehaviorTargetingRules(behaviorRules).segments.map(
    (segment) => behaviorSegmentLabels[segment] ?? segment,
  );
}

function buildCampaignTemplateDescription(
  campaign: CampaignTemplateSource,
  behaviorRules: BehaviorTargetingRules | undefined,
) {
  const parts = [
    `${formatCampaignType(campaign.type)} saved from "${campaign.name}".`,
  ];

  if (behaviorRules && behaviorRules.segments.length > 0) {
    parts.push(
      `Includes behavior targeting for ${behaviorRules.segments
        .map((segment) => behaviorSegmentLabels[segment] ?? segment)
        .join(", ")}.`,
    );
  }

  return parts.join(" ");
}

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Remove a shop's own custom template. System templates and other shops'
 * templates are never matched, so they cannot be deleted through this path.
 */
export async function deleteCustomTemplate(shopId: string, key: string) {
  const result = await prisma.campaignTemplate.deleteMany({
    where: { key, shopId, isSystem: false },
  });

  if (result.count === 0) {
    throw new TemplateLibraryError(
      "Custom template was not found or cannot be deleted.",
    );
  }
}

function readTemplateCategory(
  goal: CampaignGoal,
  type: CampaignType,
): CampaignTemplateCategory {
  if (goal === "FREE_SHIPPING" || type === "FREE_SHIPPING_GOAL") {
    return "FREE_SHIPPING";
  }

  if (goal === "CART_RESCUE" || type === "CART_TIMER") {
    return "CART_RECOVERY";
  }

  if (goal === "PRODUCT_BADGE" || goal === "LAUNCH" || goal === "PREORDER") {
    return "PRODUCT_LAUNCH";
  }

  if (goal === "FLASH_SALE" || goal === "LOW_STOCK_URGENCY") {
    return "FLASH_SALE";
  }

  return "SEASONAL";
}

function buildCustomTemplateKey(shopId: string, name: string) {
  const slug = slugify(name) || "campaign-template";
  const shopPart = shopId.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "shop";

  return `custom-${shopPart}-${slug}-${Date.now().toString(36)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildTemplateTranslations(
  template: CampaignTemplate,
  texts: TemplateTexts,
) {
  return buildDefaultCampaignTranslations({
    goal: template.goal,
    type: template.type,
    overrides: {
      en: texts,
      [normalizeTemplateLocale(template.locale)]: texts,
    },
  });
}

function readTemplateTexts(value: Prisma.JsonValue): TemplateTexts {
  const input = readObject(value);

  return {
    headline: readString(input.headline),
    subheadline: readString(input.subheadline),
    ctaText: readString(input.ctaText),
    ctaUrl: readString(input.ctaUrl),
    expiredText: readString(input.expiredText),
    freeShippingEmptyText: readString(input.freeShippingEmptyText),
    freeShippingProgressText: readString(input.freeShippingProgressText),
    freeShippingSuccessText: readString(input.freeShippingSuccessText),
    deliveryBeforeCutoffText: readString(input.deliveryBeforeCutoffText),
    deliveryAfterCutoffText: readString(input.deliveryAfterCutoffText),
    lowStockText: readString(input.lowStockText),
    badgeText: readString(input.badgeText),
  };
}

function readTemplateDesign(value: Prisma.JsonValue) {
  const input = readObject(value);
  const templateKey = readString(input.templateKey) || "clean-minimal";
  const baseDesign = findCampaignDesignTemplate(templateKey);
  const design: CampaignDesignValues = {
    ...defaultCampaignDesignValues,
    templateKey,
    layout:
      readEnum(
        input.layout,
        designLayoutOptions.map((option) => option.value),
      ) ?? defaultCampaignDesignValues.layout,
    backgroundType:
      readEnum(input.backgroundType, ["SOLID", "GRADIENT", "IMAGE"]) ??
      defaultCampaignDesignValues.backgroundType,
    backgroundColor:
      readString(input.backgroundColor) ||
      defaultCampaignDesignValues.backgroundColor,
    backgroundImageUrl: readString(input.backgroundImageUrl),
    backgroundImageSize:
      readEnum(input.backgroundImageSize, [
        "COVER",
        "CONTAIN",
        "AUTO",
        "STRETCH",
      ]) ?? defaultCampaignDesignValues.backgroundImageSize,
    backgroundImagePosition:
      readEnum(input.backgroundImagePosition, [
        "CENTER",
        "TOP",
        "BOTTOM",
        "LEFT",
        "RIGHT",
        "TOP_LEFT",
        "TOP_RIGHT",
        "BOTTOM_LEFT",
        "BOTTOM_RIGHT",
      ]) ?? defaultCampaignDesignValues.backgroundImagePosition,
    backgroundImageRepeat:
      readEnum(input.backgroundImageRepeat, [
        "NO_REPEAT",
        "REPEAT",
        "REPEAT_X",
        "REPEAT_Y",
      ]) ?? defaultCampaignDesignValues.backgroundImageRepeat,
    backgroundImageAttachment:
      readEnum(input.backgroundImageAttachment, ["SCROLL", "FIXED", "LOCAL"]) ??
      defaultCampaignDesignValues.backgroundImageAttachment,
    gradientStartColor:
      readString(input.gradientStartColor) ||
      defaultCampaignDesignValues.gradientStartColor,
    gradientEndColor:
      readString(input.gradientEndColor) ||
      defaultCampaignDesignValues.gradientEndColor,
    gradientAngle: readInteger(
      input.gradientAngle,
      defaultCampaignDesignValues.gradientAngle,
    ),
    textColor:
      readString(input.textColor) || defaultCampaignDesignValues.textColor,
    accentColor:
      readString(input.accentColor) || defaultCampaignDesignValues.accentColor,
    buttonColor:
      readString(input.buttonColor) || defaultCampaignDesignValues.buttonColor,
    buttonTextColor:
      readString(input.buttonTextColor) ||
      defaultCampaignDesignValues.buttonTextColor,
    closeButtonColor:
      readString(input.closeButtonColor) ||
      defaultCampaignDesignValues.closeButtonColor,
    fontSize: readInteger(input.fontSize, defaultCampaignDesignValues.fontSize),
    borderRadius: readInteger(
      input.borderRadius,
      defaultCampaignDesignValues.borderRadius,
    ),
    borderSize: readInteger(
      input.borderSize,
      defaultCampaignDesignValues.borderSize,
    ),
    borderColor:
      readString(input.borderColor) || defaultCampaignDesignValues.borderColor,
    fontFamily:
      readEnum(input.fontFamily, [
        "THEME",
        "SYSTEM",
        "SERIF",
        "ROUNDED",
        "MONO",
        "GEOMETRIC",
        "HUMANIST",
        "CONDENSED",
        "CASUAL",
      ]) ?? defaultCampaignDesignValues.fontFamily,
    titleFontSize: readInteger(
      input.titleFontSize,
      defaultCampaignDesignValues.titleFontSize,
    ),
    titleColor:
      readString(input.titleColor) || defaultCampaignDesignValues.titleColor,
    subheadingFontSize: readInteger(
      input.subheadingFontSize,
      defaultCampaignDesignValues.subheadingFontSize,
    ),
    subheadingColor:
      readString(input.subheadingColor) ||
      defaultCampaignDesignValues.subheadingColor,
    timerFontSize: readInteger(
      input.timerFontSize,
      defaultCampaignDesignValues.timerFontSize,
    ),
    timerColor:
      readString(input.timerColor) || defaultCampaignDesignValues.timerColor,
    legendFontSize: readInteger(
      input.legendFontSize,
      defaultCampaignDesignValues.legendFontSize,
    ),
    legendColor:
      readString(input.legendColor) || defaultCampaignDesignValues.legendColor,
    timerNumberFontSize: readInteger(
      input.timerNumberFontSize,
      defaultCampaignDesignValues.timerNumberFontSize,
    ),
    timerLabelFontSize: readInteger(
      input.timerLabelFontSize,
      defaultCampaignDesignValues.timerLabelFontSize,
    ),
    timerGap: readInteger(input.timerGap, defaultCampaignDesignValues.timerGap),
    timerUnitGap: readInteger(
      input.timerUnitGap,
      defaultCampaignDesignValues.timerUnitGap,
    ),
    timerPaddingBlock: readInteger(
      input.timerPaddingBlock,
      defaultCampaignDesignValues.timerPaddingBlock,
    ),
    timerPaddingInline: readInteger(
      input.timerPaddingInline,
      defaultCampaignDesignValues.timerPaddingInline,
    ),
    timerStyle:
      readEnum(input.timerStyle, ["PLAIN", "GROUPED", "BOXES"]) ??
      defaultCampaignDesignValues.timerStyle,
    timerFormat:
      readEnum(input.timerFormat, ["UNITS", "COLON"]) ??
      defaultCampaignDesignValues.timerFormat,
    timerShowLabels: readBoolean(
      input.timerShowLabels,
      defaultCampaignDesignValues.timerShowLabels,
    ),
    timerShowSeconds: readBoolean(
      input.timerShowSeconds,
      defaultCampaignDesignValues.timerShowSeconds,
    ),
    timerDaysLabel:
      readString(input.timerDaysLabel) ||
      defaultCampaignDesignValues.timerDaysLabel,
    timerHoursLabel:
      readString(input.timerHoursLabel) ||
      defaultCampaignDesignValues.timerHoursLabel,
    timerMinutesLabel:
      readString(input.timerMinutesLabel) ||
      defaultCampaignDesignValues.timerMinutesLabel,
    timerSecondsLabel:
      readString(input.timerSecondsLabel) ||
      defaultCampaignDesignValues.timerSecondsLabel,
    timerHideZeroDays: readBoolean(
      input.timerHideZeroDays,
      defaultCampaignDesignValues.timerHideZeroDays,
    ),
    timerSurfaceColor:
      readString(input.timerSurfaceColor) ||
      defaultCampaignDesignValues.timerSurfaceColor,
    timerSurfaceBorderColor:
      readString(input.timerSurfaceBorderColor) ||
      defaultCampaignDesignValues.timerSurfaceBorderColor,
    timerSurfaceBorderSize: readInteger(
      input.timerSurfaceBorderSize,
      defaultCampaignDesignValues.timerSurfaceBorderSize,
    ),
    timerSurfaceRadius: readInteger(
      input.timerSurfaceRadius,
      defaultCampaignDesignValues.timerSurfaceRadius,
    ),
    paddingBlock: readInteger(
      input.paddingBlock,
      defaultCampaignDesignValues.paddingBlock,
    ),
    paddingInline: readInteger(
      input.paddingInline,
      defaultCampaignDesignValues.paddingInline,
    ),
    contentGap: readInteger(
      input.contentGap,
      defaultCampaignDesignValues.contentGap,
    ),
    contentMaxWidth: readInteger(
      input.contentMaxWidth,
      defaultCampaignDesignValues.contentMaxWidth,
    ),
    fullWidth: readBoolean(
      input.fullWidth,
      defaultCampaignDesignValues.fullWidth,
    ),
    positionMode:
      readEnum(input.positionMode, ["FLOW", "OVERLAY"]) ??
      defaultCampaignDesignValues.positionMode,
    positionSticky: readBoolean(
      input.positionSticky,
      defaultCampaignDesignValues.positionSticky,
    ),
    positionStickyZIndex: readInteger(
      input.positionStickyZIndex,
      defaultCampaignDesignValues.positionStickyZIndex,
    ),
    entranceAnimation:
      readEnum(input.entranceAnimation, ["NONE", "FADE", "SLIDE", "POP"]) ??
      defaultCampaignDesignValues.entranceAnimation,
    exitAnimation:
      readEnum(input.exitAnimation, ["NONE", "FADE", "SLIDE", "POP"]) ??
      defaultCampaignDesignValues.exitAnimation,
    animationDurationMs: readInteger(
      input.animationDurationMs,
      defaultCampaignDesignValues.animationDurationMs,
    ),
    timerTickAnimation:
      readEnum(input.timerTickAnimation, ["NONE", "FADE", "FLIP", "PULSE"]) ??
      defaultCampaignDesignValues.timerTickAnimation,
    timerTickDurationMs: readInteger(
      input.timerTickDurationMs,
      defaultCampaignDesignValues.timerTickDurationMs,
    ),
    mobileEnabled: readBoolean(
      input.mobileEnabled,
      defaultCampaignDesignValues.mobileEnabled,
    ),
    customCss: readString(input.customCss),
    alignment:
      readEnum(input.alignment, ["LEFT", "CENTER", "RIGHT"]) ??
      defaultCampaignDesignValues.alignment,
    showCloseButton: readBoolean(
      input.showCloseButton,
      defaultCampaignDesignValues.showCloseButton,
    ),
    showButton: readBoolean(
      input.showButton,
      defaultCampaignDesignValues.showButton,
    ),
    showProgressBar: readBoolean(
      input.showProgressBar,
      defaultCampaignDesignValues.showProgressBar,
    ),
    showIcon: readBoolean(input.showIcon, defaultCampaignDesignValues.showIcon),
    icon:
      readEnum(input.icon, [
        "FIRE",
        "CLOCK",
        "TRUCK",
        "GIFT",
        "TAG",
        "CUSTOM",
        "NONE",
      ]) ?? defaultCampaignDesignValues.icon,
    iconSize: readInteger(input.iconSize, defaultCampaignDesignValues.iconSize),
    customIconUrl: readString(input.customIconUrl),
    iconBadgeMode:
      readEnum(input.iconBadgeMode, ["ICON", "BADGE"]) ??
      defaultCampaignDesignValues.iconBadgeMode,
    iconBadgeText:
      readString(input.iconBadgeText) ||
      defaultCampaignDesignValues.iconBadgeText,
    iconBadgeShowGlyph: readBoolean(
      input.iconBadgeShowGlyph,
      defaultCampaignDesignValues.iconBadgeShowGlyph,
    ),
    iconBadgeBackgroundColor:
      readString(input.iconBadgeBackgroundColor) ||
      defaultCampaignDesignValues.iconBadgeBackgroundColor,
    iconBadgeTextColor:
      readString(input.iconBadgeTextColor) ||
      defaultCampaignDesignValues.iconBadgeTextColor,
    iconBadgeFontSize: readInteger(
      input.iconBadgeFontSize,
      defaultCampaignDesignValues.iconBadgeFontSize,
    ),
    iconBadgeBorderRadius: readInteger(
      input.iconBadgeBorderRadius,
      defaultCampaignDesignValues.iconBadgeBorderRadius,
    ),
    splitDividerEnabled: readBoolean(
      input.splitDividerEnabled,
      defaultCampaignDesignValues.splitDividerEnabled,
    ),
    showDiscountCode: readBoolean(
      input.showDiscountCode,
      defaultCampaignDesignValues.showDiscountCode,
    ),
    showCopyCodeButton: readBoolean(
      input.showCopyCodeButton,
      defaultCampaignDesignValues.showCopyCodeButton,
    ),
    showApplyDiscountButton: readBoolean(
      input.showApplyDiscountButton,
      defaultCampaignDesignValues.showApplyDiscountButton,
    ),
    offerCodeLayout:
      readEnum(input.offerCodeLayout, ["INLINE", "STACKED", "COMPACT"]) ??
      defaultCampaignDesignValues.offerCodeLayout,
    offerCodeLabel:
      readString(input.offerCodeLabel) ||
      defaultCampaignDesignValues.offerCodeLabel,
    copyCodeLabel:
      readString(input.copyCodeLabel) ||
      defaultCampaignDesignValues.copyCodeLabel,
    copiedCodeLabel:
      readString(input.copiedCodeLabel) ||
      defaultCampaignDesignValues.copiedCodeLabel,
    applyDiscountLabel:
      readString(input.applyDiscountLabel) ||
      defaultCampaignDesignValues.applyDiscountLabel,
    appliedDiscountMessage:
      readString(input.appliedDiscountMessage) ||
      defaultCampaignDesignValues.appliedDiscountMessage,
    offerCodeTextColor:
      readString(input.offerCodeTextColor) ||
      defaultCampaignDesignValues.offerCodeTextColor,
    offerCodeBackgroundColor:
      readString(input.offerCodeBackgroundColor) ||
      defaultCampaignDesignValues.offerCodeBackgroundColor,
    offerCodeBorderColor:
      readString(input.offerCodeBorderColor) ||
      defaultCampaignDesignValues.offerCodeBorderColor,
    offerCodeFontSize: readInteger(
      input.offerCodeFontSize,
      defaultCampaignDesignValues.offerCodeFontSize,
    ),
    offerCodeBorderRadius: readInteger(
      input.offerCodeBorderRadius,
      defaultCampaignDesignValues.offerCodeBorderRadius,
    ),
    offerCodePaddingBlock: readInteger(
      input.offerCodePaddingBlock,
      defaultCampaignDesignValues.offerCodePaddingBlock,
    ),
    offerCodePaddingInline: readInteger(
      input.offerCodePaddingInline,
      defaultCampaignDesignValues.offerCodePaddingInline,
    ),
    offerCodeGap: readInteger(
      input.offerCodeGap,
      defaultCampaignDesignValues.offerCodeGap,
    ),
    copyButtonBackgroundColor:
      readString(input.copyButtonBackgroundColor) ||
      defaultCampaignDesignValues.copyButtonBackgroundColor,
    copyButtonTextColor:
      readString(input.copyButtonTextColor) ||
      defaultCampaignDesignValues.copyButtonTextColor,
    copyButtonBorderColor:
      readString(input.copyButtonBorderColor) ||
      defaultCampaignDesignValues.copyButtonBorderColor,
    copyButtonFontSize: readInteger(
      input.copyButtonFontSize,
      defaultCampaignDesignValues.copyButtonFontSize,
    ),
    copyButtonBorderRadius: readInteger(
      input.copyButtonBorderRadius,
      defaultCampaignDesignValues.copyButtonBorderRadius,
    ),
    applyButtonBackgroundColor:
      readString(input.applyButtonBackgroundColor) ||
      defaultCampaignDesignValues.applyButtonBackgroundColor,
    applyButtonTextColor:
      readString(input.applyButtonTextColor) ||
      defaultCampaignDesignValues.applyButtonTextColor,
    applyButtonBorderColor:
      readString(input.applyButtonBorderColor) ||
      defaultCampaignDesignValues.applyButtonBorderColor,
    applyButtonFontSize: readInteger(
      input.applyButtonFontSize,
      defaultCampaignDesignValues.applyButtonFontSize,
    ),
    applyButtonBorderRadius: readInteger(
      input.applyButtonBorderRadius,
      defaultCampaignDesignValues.applyButtonBorderRadius,
    ),
    offerCopyBehavior:
      readEnum(input.offerCopyBehavior, [
        "FEEDBACK",
        "HIDE_OFFER",
        "CLOSE_CAMPAIGN",
      ]) ?? defaultCampaignDesignValues.offerCopyBehavior,
    offerApplyBehavior:
      readEnum(input.offerApplyBehavior, [
        "SHOW_APPLIED",
        "HIDE_OFFER",
        "CLOSE_CAMPAIGN",
      ]) ?? defaultCampaignDesignValues.offerApplyBehavior,
  };

  for (const key of Object.keys(baseDesign) as Array<
    keyof CampaignDesignValues
  >) {
    const rawValue = input[key];

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      (design as Record<keyof CampaignDesignValues, unknown>)[key] =
        baseDesign[key];
    }
  }
  design.templateKey = templateKey;
  design.showIcon = design.icon !== "NONE";

  return design;
}

function readTemplateSettings(value: Prisma.JsonValue): TemplateSettings {
  const input = readObject(value);

  const behaviorRules = input.behaviorRules
    ? normalizeBehaviorTargetingRules(input.behaviorRules)
    : undefined;

  return {
    badgePosition: readString(input.badgePosition),
    badgeShape: readString(input.badgeShape),
    behaviorRules,
    currencyCode: readString(input.currencyCode),
    cutoffHour: readInteger(input.cutoffHour, 14),
    cutoffMinute: readInteger(input.cutoffMinute, 0),
    description: readString(input.description),
    devices: readStringArray(input.devices),
    highlights: readStringArray(input.highlights),
    knownOffer: readString(input.knownOffer),
    maxDeliveryDays: readInteger(input.maxDeliveryDays, 5),
    minDeliveryDays: readInteger(input.minDeliveryDays, 2),
    placements: readStringArray(input.placements),
    processingDays: readInteger(input.processingDays, 0),
    productContext: readString(input.productContext),
    productTags: readStringArray(input.productTags),
    recommendedPlacement: readString(input.recommendedPlacement),
    suggestedDurationHours: readInteger(input.suggestedDurationHours, 48),
    thresholdAmount: readString(input.thresholdAmount),
    timezone: readString(input.timezone),
    urlContains: readStringArray(input.urlContains),
    utmSources: readStringArray(input.utmSources),
  };
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function readPlacementType(
  value: string | null | undefined,
  type: CampaignType,
) {
  return (readEnum(value, [
    "TOP_BAR",
    "BOTTOM_BAR",
    "PRODUCT_PAGE",
    "PRODUCT_PAGE_BADGE",
    "COLLECTION_CARD",
    "CART_PAGE",
    "CART_DRAWER",
    "THANK_YOU_PAGE",
    "ORDER_STATUS_PAGE",
    "CUSTOM_SELECTOR",
  ]) ??
    (getDefaultPlacementForCampaignType(
      type,
    ) as PlacementTypeValue)) as PlacementType;
}

function resolveTemplatePlacements(
  settings: TemplateSettings,
  fallback: PlacementType,
): PlacementType[] {
  const fromSettings = (settings.placements ?? []).map((value) =>
    readPlacementType(value, CampaignType.COUNTDOWN_BAR),
  );
  const unique = Array.from(new Set(fromSettings.length ? fromSettings : []));

  return unique.length ? unique : [fallback];
}

function shouldCreateTimerSettings(type: CampaignType) {
  return (
    type === CampaignType.COUNTDOWN_BAR ||
    type === CampaignType.PRODUCT_TIMER ||
    type === CampaignType.CART_TIMER
  );
}

function readBrandTone(category: CampaignTemplateCategory) {
  if (category === "BFCM" || category === "FLASH_SALE") return "urgent";
  if (category === "HOLIDAY" || category === "SEASONAL") return "playful";
  if (category === "PRODUCT_LAUNCH") return "premium";
  return "minimal";
}

function readCampaignShape(type: CampaignType): CampaignAiShape {
  if (
    type === CampaignType.CART_TIMER ||
    type === CampaignType.FREE_SHIPPING_GOAL
  ) {
    return "cart";
  }

  if (type === CampaignType.PRODUCT_TIMER || type === CampaignType.LOW_STOCK) {
    return "product";
  }

  if (type === CampaignType.PRODUCT_BADGE) {
    return "merchandising";
  }

  return "sitewide";
}

function toEditableCampaignGoal(goal: CampaignGoal): CampaignGoalValue {
  if (
    goal === "FLASH_SALE" ||
    goal === "FREE_SHIPPING" ||
    goal === "CART_RESCUE" ||
    goal === "DELIVERY_CUTOFF" ||
    goal === "LOW_STOCK_URGENCY" ||
    goal === "PRODUCT_BADGE" ||
    goal === "ANNOUNCEMENT"
  ) {
    return goal;
  }

  return goal === "LAUNCH" || goal === "PREORDER"
    ? "PRODUCT_BADGE"
    : "FLASH_SALE";
}

function readObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  return typeof value === "string" ? value.trim() : "";
}

function readInteger(value: unknown, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[]) {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : null;
}

function readBadgeShape(value: unknown) {
  return (
    readEnum(value, ["PILL", "ROUNDED", "SQUARE"]) ??
    defaultBadgeSettingsValues.badgeShape
  );
}

function readBadgePosition(value: unknown) {
  return (
    readEnum(value, ["TOP_LEFT", "TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_RIGHT"]) ??
    defaultBadgeSettingsValues.badgePosition
  );
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort();
}

function formatCampaignType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type TemplateTexts = {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
  expiredText?: string;
  freeShippingEmptyText?: string;
  freeShippingProgressText?: string;
  freeShippingSuccessText?: string;
  deliveryBeforeCutoffText?: string;
  deliveryAfterCutoffText?: string;
  lowStockText?: string;
  badgeText?: string;
};

type TemplateSettings = {
  badgePosition?: string;
  badgeShape?: string;
  behaviorRules?: BehaviorTargetingRules;
  currencyCode?: string;
  cutoffHour?: number;
  cutoffMinute?: number;
  description?: string;
  devices?: string[];
  highlights?: string[];
  knownOffer?: string;
  maxDeliveryDays?: number;
  minDeliveryDays?: number;
  placements?: string[];
  processingDays?: number;
  productContext?: string;
  productTags?: string[];
  recommendedPlacement?: string;
  suggestedDurationHours?: number;
  thresholdAmount?: string;
  timezone?: string;
  urlContains?: string[];
  utmSources?: string[];
};

export const templateLibraryCountryOptions = templateMarkets.map((market) => ({
  value: market.countryCode,
  label: market.countryCode,
}));
