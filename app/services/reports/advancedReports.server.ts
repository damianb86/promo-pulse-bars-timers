import {
  AnalyticsEventType,
  PlacementType,
  UniqueDiscountCodeStatus,
  type AnalyticsEvent,
  type AttributionConversion,
  type AttributionTouch,
  type Campaign,
  type CampaignType,
  type ExperimentVariant,
  type MarketCampaignRule,
} from "@prisma/client";

import prisma from "../../db.server";

export type ReportDateRange = {
  start: Date;
  end: Date;
};

export type AdvancedReportFilters = ReportDateRange & {
  campaignId?: string;
  placement?: PlacementType;
  country?: string;
  locale?: string;
  market?: string;
  device?: ReportDevice;
};

export type ReportDevice = "desktop" | "mobile" | "tablet" | "unknown";

export type ReportMetricRow = {
  key: string;
  label: string;
  impressions: number;
  clicks: number;
  ctr: number;
  addToCart: number;
  addToCartRate: number;
  checkoutStarted: number;
  checkoutStartedRate: number;
  orders: number;
  revenue: number;
  revenuePerVisitor: number;
  conversionRate: number;
  averageOrderValue: number;
  visitors: number;
  currencyCode: string;
};

export type RevenueReport = {
  summary: ReportMetricRow;
  byCampaignType: ReportMetricRow[];
  emailTimerViews: number;
};

export type PlacementReport = {
  rows: ReportMetricRow[];
};

export type MarketReport = {
  byCountry: ReportMetricRow[];
  byLocale: ReportMetricRow[];
  byMarket: ReportMetricRow[];
};

export type ExperimentReport = {
  rows: ReportMetricRow[];
};

export type DiscountCodeReport = {
  rows: Array<{
    campaignId: string;
    campaignName: string;
    assigned: number;
    used: number;
    expired: number;
    conversionRate: number;
  }>;
  totals: {
    assigned: number;
    used: number;
    expired: number;
    conversionRate: number;
  };
};

export type TrendReport = {
  rows: Array<{
    date: string;
    impressions: number;
    clicks: number;
  }>;
};

export type WeeklyReport = {
  title: string;
  summary: string;
  highlights: string[];
  emailPrepared: boolean;
};

export type AdvancedReports = {
  filters: AdvancedReportFilters;
  revenue: RevenueReport;
  placement: PlacementReport;
  market: MarketReport;
  experiment: ExperimentReport;
  discountCodes: DiscountCodeReport;
  trend: TrendReport;
  weekly: WeeklyReport;
};

type EventWithCampaign = AnalyticsEvent & {
  campaign: Pick<Campaign, "id" | "name" | "type"> | null;
};

type ConversionWithCampaign = AttributionConversion & {
  campaign: Pick<Campaign, "id" | "name" | "type"> | null;
  variant:
    | (Pick<ExperimentVariant, "id" | "name"> & {
        experiment: { name: string } | null;
      })
    | null;
};

type TouchWithVariant = AttributionTouch & {
  campaign: Pick<Campaign, "id" | "name" | "type"> | null;
  variant:
    | (Pick<ExperimentVariant, "id" | "name"> & {
        experiment: { name: string } | null;
      })
    | null;
};

type RevenueRecord = {
  key: string;
  campaignId: string;
  campaignName: string;
  campaignType: string;
  variantId: string | null;
  variantName: string | null;
  experimentName: string | null;
  revenue: number;
  currencyCode: string;
  orderId: string;
};

const impressionEvents = new Set<AnalyticsEventType>([
  AnalyticsEventType.IMPRESSION,
  AnalyticsEventType.BADGE_IMPRESSION,
]);

const clickEvents = new Set<AnalyticsEventType>([
  AnalyticsEventType.CLICK,
  AnalyticsEventType.BADGE_CLICK,
]);

export async function getAdvancedReports(
  shopId: string,
  filters: AdvancedReportFilters,
): Promise<AdvancedReports> {
  const [revenue, placement, market, experiment, discountCodes, trend] =
    await Promise.all([
      getRevenueReport(shopId, filters),
      getPlacementReport(shopId, filters),
      getMarketReport(shopId, filters),
      getExperimentReport(shopId, filters),
      getDiscountCodeReport(shopId, filters),
      getTrendReport(shopId, filters),
    ]);

  return {
    filters,
    revenue,
    placement,
    market,
    experiment,
    discountCodes,
    trend,
    weekly: buildWeeklyReport(revenue, placement, market, discountCodes),
  };
}

