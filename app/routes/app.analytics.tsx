import type { CSSProperties } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { AppAlert } from "../components/Notifications";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { EmptyStateCard } from "../components/EmptyStateCard";
import { PlanUpgradeCallout } from "../components/PlanUpgradeCallout";
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

type LoaderData = {
  summary: AnalyticsSummary;
  byCampaign: AnalyticsByCampaignRow[];
  byDay: AnalyticsByDayRow[];
  deviceBreakdown: AnalyticsDeviceBreakdownRow[];
  rangeDays: 7 | 30 | 90;
  shopifyDomain: string | null;
  dataSource: "shop" | "demo" | "empty";
  error: string | null;
  lockedAnalyticsReason: string;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticateAdmin(request);
  const url = new URL(request.url);
  const rangeDays = readRangeDays(url.searchParams.get("range"));

  try {
    const liveShop = await getShopByDomain(session.shop);
    const demoShop =
      !liveShop && process.env.NODE_ENV !== "production"
        ? await getShopByDomain(demoShopDomain)
        : null;
    const shop = liveShop ?? demoShop;

    if (!shop) {
      return {
        summary: summarizeAnalyticsEvents([]),
        byCampaign: [],
        byDay: buildAnalyticsByDay([], rangeDays),
        deviceBreakdown: getEmptyDeviceBreakdown(),
        rangeDays,
        shopifyDomain: session.shop,
        dataSource: "empty",
        error: null,
        lockedAnalyticsReason: "",
      };
    }

    const lockedAnalyticsReason = getLockedFeatureReason(
      shop,
      "advanced_analytics",
    );

    if (lockedAnalyticsReason) {
      return {
        summary: summarizeAnalyticsEvents([]),
        byCampaign: [],
        byDay: buildAnalyticsByDay([], rangeDays),
        deviceBreakdown: getEmptyDeviceBreakdown(),
        rangeDays,
        shopifyDomain: shop.shopifyDomain,
        dataSource: liveShop ? "shop" : "demo",
        error: null,
        lockedAnalyticsReason,
      };
    }

    const [summary, byCampaign, byDay, deviceBreakdown] = await Promise.all([
      getShopAnalyticsSummary(shop.id, { days: rangeDays }),
      getAnalyticsByCampaign(shop.id, { days: rangeDays }),
      getAnalyticsByDay(shop.id, { days: rangeDays }),
      getAnalyticsDeviceBreakdown(shop.id, { days: rangeDays }),
    ]);

    return {
      summary,
      byCampaign,
      byDay,
      deviceBreakdown,
      rangeDays,
      shopifyDomain: shop.shopifyDomain,
      dataSource: liveShop ? "shop" : "demo",
      error: null,
      lockedAnalyticsReason,
    };
  } catch (error) {
    console.error("Failed to load Promo Pulse analytics", error);

    return {
      summary: summarizeAnalyticsEvents([]),
      byCampaign: [],
      byDay: buildAnalyticsByDay([], rangeDays),
      deviceBreakdown: getEmptyDeviceBreakdown(),
      rangeDays,
      shopifyDomain: session.shop,
      dataSource: "empty",
      error:
        "Analytics data is unavailable. Check that Prisma migrations have been applied.",
      lockedAnalyticsReason: "",
    };
  }
};

