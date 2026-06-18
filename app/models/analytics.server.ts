import {
  AnalyticsEventType,
  AttributionModel,
  PlacementType,
  Prisma,
  type AnalyticsEvent,
  type Campaign,
} from "@prisma/client";

import prisma from "../db.server";
import { markFirstImpressionReceived } from "../services/onboarding.server";
import { normalizeShopDomain } from "../utils/storefront-campaigns";
import {
  findLastAttributableTouch,
  recordAttributionConversion,
  recordAttributionTouch,
} from "./stage2.server";

export const IMPRESSION_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

const maxStringLengths = {
  shop: 255,
  campaignId: 255,
  experimentId: 255,
  variantId: 255,
  visitorId: 255,
  sessionId: 255,
  cartToken: 255,
  orderId: 255,
  currencyCode: 8,
  country: 8,
  locale: 32,
  path: 500,
  userAgent: 500,
};

export type AnalyticsEventPayload = {
  shop: string;
  campaignId: string;
  experimentId: string | null;
  variantId: string | null;
  visitorId: string | null;
  eventType: AnalyticsEventType;
  placementType: PlacementType | null;
  sessionId: string | null;
  cartToken: string | null;
  orderId: string | null;
  revenueAmount: string | null;
  currencyCode: string | null;
  country: string | null;
  locale: string | null;
  path: string | null;
  userAgent: string | null;
  doNotTrack: boolean;
  consentGranted: boolean | null;
};

export type AnalyticsValidationResult =
  | { ok: true; payload: AnalyticsEventPayload }
  | { ok: false; errors: string[] };

export type AnalyticsSummary = {
  impressions: number;
  clicks: number;
  copyCode: number;
  addToCart: number;
  checkoutStarted: number;
  ordersAttributed: number;
  revenueAttributed: number;
  currencyCode: string;
  ctr: number;
};

export type AnalyticsByDayRow = AnalyticsSummary & {
  date: string;
};

export type AnalyticsByCampaignRow = AnalyticsSummary & {
  campaignId: string;
  campaignName: string;
  campaignType: string;
};

type AnalyticsSummaryEvent = Pick<
  AnalyticsEvent,
  "eventType" | "occurredAt" | "revenueAmount" | "currencyCode" | "campaignId"
> & {
  campaign?: Pick<Campaign, "id" | "name" | "type"> | null;
};

export class AnalyticsIngestionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AnalyticsIngestionError";
    this.status = status;
  }
}

export function validateAnalyticsEventPayload(
  value: unknown,
): AnalyticsValidationResult {
  const input = readObject(value);
  const errors: string[] = [];
  const shop = normalizeShopDomain(readText(input.shop, maxStringLengths.shop));
  const campaignId = readText(input.campaignId, maxStringLengths.campaignId);
  const eventType = readEventType(input.eventType);
  const placementType = readPlacementType(input.placementType);
  const revenueAmount = readRevenueAmount(input.revenueAmount);

  if (!shop) {
    errors.push("shop is required.");
  }

  if (!campaignId) {
    errors.push("campaignId is required.");
  }

  if (!eventType) {
    errors.push("eventType must be a supported analytics event.");
  }

  if (input.placementType != null && !placementType) {
    errors.push("placementType must be a supported placement.");
  }

  if (input.revenueAmount != null && revenueAmount === null) {
    errors.push("revenueAmount must be a non-negative number.");
  }

  if (errors.length > 0 || !eventType) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    payload: {
      shop,
      campaignId,
      experimentId: readNullableText(
        input.experimentId,
        maxStringLengths.experimentId,
      ),
      variantId: readNullableText(input.variantId, maxStringLengths.variantId),
      visitorId: readNullableText(input.visitorId, maxStringLengths.visitorId),
      eventType,
      placementType,
      sessionId: readNullableText(input.sessionId, maxStringLengths.sessionId),
      cartToken: readNullableText(input.cartToken, maxStringLengths.cartToken),
      orderId: readNullableText(input.orderId, maxStringLengths.orderId),
      revenueAmount,
      currencyCode: normalizeUppercaseText(
        input.currencyCode,
        maxStringLengths.currencyCode,
      ),
      country: normalizeUppercaseText(input.country, maxStringLengths.country),
      locale: readNullableText(input.locale, maxStringLengths.locale),
      path: readNullableText(input.path, maxStringLengths.path),
      userAgent: readNullableText(input.userAgent, maxStringLengths.userAgent),
      doNotTrack: readBoolean(input.doNotTrack),
      consentGranted: readNullableBoolean(input.consentGranted),
    },
  };
}