export async function getTrendReport(
  shopId: string,
  filters: AdvancedReportFilters,
): Promise<TrendReport> {
  const [events, marketRules] = await Promise.all([
    loadAnalyticsEvents(shopId, filters),
    loadMarketRules(shopId),
  ]);
  const filteredEvents = applyDerivedEventFilters(events, marketRules, filters);
  const rows = buildTrendBuckets(filters);

  for (const event of filteredEvents) {
    const key = toDateKey(event.occurredAt);
    const row = rows.get(key);
    if (!row) continue;

    if (impressionEvents.has(event.eventType)) {
      row.impressions += 1;
    }

    if (clickEvents.has(event.eventType)) {
      row.clicks += 1;
    }
  }

  return { rows: Array.from(rows.values()) };
}

export async function getRevenueReport(
  shopId: string,
  filters: AdvancedReportFilters,
): Promise<RevenueReport> {
  const [events, conversions, touches, marketRules] = await Promise.all([
    loadAnalyticsEvents(shopId, filters),
    loadAttributionConversions(shopId, filters),
    loadAttributionTouches(shopId, filters),
    loadMarketRules(shopId),
  ]);
  const filteredEvents = applyDerivedEventFilters(events, marketRules, filters);
  const filteredTouches = applyDerivedTouchFilters(
    touches,
    marketRules,
    filters,
  );
  const revenueRecords = buildRevenueRecords(
    filteredEvents,
    selectConversionsForReport(conversions, filteredTouches, filters),
  );
  const rowsByType = new Map<CampaignType | string, ReportMetricRow>();

  const summary = buildMetricRow("all", "All campaigns", filteredEvents, {
    revenueRecords,
  });

  for (const event of filteredEvents) {
    const type = event.campaign?.type ?? "Unknown";
    const eventsForType = filteredEvents.filter(
      (candidate) => (candidate.campaign?.type ?? "Unknown") === type,
    );
    const revenueForType = revenueRecords.filter(
      (record) => record.campaignType === type,
    );

    rowsByType.set(
      type,
      buildMetricRow(type, formatEnum(type), eventsForType, {
        revenueRecords: revenueForType,
      }),
    );
  }

  for (const record of revenueRecords) {
    if (rowsByType.has(record.campaignType)) continue;

    rowsByType.set(
      record.campaignType,
      buildMetricRow(record.campaignType, formatEnum(record.campaignType), [], {
        revenueRecords: revenueRecords.filter(
          (candidate) => candidate.campaignType === record.campaignType,
        ),
      }),
    );
  }

  return {
    summary,
    byCampaignType: sortMetricRows(Array.from(rowsByType.values())),
    emailTimerViews: countEmailTimerViews(filteredEvents),
  };
}

export async function getPlacementReport(
  shopId: string,
  filters: AdvancedReportFilters,
): Promise<PlacementReport> {
  const [rawEvents, conversions, touches, marketRules] = await Promise.all([
    loadAnalyticsEvents(shopId, filters),
    loadAttributionConversions(shopId, filters),
    loadAttributionTouches(shopId, filters),
    loadMarketRules(shopId),
  ]);
  const events = applyDerivedEventFilters(rawEvents, marketRules, filters);
  const revenueByPlacement = groupRevenueRecordsByTouchDimension(
    conversions,
    applyDerivedTouchFilters(touches, marketRules, filters),
    filters,
    (touch) => touch.placementType ?? "Unknown",
  );

  return {
    rows: buildDimensionRows(
      events,
      (event) => event.placementType ?? "Unknown",
      {
        label: formatEnum,
        revenueRecordsByKey: revenueByPlacement,
      },
    ),
  };
}