export default function AnalyticsPage() {
  const {
    summary,
    byCampaign,
    byDay,
    deviceBreakdown,
    rangeDays,
    shopifyDomain,
    dataSource,
    error,
    lockedAnalyticsReason,
  } = useLoaderData<typeof loader>();
  const revenue = formatCurrency(
    summary.revenueAttributed,
    summary.currencyCode,
  );
  const previousRangeLabel = `vs previous ${rangeDays} days`;
  const rangeLabel = formatDateRangeLabel(byDay);
  const latestInsight = getLatestInsight(byDay);
  const dailyTrendRows = [...byDay].reverse();

  return (
    <s-page inlineSize="large" heading="Analytics">
      {error && (
        <AppAlert tone="critical" title="Analytics need attention">
          <s-paragraph>{error}</s-paragraph>
        </AppAlert>
      )}

      {lockedAnalyticsReason && (
        <PlanUpgradeCallout
          message={lockedAnalyticsReason}
          title="Analytics are locked"
        />
      )}

      <s-section>
        <div className="counterpulse-analytics-header">
          <div>
            <p>Track performance and engagement across your promotions.</p>
            <span className="counterpulse-analytics-header__shop">
              {shopifyDomain ?? "No shop connected yet"}
            </span>
          </div>
          <div className="counterpulse-analytics-header__badges">
            {dataSource === "demo" && (
              <s-badge tone="info">Development demo data</s-badge>
            )}
          </div>
        </div>
      </s-section>

      {!lockedAnalyticsReason && (
        <div
          className="counterpulse-analytics-dashboard"
          data-testid="analytics-dashboard"
        >
          <section className="counterpulse-analytics-toolbar">
            <div
              aria-label="Analytics date range"
              className="counterpulse-analytics-range-tabs"
            >
              {[7, 30, 90].map((days) => (
                <a
                  aria-current={rangeDays === days ? "page" : undefined}
                  className={rangeDays === days ? "is-active" : ""}
                  href={`/app/analytics?range=${days}`}
                  key={days}
                >
                  {days} days
                </a>
              ))}
            </div>
            <button
              className="counterpulse-analytics-date-button"
              type="button"
            >
              <span
                aria-hidden="true"
                className="counterpulse-analytics-date-button__icon"
              />
              {rangeLabel}
              <span aria-hidden="true">v</span>
            </button>
            <a
              className="counterpulse-analytics-export"
              href="/app/reports/csv"
            >
              <span
                aria-hidden="true"
                className="counterpulse-analytics-export__icon"
              />
              Export
            </a>
          </section>

          <section className="counterpulse-analytics-metric-grid">
            <AnalyticsMetricCard
              accent
              label="Impressions"
              previousLabel={previousRangeLabel}
              sparkline={byDay.map((row) => row.impressions)}
              value={formatNumber(summary.impressions)}
            />
            <AnalyticsMetricCard
              label="Clicks"
              previousLabel={previousRangeLabel}
              value={formatNumber(summary.clicks)}
            />
            <AnalyticsMetricCard
              label="CTR"
              previousLabel={previousRangeLabel}
              value={formatPercent(summary.ctr)}
            />
            <AnalyticsMetricCard
              label="Add to cart"
              previousLabel={previousRangeLabel}
              value={formatNumber(summary.addToCart)}
            />
            <AnalyticsMetricCard
              label="Checkout started"
              previousLabel={previousRangeLabel}
              value={formatNumber(summary.checkoutStarted)}
            />
            <AnalyticsMetricCard
              label="Coupon copies"
              previousLabel={previousRangeLabel}
              value={formatNumber(summary.copyCode)}
            />
            <AnalyticsMetricCard
              accent
              icon="$"
              label="Attributed revenue"
              previousLabel={previousRangeLabel}
              value={revenue}
            />
          </section>

          <section className="counterpulse-analytics-chart-grid">
            <article className="counterpulse-analytics-card counterpulse-analytics-card--wide">
              <div className="counterpulse-analytics-card__header">
                <div>
                  <h2>Performance over time</h2>
                  <div className="counterpulse-analytics-legend">
                    <span>
                      <i className="counterpulse-analytics-legend__solid" />
                      Impressions
                    </span>
                    <span>
                      <i className="counterpulse-analytics-legend__dashed" />
                      Clicks
                    </span>
                  </div>
                </div>
                <button
                  className="counterpulse-analytics-period-button"
                  type="button"
                >
                  Daily <span aria-hidden="true">v</span>
                </button>
              </div>
              <PerformanceChart rows={byDay} />
              <p className="counterpulse-analytics-insight">
                <span aria-hidden="true" />
                {latestInsight}
              </p>
            </article>

            <article className="counterpulse-analytics-card">
              <div className="counterpulse-analytics-card__header">
                <h2>Traffic by device</h2>
              </div>
              <DeviceBreakdown rows={deviceBreakdown} />
              <p className="counterpulse-analytics-card__caption">
                Based on impressions
              </p>
            </article>
          </section>

          <section className="counterpulse-analytics-table-grid">
            <article className="counterpulse-analytics-card">
              <div className="counterpulse-analytics-card__header">
                <h2>Campaign performance</h2>
              </div>
              {byCampaign.length === 0 ? (
                <EmptyStateCard
                  title="No analytics events yet"
                  message="Events will appear here after the theme embed renders campaigns or after test events are posted to the analytics endpoint."
                  actionLabel="View campaigns"
                  actionHref="/app/campaigns"
                />
              ) : (
                <div className="counterpulse-analytics-table-wrap">
                  <table className="counterpulse-table counterpulse-analytics-table">
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th>Type</th>
                        <th>Impressions</th>
                        <th>Clicks</th>
                        <th>CTR</th>
                        <th>Copy code</th>
                        <th>Add to cart</th>
                        <th>Checkout</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byCampaign.map((row) => (
                        <tr key={row.campaignId}>
                          <td>
                            <strong>{row.campaignName}</strong>
                          </td>
                          <td>{formatEnum(row.campaignType)}</td>
                          <td>{formatNumber(row.impressions)}</td>
                          <td>{formatNumber(row.clicks)}</td>
                          <td>{formatPercent(row.ctr)}</td>
                          <td>{formatNumber(row.copyCode)}</td>
                          <td>{formatNumber(row.addToCart)}</td>
                          <td>{formatNumber(row.checkoutStarted)}</td>
                          <td>
                            {formatCurrency(
                              row.revenueAttributed,
                              row.currencyCode,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="counterpulse-analytics-table-footnote">
                Showing {byCampaign.length} of {byCampaign.length} campaigns
              </p>
            </article>

            <article className="counterpulse-analytics-card">
              <div className="counterpulse-analytics-card__header">
                <h2>Daily trend</h2>
              </div>
              <div className="counterpulse-analytics-table-wrap">
                <table className="counterpulse-table counterpulse-analytics-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Impressions</th>
                      <th>Clicks</th>
                      <th>CTR</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyTrendRows.map((row) => (
                      <tr key={row.date}>
                        <td>{formatDateKey(row.date)}</td>
                        <td>{formatNumber(row.impressions)}</td>
                        <td>{formatNumber(row.clicks)}</td>
                        <td>{formatPercent(row.ctr)}</td>
                        <td>
                          {formatCurrency(
                            row.revenueAttributed,
                            row.currencyCode,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="counterpulse-analytics-table-footnote">
                Showing {byDay.length} of {byDay.length} days
              </p>
            </article>
          </section>
        </div>
      )}
    </s-page>
  );
}

function AnalyticsMetricCard({
  accent = false,
  icon,
  label,
  previousLabel,
  sparkline,
  value,
}: {
  accent?: boolean;
  icon?: string;
  label: string;
  previousLabel: string;
  sparkline?: number[];
  value: string;
}) {
  return (
    <article
      className={
        accent
          ? "counterpulse-analytics-metric is-accent"
          : "counterpulse-analytics-metric"
      }
    >
      <div className="counterpulse-analytics-metric__header">
        <span>{label}</span>
        <span aria-hidden="true" className="counterpulse-analytics-info">
          i
        </span>
      </div>
      <strong>{value}</strong>
      <div className="counterpulse-analytics-metric__meta">
        <span aria-hidden="true">-</span>
        {previousLabel}
      </div>
      {sparkline ? <Sparkline values={sparkline} /> : null}
      {icon ? (
        <span
          className="counterpulse-analytics-metric__icon"
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
    </article>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const points = getSparklinePoints(values, 92, 34, 4);
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <svg
      aria-hidden="true"
      className="counterpulse-analytics-sparkline"
      viewBox="0 0 100 42"
    >
      <polyline
        fill="none"
        points={path}
        stroke="currentColor"
        strokeWidth="3"
      />
    </svg>
  );
}

function PerformanceChart({ rows }: { rows: AnalyticsByDayRow[] }) {
  const impressionPoints = getChartPoints(
    rows.map((row) => row.impressions),
    860,
    210,
    18,
  );
  const clickPoints = getChartPoints(
    rows.map((row) => row.clicks),
    860,
    210,
    18,
  );
  const impressionPath = impressionPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const clickPath = clickPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const areaPath =
    impressionPoints.length > 0
      ? [
          `M ${impressionPoints[0].x} 228`,
          ...impressionPoints.map((point) => `L ${point.x} ${point.y}`),
          `L ${impressionPoints[impressionPoints.length - 1].x} 228 Z`,
        ].join(" ")
      : "";
  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [row.impressions, row.clicks]),
  );
  const yTicks = [
    maxValue,
    Math.round(maxValue * 0.66),
    Math.round(maxValue * 0.33),
    0,
  ];
  const xLabels = selectChartLabels(rows);

  return (
    <div className="counterpulse-analytics-chart">
      <svg role="img" viewBox="0 0 920 270">
        <title>Performance over time</title>
        <defs>
          <linearGradient id="analyticsChartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#32b978" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#32b978" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[18, 88, 158, 228].map((y) => (
          <line
            className="counterpulse-analytics-chart__grid"
            key={y}
            x1="44"
            x2="904"
            y1={y}
            y2={y}
          />
        ))}
        {yTicks.map((tick, index) => (
          <text
            className="counterpulse-analytics-chart__tick"
            key={`${tick}-${index}`}
            x="10"
            y={24 + index * 70}
          >
            {tick}
          </text>
        ))}
        {areaPath ? (
          <path d={areaPath} fill="url(#analyticsChartFill)" />
        ) : null}
        <polyline
          className="counterpulse-analytics-chart__line"
          fill="none"
          points={impressionPath}
        />
        <polyline
          className="counterpulse-analytics-chart__line counterpulse-analytics-chart__line--clicks"
          fill="none"
          points={clickPath}
        />
        {impressionPoints.map((point, index) => (
          <circle
            className="counterpulse-analytics-chart__dot"
            cx={point.x}
            cy={point.y}
            key={`${point.x}-${index}`}
            r="5"
          />
        ))}
        {xLabels.map((label) => (
          <text
            className="counterpulse-analytics-chart__label"
            key={`${label.x}-${label.text}`}
            textAnchor="middle"
            x={label.x}
            y="258"
          >
            {label.text}
          </text>
        ))}
      </svg>
    </div>
  );
}

function DeviceBreakdown({ rows }: { rows: AnalyticsDeviceBreakdownRow[] }) {
  const desktop = rows.find((row) => row.device === "Desktop") ?? rows[0];
  const mobile = rows.find((row) => row.device === "Mobile");
  const totalImpressions = rows.reduce(
    (total, row) => total + row.impressions,
    0,
  );
  const desktopPercent = desktop ? Math.round(desktop.percentage * 100) : 0;
  const mobilePercent = mobile ? Math.round(mobile.percentage * 100) : 0;
  const donutStyle = {
    "--desktop": `${desktopPercent}%`,
    "--mobile": `${desktopPercent + mobilePercent}%`,
  } as CSSProperties;
  const dominant =
    rows.reduce(
      (current, row) => (row.impressions > current.impressions ? row : current),
      rows[0] ?? { device: "Desktop", impressions: 0, percentage: 0 },
    ) ?? rows[0];

  return (
    <div className="counterpulse-analytics-device">
      <div
        className={
          totalImpressions === 0
            ? "counterpulse-analytics-device__donut is-empty"
            : "counterpulse-analytics-device__donut"
        }
        style={donutStyle}
      >
        <strong>{Math.round((dominant?.percentage ?? 0) * 100)}%</strong>
        <span>{dominant?.device ?? "Desktop"}</span>
      </div>
      <dl>
        {rows.map((row) => (
          <div key={row.device}>
            <dt>
              <span
                className={`counterpulse-analytics-device__dot counterpulse-analytics-device__dot--${row.device.toLowerCase()}`}
                aria-hidden="true"
              />
              {row.device}
            </dt>
            <dd>{Math.round(row.percentage * 100)}%</dd>
            <dd>{formatNumber(row.impressions)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function getChartPoints(
  values: number[],
  width: number,
  height: number,
  offset: number,
) {
  const maxValue = Math.max(1, ...values);
  const denominator = Math.max(values.length - 1, 1);

  return values.map((value, index) => ({
    x: 44 + (index / denominator) * width,
    y: offset + (1 - value / maxValue) * height,
  }));
}

function getSparklinePoints(
  values: number[],
  width: number,
  height: number,
  offset: number,
) {
  const maxValue = Math.max(1, ...values);
  const denominator = Math.max(values.length - 1, 1);

  return values.map((value, index) => ({
    x: 4 + (index / denominator) * width,
    y: offset + (1 - value / maxValue) * height,
  }));
}

function selectChartLabels(rows: AnalyticsByDayRow[]) {
  if (rows.length === 0) return [];
  const maxLabels = rows.length > 30 ? 6 : 7;
  const step = Math.max(1, Math.ceil(rows.length / maxLabels));

  return rows
    .map((row, index) => ({
      index,
      text: formatDateShort(row.date),
      x: 44 + (index / Math.max(rows.length - 1, 1)) * 860,
    }))
    .filter(
      (label, index, labels) =>
        label.index % step === 0 || index === labels.length - 1,
    );
}

function getLatestInsight(rows: AnalyticsByDayRow[]) {
  const latest = [...rows].reverse().find((row) => row.impressions > 0);

  if (!latest) return "No impressions recorded in this period yet.";

  return `Impressions increased on ${formatDateShort(latest.date)}`;
}

function formatDateRangeLabel(rows: AnalyticsByDayRow[]) {
  if (rows.length === 0) return "No date range";

  return `${formatDateShort(rows[0].date)} - ${formatDateKey(rows[rows.length - 1].date)}`;
}

function formatDateKey(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateShort(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

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
