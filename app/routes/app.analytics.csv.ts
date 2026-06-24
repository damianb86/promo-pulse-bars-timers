import type { LoaderFunctionArgs } from "react-router";

import {
  buildAnalyticsByDay,
  getAnalyticsByCampaign,
  getAnalyticsByDay,
  getAnalyticsDeviceBreakdown,
  getShopAnalyticsSummary,
  summarizeAnalyticsEvents,
  type AnalyticsByCampaignRow,
  type AnalyticsByDayRow,
  type AnalyticsDeviceBreakdownRow,
  type AnalyticsSummary,
} from "../models/analytics.server";
import { getShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import { getLockedFeatureReason } from "../services/planLimits.server";

const demoShopDomain = "promo-pulse-demo.myshopify.com";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request);
  const url = new URL(request.url);
  const rangeDays = readRangeDays(url.searchParams.get("range"));
  const liveShop = await getShopByDomain(session.shop);
  const demoShop =
    !liveShop && process.env.NODE_ENV !== "production"
      ? await getShopByDomain(demoShopDomain)
      : null;
  const shop = liveShop ?? demoShop;

  if (!shop) {
    return analyticsCsvResponse(
      buildAnalyticsCsv({
        byCampaign: [],
        byDay: buildAnalyticsByDay([], rangeDays),
        deviceBreakdown: getEmptyDeviceBreakdown(),
        rangeDays,
        summary: summarizeAnalyticsEvents([]),
      }),
      rangeDays,
    );
  }

  const lockedAnalyticsReason = getLockedFeatureReason(
    shop,
    "advanced_analytics",
  );

  if (lockedAnalyticsReason) {
    return new Response(lockedAnalyticsReason, {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const [summary, byCampaign, byDay, deviceBreakdown] = await Promise.all([
    getShopAnalyticsSummary(shop.id, { days: rangeDays }),
    getAnalyticsByCampaign(shop.id, { days: rangeDays }),
    getAnalyticsByDay(shop.id, { days: rangeDays }),
    getAnalyticsDeviceBreakdown(shop.id, { days: rangeDays }),
  ]);

  return analyticsCsvResponse(
    buildAnalyticsCsv({
      byCampaign,
      byDay,
      deviceBreakdown,
      rangeDays,
      summary,
    }),
    rangeDays,
  );
};

function analyticsCsvResponse(csv: string, rangeDays: 7 | 30 | 90) {
  return new Response(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="promo-pulse-analytics-${rangeDays}-days.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

function buildAnalyticsCsv({
  byCampaign,
  byDay,
  deviceBreakdown,
  rangeDays,
  summary,
}: {
  byCampaign: AnalyticsByCampaignRow[];
  byDay: AnalyticsByDayRow[];
  deviceBreakdown: AnalyticsDeviceBreakdownRow[];
  rangeDays: 7 | 30 | 90;
  summary: AnalyticsSummary;
}) {
  const rows: string[][] = [
    ["Section", "Name", "Metric", "Value"],
    ["Summary", `${rangeDays} days`, "Impressions", String(summary.impressions)],
    ["Summary", `${rangeDays} days`, "Clicks", String(summary.clicks)],
    ["Summary", `${rangeDays} days`, "CTR", formatPercent(summary.ctr)],
    ["Summary", `${rangeDays} days`, "Add to cart", String(summary.addToCart)],
    [
      "Summary",
      `${rangeDays} days`,
      "Checkout started",
      String(summary.checkoutStarted),
    ],
    ["Summary", `${rangeDays} days`, "Orders", String(summary.ordersAttributed)],
    [
      "Summary",
      `${rangeDays} days`,
      "Revenue",
      formatCurrency(summary.revenueAttributed, summary.currencyCode),
    ],
    [],
    [
      "Campaign",
      "Type",
      "Impressions",
      "Clicks",
      "CTR",
      "Copy code",
      "Add to cart",
      "Checkout",
      "Revenue",
    ],
    ...byCampaign.map((row) => [
      row.campaignName,
      formatEnum(row.campaignType),
      String(row.impressions),
      String(row.clicks),
      formatPercent(row.ctr),
      String(row.copyCode),
      String(row.addToCart),
      String(row.checkoutStarted),
      formatCurrency(row.revenueAttributed, row.currencyCode),
    ]),
    [],
    ["Date", "Impressions", "Clicks", "CTR", "Revenue"],
    ...byDay.map((row) => [
      row.date,
      String(row.impressions),
      String(row.clicks),
      formatPercent(row.ctr),
      formatCurrency(row.revenueAttributed, row.currencyCode),
    ]),
    [],
    ["Device", "Impressions", "Share"],
    ...deviceBreakdown.map((row) => [
      row.device,
      String(row.impressions),
      formatPercent(row.percentage),
    ]),
  ];

  return `${rows.map(csvLine).join("\n")}\n`;
}

function csvLine(values: string[]) {
  return values
    .map((value) => {
      const text = String(value ?? "");

      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    })
    .join(",");
}

function readRangeDays(value: string | null): 7 | 30 | 90 {
  if (value === "90") return 90;
  if (value === "30") return 30;
  return 7;
}

function getEmptyDeviceBreakdown(): AnalyticsDeviceBreakdownRow[] {
  return [
    { device: "Desktop", impressions: 0, percentage: 0 },
    { device: "Mobile", impressions: 0, percentage: 0 },
    { device: "Tablet", impressions: 0, percentage: 0 },
  ];
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode || "USD",
  }).format(value);
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