export async function getMarketReport(
  shopId: string,
  filters: AdvancedReportFilters,
): Promise<MarketReport> {
  const [events, conversions, touches, marketRules] = await Promise.all([
    loadAnalyticsEvents(shopId, filters),
    loadAttributionConversions(shopId, filters),
    loadAttributionTouches(shopId, filters),
    loadMarketRules(shopId),
  ]);
  const filteredEvents = applyDerivedEventFilters(events, marketRules, filters);
  const filteredTouches = applyDerivedTouchFilters(
    touches,
    marketRules,
    filters,
  );

  return {
    byCountry: buildDimensionRows(
      filteredEvents,
      (event) => normalizeDimension(event.country, "Unknown country"),
      {
        revenueRecordsByKey: groupRevenueRecordsByTouchDimension(
          conversions,
          filteredTouches,
          filters,
          (touch) => normalizeDimension(touch.country, "Unknown country"),
        ),
      },
    ),
    byLocale: buildDimensionRows(
      filteredEvents,
      (event) => normalizeDimension(event.locale, "Unknown locale"),
      {
        revenueRecordsByKey: groupRevenueRecordsByTouchDimension(
          conversions,
          filteredTouches,
          filters,
          (touch) => normalizeDimension(touch.locale, "Unknown locale"),
        ),
      },
    ),
    byMarket: buildDimensionRows(
      filteredEvents,
      (event) => getMarketLabel(event, marketRules),
      {
        revenueRecordsByKey: groupRevenueRecordsByTouchDimension(
          conversions,
          filteredTouches,
          filters,
          (touch) => getMarketLabel(touch, marketRules),
        ),
      },
    ),
  };
}

export async function getExperimentReport(
  shopId: string,
  filters: AdvancedReportFilters,
): Promise<ExperimentReport> {
  const [touches, conversions, marketRules] = await Promise.all([
    loadAttributionTouches(shopId, filters),
    loadAttributionConversions(shopId, filters),
    loadMarketRules(shopId),
  ]);
  const filteredTouches = applyDerivedTouchFilters(
    touches,
    marketRules,
    filters,
  );
  const filteredConversions = selectConversionsForReport(
    conversions,
    filteredTouches,
    filters,
  );
  const groups = new Map<string, TouchWithVariant[]>();

  for (const touch of filteredTouches) {
    const key = touch.variantId ?? "no-variant";
    groups.set(key, [...(groups.get(key) ?? []), touch]);
  }

  const rows = Array.from(groups.entries()).map(([variantId, rows]) => {
    const sample = rows[0];
    const label = sample?.variant
      ? `${sample.variant.experiment?.name ?? "Experiment"} - ${sample.variant.name}`
      : "No experiment variant";
    const revenueRecords = filteredConversions
      .filter(
        (conversion) => (conversion.variantId ?? "no-variant") === variantId,
      )
      .map(toRevenueRecord);

    return buildMetricRow(variantId, label, rows, {
      revenueRecords,
      visitorKeys: rows.map(readTouchVisitorKey),
    });
  });

  for (const conversion of filteredConversions) {
    const key = conversion.variantId ?? "no-variant";
    if (rows.some((row) => row.key === key)) continue;

    rows.push(
      buildMetricRow(
        key,
        conversion.variant
          ? `${conversion.variant.experiment?.name ?? "Experiment"} - ${conversion.variant.name}`
          : "No experiment variant",
        [],
        {
          revenueRecords: [toRevenueRecord(conversion)],
          visitorKeys: [readConversionVisitorKey(conversion)],
        },
      ),
    );
  }

  return { rows: sortMetricRows(rows) };
}

export async function getDiscountCodeReport(
  shopId: string,
  filters: AdvancedReportFilters,
): Promise<DiscountCodeReport> {
  const codes = await prisma.uniqueDiscountCode.findMany({
    where: {
      shopId,
      campaignId: filters.campaignId,
      OR: [
        { assignedAt: { gte: filters.start, lte: filters.end } },
        { usedAt: { gte: filters.start, lte: filters.end } },
        { updatedAt: { gte: filters.start, lte: filters.end } },
      ],
    },
    include: {
      campaign: {
        select: { id: true, name: true },
      },
    },
  });
  const rows = new Map<string, DiscountCodeReport["rows"][number]>();

  for (const code of codes) {
    const campaignId = code.campaignId;
    const row =
      rows.get(campaignId) ??
      ({
        campaignId,
        campaignName: code.campaign.name,
        assigned: 0,
        used: 0,
        expired: 0,
        conversionRate: 0,
      } satisfies DiscountCodeReport["rows"][number]);

    if (code.assignedAt && isWithinRange(code.assignedAt, filters)) {
      row.assigned += 1;
    }

    if (
      code.status === UniqueDiscountCodeStatus.USED &&
      code.usedAt &&
      isWithinRange(code.usedAt, filters)
    ) {
      row.used += 1;
    }

    if (
      code.status === UniqueDiscountCodeStatus.EXPIRED &&
      isWithinRange(code.updatedAt, filters)
    ) {
      row.expired += 1;
    }

    row.conversionRate = safeRate(row.used, row.assigned);
    rows.set(campaignId, row);
  }

  const sortedRows = Array.from(rows.values()).sort(
    (first, second) => second.assigned - first.assigned,
  );
  const totals = sortedRows.reduce(
    (total, row) => {
      total.assigned += row.assigned;
      total.used += row.used;
      total.expired += row.expired;
      return total;
    },
    { assigned: 0, used: 0, expired: 0, conversionRate: 0 },
  );
  totals.conversionRate = safeRate(totals.used, totals.assigned);

  return { rows: sortedRows, totals };
}