export async function recordAnalyticsEvent(
  payload: AnalyticsEventPayload,
  now = new Date(),
) {
  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: payload.shop },
    select: {
      id: true,
      settings: {
        select: {
          analyticsEnabled: true,
          consentMode: true,
          respectDoNotTrack: true,
        },
      },
    },
  });

  if (!shop) {
    throw new AnalyticsIngestionError("Shop was not found.", 404);
  }

  const analyticsGate = getAnalyticsGate(payload, shop.settings);

  if (!analyticsGate.allowed) {
    return {
      saved: false,
      deduped: false,
      ignored: true,
      reason: analyticsGate.reason,
    };
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: payload.campaignId, shopId: shop.id },
    select: { id: true },
  });

  if (!campaign) {
    throw new AnalyticsIngestionError("Campaign was not found.", 404);
  }

  const existingImpression = shouldCheckImpressionDedupe(payload)
    ? await prisma.analyticsEvent.findFirst({
        where: {
          shopId: shop.id,
          campaignId: campaign.id,
          eventType: AnalyticsEventType.IMPRESSION,
          placementType: payload.placementType,
          sessionId: payload.sessionId,
          occurredAt: {
            gte: getImpressionDedupeSince(now),
          },
        },
        select: { id: true, occurredAt: true },
      })
    : null;

  if (shouldDedupeIncomingEvent(payload, existingImpression, now)) {
    return { saved: false, deduped: true, eventId: existingImpression?.id };
  }

  const event = await prisma.analyticsEvent.create({
    data: {
      shopId: shop.id,
      campaignId: campaign.id,
      eventType: payload.eventType,
      placementType: payload.placementType,
      sessionId: payload.sessionId,
      cartToken: payload.cartToken,
      orderId: payload.orderId,
      revenueAmount: payload.revenueAmount
        ? new Prisma.Decimal(payload.revenueAmount)
        : null,
      currencyCode: payload.currencyCode,
      country: payload.country,
      locale: payload.locale,
      path: payload.path,
      userAgent: payload.userAgent,
      occurredAt: now,
    },
    select: { id: true },
  });
  const attributionTouch = await recordAttributionTouch({
    shopId: shop.id,
    campaignId: campaign.id,
    experimentId: payload.experimentId,
    variantId: payload.variantId,
    visitorId: payload.visitorId,
    sessionId: payload.sessionId,
    eventType: payload.eventType,
    placementType: payload.placementType,
    path: payload.path,
    country: payload.country,
    locale: payload.locale,
    occurredAt: now,
  });
  const conversion = await maybeRecordAttributionConversion({
    shopId: shop.id,
    campaignId: campaign.id,
    payload,
    occurredAt: now,
  });

  if (payload.eventType === AnalyticsEventType.IMPRESSION) {
    await markFirstImpressionReceived(shop.id);
  }

  return {
    saved: true,
    deduped: false,
    eventId: event.id,
    attributionTouchId: attributionTouch.id,
    attributionConversionId: conversion?.id,
  };
}

async function maybeRecordAttributionConversion({
  shopId,
  campaignId,
  payload,
  occurredAt,
}: {
  shopId: string;
  campaignId: string;
  payload: AnalyticsEventPayload;
  occurredAt: Date;
}) {
  if (
    payload.eventType !== AnalyticsEventType.ORDER_ATTRIBUTED ||
    !payload.orderId
  ) {
    return null;
  }

  const touch = await findLastAttributableTouch({
    shopId,
    visitorId: payload.visitorId,
    sessionId: payload.sessionId,
    attributionModel: AttributionModel.LAST_TOUCH_7D,
    occurredAt,
  });

  return recordAttributionConversion({
    shopId,
    campaignId: touch?.campaignId ?? campaignId,
    experimentId: touch?.experimentId ?? payload.experimentId,
    variantId: touch?.variantId ?? payload.variantId,
    visitorId: payload.visitorId,
    sessionId: payload.sessionId,
    orderId: payload.orderId,
    revenueAmount: payload.revenueAmount
      ? new Prisma.Decimal(payload.revenueAmount)
      : null,
    currencyCode: payload.currencyCode,
    attributionModel: AttributionModel.LAST_TOUCH_7D,
    occurredAt,
  });
}

