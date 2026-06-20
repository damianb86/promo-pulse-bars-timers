import {
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
import { defaultBadgeSettingsValues } from "../../types/badge";
import type { CampaignAiInput } from "../../types/ai-campaign";
import {
  defaultCampaignDesignValues,
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
import {
  buildDefaultCampaignTranslations,
  normalizeStorefrontLocale,
} from "../../utils/campaign-localization";
import {
  buildSystemCampaignTemplates,
  templateMarkets,
} from "./systemTemplates.js";

export type TemplateLibraryFilters = {
  goal?: string;
  country?: string;
  locale?: string;
  eventName?: string;
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
  const existingCount = await prisma.campaignTemplate.count({
    where: { isSystem: true },
  });

  if (existingCount > 0) return existingCount;

  return syncSystemCampaignTemplates();
}

export async function listTemplateLibrary(
  filters: TemplateLibraryFilters = {},
) {
  const normalized = normalizeTemplateFilters(filters);
  const templates = await prisma.campaignTemplate.findMany({
    where: buildTemplateWhere(normalized),
    orderBy: [
      { category: "asc" },
      { eventName: "asc" },
      { countryCode: "asc" },
      { locale: "asc" },
    ],
  });

  return templates.map((template) => ({
    ...template,
    actionUrl: `/app/templates?templateKey=${encodeURIComponent(template.key)}`,
    aiUrl: `/app/campaigns/new?templateKey=${encodeURIComponent(
      template.key,
    )}&aiFromTemplate=1`,
  }));
}

export async function getTemplateFilterOptions(): Promise<TemplateFilterOptions> {
  const templates = await prisma.campaignTemplate.findMany({
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

export async function getCampaignTemplateByKey(key: string) {
  return prisma.campaignTemplate.findUnique({
    where: { key },
  });
}

export async function createDraftCampaignFromTemplate(
  shopId: string,
  templateKey: string,
) {
  const template = await getCampaignTemplateByKey(templateKey);

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
        create: [{ placementType, enabled: true }],
      },
      targeting: {
        create: {
          countries: template.countryCode ? [template.countryCode] : [],
          markets: [],
          locales: template.locale ? [template.locale] : [],
          productIds: [],
          collectionIds: [],
          productTags: [],
          customerTags: [],
          urlContains: [],
          utmSources: [],
          devices: [],
          excludeProductIds: [],
          excludeCollectionIds: [],
          behaviorRules: Prisma.JsonNull,
        },
      },
      translations: {
        create: buildTemplateTranslations(template, texts),
      },
      design: {
        create: design,
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
    headline: texts.headline ?? template.eventName,
    subheadline: texts.subheadline ?? "",
    ctaText: texts.ctaText ?? "",
    ctaUrl: texts.ctaUrl ?? "/collections/all",
  };
}

export function buildCampaignAiInputFromTemplate(
  template: CampaignTemplate,
): CampaignAiInput {
  const texts = readTemplateTexts(template.defaultTexts);
  const settings = readTemplateSettings(template.defaultSettings);

  return {
    objective: toEditableCampaignGoal(template.goal),
    productContext: settings.productContext ?? "selected products",
    eventName: template.eventName,
    countryCode: template.countryCode ?? "US",
    locale: normalizeTemplateLocale(template.locale),
    brandTone: readBrandTone(template.category),
    knownOffer: settings.knownOffer ?? "",
    ctaUrl: texts.ctaUrl ?? "/collections/all",
  };
}

export function normalizeTemplateLocale(locale: string | null | undefined) {
  const normalized = normalizeStorefrontLocale(locale ?? "en");

  if (normalized === "pt-BR") return "pt-BR";
  if (normalized === "es") return "es";
  if (normalized === "fr") return "fr";
  if (normalized === "de") return "de";

  return "en";
}

export function getTemplateLocaleFallbacks(locale: string | null | undefined) {
  const normalized = normalizeTemplateLocale(locale);

  return normalized === "en" ? ["en"] : [normalized, "en"];
}

function buildTemplateWhere(filters: TemplateLibraryFilters) {
  const where: Prisma.CampaignTemplateWhereInput = {};

  if (filters.goal) {
    where.goal = filters.goal as CampaignGoal;
  }

  if (filters.type) {
    where.type = filters.type as CampaignType;
  }

  if (filters.country) {
    where.OR = [
      ...(where.OR ?? []),
      { countryCode: filters.country },
      { countryCode: null },
    ];
  }

  if (filters.locale) {
    where.locale = { in: getTemplateLocaleFallbacks(filters.locale) };
  }

  if (filters.eventName) {
    where.eventName = { contains: filters.eventName };
  }

  return where;
}

function normalizeTemplateFilters(filters: TemplateLibraryFilters) {
  return {
    goal: filters.goal?.trim() || "",
    country: filters.country?.trim().toUpperCase() || "",
    locale: filters.locale?.trim() || "",
    eventName: filters.eventName?.trim() || "",
    type: filters.type?.trim() || "",
  };
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
  const design: CampaignDesignValues = {
    ...defaultCampaignDesignValues,
    templateKey: readString(input.templateKey) || "clean-minimal",
    layout:
      readEnum(input.layout, [
        "STANDARD",
        "BALANCED",
        "INLINE",
        "CTA_RIGHT",
        "CTA_LEFT",
        "CTA_TOP",
      ]) ?? defaultCampaignDesignValues.layout,
    backgroundType:
      readEnum(input.backgroundType, ["SOLID", "GRADIENT", "IMAGE"]) ??
      defaultCampaignDesignValues.backgroundType,
    backgroundColor:
      readString(input.backgroundColor) ||
      defaultCampaignDesignValues.backgroundColor,
    backgroundImageUrl: readString(input.backgroundImageUrl),
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
    customIconUrl: readString(input.customIconUrl),
  };

  return design;
}

function readTemplateSettings(value: Prisma.JsonValue): TemplateSettings {
  const input = readObject(value);

  return {
    badgePosition: readString(input.badgePosition),
    badgeShape: readString(input.badgeShape),
    currencyCode: readString(input.currencyCode),
    cutoffHour: readInteger(input.cutoffHour, 14),
    cutoffMinute: readInteger(input.cutoffMinute, 0),
    knownOffer: readString(input.knownOffer),
    maxDeliveryDays: readInteger(input.maxDeliveryDays, 5),
    minDeliveryDays: readInteger(input.minDeliveryDays, 2),
    processingDays: readInteger(input.processingDays, 0),
    productContext: readString(input.productContext),
    recommendedPlacement: readString(input.recommendedPlacement),
    suggestedDurationHours: readInteger(input.suggestedDurationHours, 48),
    thresholdAmount: readString(input.thresholdAmount),
    timezone: readString(input.timezone),
  };
}

function readPlacementType(
  value: string | null | undefined,
  type: CampaignType,
) {
  return (readEnum(value, [
    "TOP_BAR",
    "BOTTOM_BAR",
    "PRODUCT_PAGE",
    "COLLECTION_CARD",
    "CART_PAGE",
    "CART_DRAWER",
    "THANK_YOU_PAGE",
    "ORDER_STATUS_PAGE",
    "PASSWORD_PAGE",
    "CUSTOM_SELECTOR",
  ]) ??
    (getDefaultPlacementForCampaignType(
      type,
    ) as PlacementTypeValue)) as PlacementType;
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
  currencyCode?: string;
  cutoffHour?: number;
  cutoffMinute?: number;
  knownOffer?: string;
  maxDeliveryDays?: number;
  minDeliveryDays?: number;
  processingDays?: number;
  productContext?: string;
  recommendedPlacement?: string;
  suggestedDurationHours?: number;
  thresholdAmount?: string;
  timezone?: string;
};

export const templateLibraryCountryOptions = templateMarkets.map((market) => ({
  value: market.countryCode,
  label: market.countryCode,
}));