export function buildAdvancedReportsCsv(report: AdvancedReports) {
  const rows: string[][] = [
    [
      "Section",
      "Label",
      "Impressions",
      "Clicks",
      "CTR",
      "Add to cart rate",
      "Checkout started rate",
      "Orders",
      "Revenue",
      "Revenue per visitor",
      "Conversion rate",
      "Average order value",
      "Visitors",
      "Currency",
    ],
    metricCsvRow("Summary", report.revenue.summary),
    ...report.revenue.byCampaignType.map((row) =>
      metricCsvRow("Campaign type", row),
    ),
    ...report.placement.rows.map((row) => metricCsvRow("Placement", row)),
    ...report.market.byCountry.map((row) => metricCsvRow("Country", row)),
    ...report.market.byLocale.map((row) => metricCsvRow("Locale", row)),
    ...report.market.byMarket.map((row) => metricCsvRow("Market", row)),
    ...report.experiment.rows.map((row) =>
      metricCsvRow("Experiment variant", row),
    ),
    [
      "Unique codes",
      "Total",
      "",
      "",
      "",
      "",
      "",
      String(report.discountCodes.totals.used),
      "",
      "",
      String(report.discountCodes.totals.conversionRate),
      "",
      String(report.discountCodes.totals.assigned),
      "",
    ],
    ...report.discountCodes.rows.map((row) => [
      "Unique codes",
      row.campaignName,
      "",
      "",
      "",
      "",
      "",
      String(row.used),
      "",
      "",
      String(row.conversionRate),
      "",
      String(row.assigned),
      "",
    ]),
  ];

  return `${rows.map(csvLine).join("\n")}\n`;
}

function metricCsvRow(section: string, row: ReportMetricRow) {
  return [
    section,
    row.label,
    String(row.impressions),
    String(row.clicks),
    String(row.ctr),
    String(row.addToCartRate),
    String(row.checkoutStartedRate),
    String(row.orders),
    String(row.revenue),
    String(row.revenuePerVisitor),
    String(row.conversionRate),
    String(row.averageOrderValue),
    String(row.visitors),
    row.currencyCode,
  ];
}

function buildWeeklyReport(
  revenue: RevenueReport,
  placement: PlacementReport,
  market: MarketReport,
  discountCodes: DiscountCodeReport,
): WeeklyReport {
  const topPlacement = placement.rows[0];
  const topMarket = market.byMarket[0];
  const highlights = [
    `${revenue.summary.orders} orders attributed to Promo Pulse campaigns.`,
    `${formatCurrencyValue(
      revenue.summary.revenue,
      revenue.summary.currencyCode,
    )} attributed revenue.`,
    topPlacement
      ? `${topPlacement.label} is the top placement by impressions.`
      : "No placement activity in this period.",
    topMarket
      ? `${topMarket.label} is the top market by impressions.`
      : "No market activity in this period.",
    `${discountCodes.totals.used} unique codes used from ${discountCodes.totals.assigned} assigned.`,
  ];

  return {
    title: "Weekly Promo Pulse performance summary",
    summary:
      "Email delivery is not configured yet; this summary is prepared in-app.",
    highlights,
    emailPrepared: false,
  };
}