function getAnalyticsGate(
  payload: Pick<AnalyticsEventPayload, "doNotTrack" | "consentGranted">,
  settings: {
    analyticsEnabled: boolean;
    respectDoNotTrack: boolean;
    consentMode: string;
  } | null,
) {
  if (settings?.analyticsEnabled === false) {
    return { allowed: false, reason: "analytics_disabled" };
  }

  if (settings?.respectDoNotTrack !== false && payload.doNotTrack) {
    return { allowed: false, reason: "do_not_track" };
  }

  if (settings?.consentMode === "STRICT" && payload.consentGranted !== true) {
    return { allowed: false, reason: "consent_required" };
  }

  return { allowed: true, reason: "" };
}

export async function getCampaignAnalyticsSummary(
  campaignId: string,
  options: { shopId?: string; days?: number; now?: Date } = {},
) {
  const events = await prisma.analyticsEvent.findMany({
    where: {
      campaignId,
      shopId: options.shopId,
      occurredAt: { gte: getRangeStart(options.days ?? 7, options.now) },
    },
  });

  return summarizeAnalyticsEvents(events);
}

export async function getShopAnalyticsSummary(
  shopId: string,
  options: { days?: number; now?: Date } = {},
) {
  const events = await prisma.analyticsEvent.findMany({
    where: {
      shopId,
      occurredAt: { gte: getRangeStart(options.days ?? 7, options.now) },
    },
  });

  return summarizeAnalyticsEvents(events);
}

export async function getAnalyticsByDay(
  shopId: string,
  options: { days?: number; now?: Date } = {},
) {
  const days = normalizeRangeDays(options.days);
  const now = options.now ?? new Date();
  const events = await prisma.analyticsEvent.findMany({
    where: {
      shopId,
      occurredAt: { gte: getDayRangeStart(days, now) },
    },
  });

  return buildAnalyticsByDay(events, days, now);
}

export async function getAnalyticsByCampaign(
  shopId: string,
  options: { days?: number; now?: Date } = {},
) {
  const events = await prisma.analyticsEvent.findMany({
    where: {
      shopId,
      occurredAt: { gte: getRangeStart(options.days ?? 7, options.now) },
    },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  return buildAnalyticsByCampaign(events);
}

export function summarizeAnalyticsEvents(
  events: AnalyticsSummaryEvent[],
): AnalyticsSummary {
  const summary = createEmptyAnalyticsSummary();

  for (const event of events) {
    incrementSummary(summary, event);
  }

  summary.ctr = calculateCtr(summary.clicks, summary.impressions);

  return summary;
}

export function buildAnalyticsByDay(
  events: AnalyticsSummaryEvent[],
  days: number,
  now = new Date(),
): AnalyticsByDayRow[] {
  const normalizedDays = normalizeRangeDays(days);
  const rows = new Map<string, AnalyticsByDayRow>();
  const start = getDayRangeStart(normalizedDays, now);

  for (let index = 0; index < normalizedDays; index += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    rows.set(toDateKey(date), {
      date: toDateKey(date),
      ...createEmptyAnalyticsSummary(),
    });
  }

  for (const event of events) {
    const key = toDateKey(event.occurredAt);
    const row = rows.get(key);

    if (row) {
      incrementSummary(row, event);
    }
  }

  return Array.from(rows.values()).map((row) => ({
    ...row,
    ctr: calculateCtr(row.clicks, row.impressions),
  }));
}

export function buildAnalyticsByCampaign(
  events: AnalyticsSummaryEvent[],
): AnalyticsByCampaignRow[] {
  const rows = new Map<string, AnalyticsByCampaignRow>();

  for (const event of events) {
    const campaignId = event.campaignId ?? "unknown";
    const campaign = event.campaign;
    const row =
      rows.get(campaignId) ??
      ({
        campaignId,
        campaignName: campaign?.name ?? "Unknown campaign",
        campaignType: campaign?.type ?? "Unknown",
        ...createEmptyAnalyticsSummary(),
      } satisfies AnalyticsByCampaignRow);

    incrementSummary(row, event);
    rows.set(campaignId, row);
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      ctr: calculateCtr(row.clicks, row.impressions),
    }))
    .sort((first, second) => second.impressions - first.impressions);
}