function buildTrendBuckets(filters: AdvancedReportFilters) {
  const rows = new Map<
    string,
    { date: string; impressions: number; clicks: number }
  >();
  const current = new Date(
    Date.UTC(
      filters.start.getUTCFullYear(),
      filters.start.getUTCMonth(),
      filters.start.getUTCDate(),
    ),
  );
  const end = new Date(
    Date.UTC(
      filters.end.getUTCFullYear(),
      filters.end.getUTCMonth(),
      filters.end.getUTCDate(),
    ),
  );

  while (current <= end) {
    const date = toDateKey(current);
    rows.set(date, { date, impressions: 0, clicks: 0 });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return rows;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDimensionRows(
  events: EventWithCampaign[],
  getKey: (event: EventWithCampaign) => string,
  options: {
    label?: (key: string) => string;
    revenueRecordsByKey?: Map<string, RevenueRecord[]>;
  } = {},
) {
  const groups = groupEvents(events, getKey);
  const keys = new Set([
    ...groups.keys(),
    ...(options.revenueRecordsByKey?.keys() ?? []),
  ]);

  return sortMetricRows(
    Array.from(keys).map((key) =>
      buildMetricRow(key, options.label?.(key) ?? key, groups.get(key) ?? [], {
        revenueRecords: options.revenueRecordsByKey?.get(key) ?? [],
      }),
    ),
  );
}

function buildMetricRow(
  key: string,
  label: string,
  events: Array<EventWithCampaign | TouchWithVariant>,
  options: {
    revenueRecords?: RevenueRecord[];
    visitorKeys?: Array<string | null>;
  } = {},
): ReportMetricRow {
  const impressions = events.filter((event) =>
    impressionEvents.has(event.eventType),
  ).length;
  const clicks = events.filter((event) =>
    clickEvents.has(event.eventType),
  ).length;
  const addToCart = events.filter(
    (event) => event.eventType === AnalyticsEventType.ADD_TO_CART,
  ).length;
  const checkoutStarted = events.filter(
    (event) => event.eventType === AnalyticsEventType.CHECKOUT_STARTED,
  ).length;
  const orderEvents = events.filter(
    (event) => event.eventType === AnalyticsEventType.ORDER_ATTRIBUTED,
  );
  const eventRevenueRecords = orderEvents.map(toEventRevenueRecord);
  const revenueRecords = options.revenueRecords
    ? mergeRevenueRecords(eventRevenueRecords, options.revenueRecords)
    : eventRevenueRecords;
  const orders = new Set(revenueRecords.map((record) => record.orderId)).size;
  const revenue = revenueRecords.reduce(
    (total, record) => total + record.revenue,
    0,
  );
  const visitorKeys = [
    ...events.map(readEventVisitorKey),
    ...(options.visitorKeys ?? []),
  ].filter(Boolean) as string[];
  const visitors = Math.max(orders, new Set(visitorKeys).size, impressions);
  const currencyCode = revenueRecords.find(
    (record) => record.currencyCode,
  )?.currencyCode;

  return {
    key,
    label,
    impressions,
    clicks,
    ctr: safeRate(clicks, impressions),
    addToCart,
    addToCartRate: safeRate(addToCart, visitors),
    checkoutStarted,
    checkoutStartedRate: safeRate(checkoutStarted, visitors),
    orders,
    revenue,
    revenuePerVisitor: safeRate(revenue, visitors),
    conversionRate: safeRate(orders, visitors),
    averageOrderValue: safeRate(revenue, orders),
    visitors,
    currencyCode: currencyCode ?? "USD",
  };
}

async function loadAnalyticsEvents(
  shopId: string,
  filters: AdvancedReportFilters,
) {
  return prisma.analyticsEvent.findMany({
    where: {
      shopId,
      campaignId: filters.campaignId,
      placementType: filters.placement,
      country: filters.country,
      locale: filters.locale,
      occurredAt: { gte: filters.start, lte: filters.end },
    },
    include: {
      campaign: { select: { id: true, name: true, type: true } },
    },
    orderBy: [{ occurredAt: "asc" }],
  });
}

async function loadAttributionConversions(
  shopId: string,
  filters: AdvancedReportFilters,
) {
  return prisma.attributionConversion.findMany({
    where: {
      shopId,
      campaignId: filters.campaignId,
      occurredAt: { gte: filters.start, lte: filters.end },
    },
    include: {
      campaign: { select: { id: true, name: true, type: true } },
      variant: {
        select: {
          id: true,
          name: true,
          experiment: { select: { name: true } },
        },
      },
    },
    orderBy: [{ occurredAt: "asc" }],
  });
}

async function loadAttributionTouches(
  shopId: string,
  filters: AdvancedReportFilters,
) {
  return prisma.attributionTouch.findMany({
    where: {
      shopId,
      campaignId: filters.campaignId,
      placementType: filters.placement,
      country: filters.country,
      locale: filters.locale,
      occurredAt: { gte: filters.start, lte: filters.end },
    },
    include: {
      campaign: { select: { id: true, name: true, type: true } },
      variant: {
        select: {
          id: true,
          name: true,
          experiment: { select: { name: true } },
        },
      },
    },
    orderBy: [{ occurredAt: "asc" }],
  });
}

async function loadMarketRules(shopId: string) {
  return prisma.marketCampaignRule.findMany({
    where: { shopId },
    select: {
      campaignId: true,
      countryCode: true,
      locale: true,
      marketId: true,
    },
  });
}

function buildRevenueRecords(
  events: EventWithCampaign[],
  conversions: ConversionWithCampaign[],
): RevenueRecord[] {
  const records = new Map<string, RevenueRecord>();

  for (const conversion of conversions) {
    const record = toRevenueRecord(conversion);
    records.set(record.key, record);
  }

  for (const event of events) {
    if (event.eventType !== AnalyticsEventType.ORDER_ATTRIBUTED) continue;

    const record = toEventRevenueRecord(event);

    if (records.has(record.key)) continue;

    records.set(record.key, record);
  }

  return Array.from(records.values());
}

function toEventRevenueRecord(
  event: EventWithCampaign | TouchWithVariant,
): RevenueRecord {
  return {
    key:
      "orderId" in event && event.orderId
        ? `order:${event.orderId}`
        : `event:${event.id}`,
    campaignId: event.campaignId ?? "unknown",
    campaignName: event.campaign?.name ?? "Unknown campaign",
    campaignType: event.campaign?.type ?? "Unknown",
    variantId: "variantId" in event ? event.variantId : null,
    variantName: null,
    experimentName: null,
    revenue: readDecimalNumber(
      "revenueAmount" in event ? event.revenueAmount : null,
    ),
    currencyCode:
      "currencyCode" in event ? (event.currencyCode ?? "USD") : "USD",
    orderId: "orderId" in event ? (event.orderId ?? event.id) : event.id,
  };
}

function toRevenueRecord(conversion: ConversionWithCampaign): RevenueRecord {
  return {
    key: `order:${conversion.orderId}`,
    campaignId: conversion.campaignId,
    campaignName: conversion.campaign?.name ?? "Unknown campaign",
    campaignType: conversion.campaign?.type ?? "Unknown",
    variantId: conversion.variantId,
    variantName: conversion.variant?.name ?? null,
    experimentName: conversion.variant?.experiment?.name ?? null,
    revenue: readDecimalNumber(conversion.revenueAmount),
    currencyCode: conversion.currencyCode ?? "USD",
    orderId: conversion.orderId,
  };
}

function mergeRevenueRecords(...recordLists: RevenueRecord[][]) {
  const records = new Map<string, RevenueRecord>();

  for (const record of recordLists.flat()) {
    records.set(record.key, record);
  }

  return Array.from(records.values());
}

function applyDerivedEventFilters(
  events: EventWithCampaign[],
  marketRules: Array<
    Pick<
      MarketCampaignRule,
      "campaignId" | "countryCode" | "locale" | "marketId"
    >
  >,
  filters: AdvancedReportFilters,
) {
  return events.filter((event) => {
    if (
      filters.device &&
      getDeviceFromUserAgent(event.userAgent) !== filters.device
    ) {
      return false;
    }

    if (
      filters.market &&
      getMarketLabel(event, marketRules) !== filters.market
    ) {
      return false;
    }

    return true;
  });
}

function applyDerivedTouchFilters(
  touches: TouchWithVariant[],
  marketRules: Array<
    Pick<
      MarketCampaignRule,
      "campaignId" | "countryCode" | "locale" | "marketId"
    >
  >,
  filters: AdvancedReportFilters,
) {
  return touches.filter((touch) => {
    if (filters.market && getMarketLabel(touch, marketRules) !== filters.market)
      return false;

    return true;
  });
}

function selectConversionsForReport(
  conversions: ConversionWithCampaign[],
  touches: TouchWithVariant[],
  filters: AdvancedReportFilters,
) {
  if (filters.device) return [];
  if (!hasTouchScopedFilters(filters)) return conversions;

  return conversions.filter((conversion) =>
    Boolean(findTouchForConversion(conversion, touches)),
  );
}

function groupRevenueRecordsByTouchDimension(
  conversions: ConversionWithCampaign[],
  touches: TouchWithVariant[],
  filters: AdvancedReportFilters,
  getKey: (touch: TouchWithVariant) => string,
) {
  const records = new Map<string, RevenueRecord[]>();

  if (filters.device) return records;

  for (const conversion of conversions) {
    const touch = findTouchForConversion(conversion, touches);

    if (!touch) continue;

    const key = getKey(touch);
    records.set(key, [
      ...(records.get(key) ?? []),
      toRevenueRecord(conversion),
    ]);
  }

  return records;
}

function findTouchForConversion(
  conversion: ConversionWithCampaign,
  touches: TouchWithVariant[],
) {
  return touches
    .filter((touch) => {
      if (touch.campaignId !== conversion.campaignId) return false;
      if (touch.occurredAt > conversion.occurredAt) return false;

      return (
        Boolean(
          conversion.visitorId && touch.visitorId === conversion.visitorId,
        ) ||
        Boolean(
          conversion.sessionId && touch.sessionId === conversion.sessionId,
        )
      );
    })
    .sort(
      (first, second) =>
        second.occurredAt.getTime() - first.occurredAt.getTime(),
    )[0];
}

function hasTouchScopedFilters(filters: AdvancedReportFilters) {
  return Boolean(
    filters.placement || filters.country || filters.locale || filters.market,
  );
}

function groupEvents(
  events: EventWithCampaign[],
  getKey: (event: EventWithCampaign) => string,
) {
  const groups = new Map<string, EventWithCampaign[]>();

  for (const event of events) {
    const key = getKey(event);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return groups;
}

function getMarketLabel(
  event: EventWithCampaign | TouchWithVariant,
  marketRules: Array<
    Pick<
      MarketCampaignRule,
      "campaignId" | "countryCode" | "locale" | "marketId"
    >
  >,
) {
  const rule = marketRules.find((candidate) => {
    if (candidate.campaignId !== event.campaignId) return false;
    if (candidate.countryCode && candidate.countryCode !== event.country)
      return false;
    if (candidate.locale && candidate.locale !== event.locale) return false;
    return Boolean(
      candidate.marketId || candidate.countryCode || candidate.locale,
    );
  });

  return normalizeDimension(
    rule?.marketId ?? rule?.countryCode ?? event.country,
    "Unknown market",
  );
}

function countEmailTimerViews(events: EventWithCampaign[]) {
  return events.filter(
    (event) =>
      impressionEvents.has(event.eventType) &&
      (event.path?.includes("/api/email-timer/") ||
        event.path?.includes("/email-timer/")),
  ).length;
}

function readEventVisitorKey(event: EventWithCampaign | TouchWithVariant) {
  if ("visitorId" in event && event.visitorId)
    return `visitor:${event.visitorId}`;
  if (event.sessionId) return `session:${event.sessionId}`;
  return null;
}

function readTouchVisitorKey(touch: TouchWithVariant) {
  return touch.visitorId
    ? `visitor:${touch.visitorId}`
    : touch.sessionId
      ? `session:${touch.sessionId}`
      : null;
}

function readConversionVisitorKey(conversion: ConversionWithCampaign) {
  return conversion.visitorId
    ? `visitor:${conversion.visitorId}`
    : conversion.sessionId
      ? `session:${conversion.sessionId}`
      : null;
}

export function getDeviceFromUserAgent(userAgent: string | null): ReportDevice {
  const value = userAgent?.toLowerCase() ?? "";

  if (!value) return "unknown";
  if (/ipad|tablet/.test(value)) return "tablet";
  if (/mobile|iphone|android/.test(value)) return "mobile";
  return "desktop";
}

function sortMetricRows(rows: ReportMetricRow[]) {
  return rows.sort(
    (first, second) =>
      second.revenue - first.revenue ||
      second.impressions - first.impressions ||
      first.label.localeCompare(second.label),
  );
}

function isWithinRange(date: Date, filters: ReportDateRange) {
  return date >= filters.start && date <= filters.end;
}

function safeRate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function readDecimalNumber(value: unknown) {
  if (value == null) return 0;

  if (typeof value === "object" && "toNumber" in value) {
    const decimal = value as { toNumber: () => number };
    return decimal.toNumber();
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeDimension(
  value: string | null | undefined,
  fallback: string,
) {
  const normalized = value?.trim();
  return normalized || fallback;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCurrencyValue(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode || "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function csvLine(values: string[]) {
  return values
    .map((value) => {
      if (!/[",\n]/.test(value)) return value;
      return `"${value.replace(/"/g, '""')}"`;
    })
    .join(",");
}