export function shouldDedupeIncomingEvent(
  payload: Pick<
    AnalyticsEventPayload,
    "eventType" | "placementType" | "sessionId"
  >,
  existingEvent: Pick<AnalyticsEvent, "occurredAt"> | null,
  now = new Date(),
  windowMs = IMPRESSION_DEDUPE_WINDOW_MS,
) {
  return Boolean(
    shouldCheckImpressionDedupe(payload) &&
    existingEvent &&
    existingEvent.occurredAt.getTime() >= now.getTime() - windowMs,
  );
}

export function getImpressionDedupeSince(
  now = new Date(),
  windowMs = IMPRESSION_DEDUPE_WINDOW_MS,
) {
  return new Date(now.getTime() - windowMs);
}

function shouldCheckImpressionDedupe(
  payload: Pick<
    AnalyticsEventPayload,
    "eventType" | "placementType" | "sessionId"
  >,
) {
  return Boolean(
    payload.eventType === AnalyticsEventType.IMPRESSION &&
    payload.placementType &&
    payload.sessionId,
  );
}

function createEmptyAnalyticsSummary(): AnalyticsSummary {
  return {
    impressions: 0,
    clicks: 0,
    copyCode: 0,
    addToCart: 0,
    checkoutStarted: 0,
    ordersAttributed: 0,
    revenueAttributed: 0,
    currencyCode: "USD",
    ctr: 0,
  };
}

function incrementSummary(
  summary: AnalyticsSummary,
  event: AnalyticsSummaryEvent,
) {
  if (event.eventType === AnalyticsEventType.IMPRESSION) {
    summary.impressions += 1;
  }

  if (event.eventType === AnalyticsEventType.CLICK) {
    summary.clicks += 1;
  }

  if (event.eventType === AnalyticsEventType.COPY_CODE) {
    summary.copyCode += 1;
  }

  if (event.eventType === AnalyticsEventType.ADD_TO_CART) {
    summary.addToCart += 1;
  }

  if (event.eventType === AnalyticsEventType.CHECKOUT_STARTED) {
    summary.checkoutStarted += 1;
  }

  if (event.eventType === AnalyticsEventType.ORDER_ATTRIBUTED) {
    summary.ordersAttributed += 1;
    summary.revenueAttributed += readDecimalNumber(event.revenueAmount);
  }

  if (event.currencyCode) {
    summary.currencyCode = event.currencyCode;
  }
}

function calculateCtr(clicks: number, impressions: number) {
  return impressions > 0 ? clicks / impressions : 0;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readNullableText(value: unknown, maxLength: number) {
  const text = readText(value, maxLength);
  return text || null;
}

function normalizeUppercaseText(value: unknown, maxLength: number) {
  const text = readText(value, maxLength).toUpperCase();
  return text || null;
}

function readBoolean(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function readNullableBoolean(value: unknown) {
  if (value == null || value === "") return null;
  return readBoolean(value);
}

function readEventType(value: unknown) {
  return Object.values(AnalyticsEventType).includes(value as AnalyticsEventType)
    ? (value as AnalyticsEventType)
    : null;
}

function readPlacementType(value: unknown) {
  return Object.values(PlacementType).includes(value as PlacementType)
    ? (value as PlacementType)
    : null;
}

function readRevenueAmount(value: unknown) {
  if (value == null || value === "") return null;

  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) return null;

  return numberValue.toFixed(2);
}

function readDecimalNumber(value: unknown) {
  if (value == null) return 0;

  const numberValue =
    value instanceof Prisma.Decimal ? value.toNumber() : Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getRangeStart(days: number, now = new Date()) {
  return new Date(now.getTime() - normalizeRangeDays(days) * 24 * 60 * 60_000);
}

function getDayRangeStart(days: number, now = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - normalizeRangeDays(days) + 1);
  return start;
}

function normalizeRangeDays(days: number | undefined) {
  return days === 30 ? 30 : 7;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
