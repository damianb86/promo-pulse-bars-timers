import type { CSSProperties } from "react";
import { Form, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { EmptyStateCard } from "../components/EmptyStateCard";
import { PlanUpgradeCallout } from "../components/PlanUpgradeCallout";
import prisma from "../db.server";
import { getOrCreateShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import { canUsePremiumFeature } from "../services/premiumFeatures.server";
import {
  getAdvancedReports,
  type AdvancedReports,
  type ReportDevice,
  type ReportMetricRow,
} from "../services/reports/advancedReports.server";
import {
  buildReportCsvHref,
  readReportFilterValues,
  toAdvancedReportFilters,
} from "../services/reports/reportFilters.server";
import { placementTypeOptions } from "../types/campaign-options";
import {
  defaultReportFilterValues,
  type ReportFilterValues,
} from "../types/report-filters";

type CampaignOption = {
  id: string;
  name: string;
};

type ReportsLoaderData = {
  campaignOptions: CampaignOption[];
  csvHref: string;
  filters: ReportFilterValues;
  lockedReason: string;
  report: AdvancedReports | null;
  shopifyDomain: string;
};

const deviceOptions: Array<{ value: "" | ReportDevice; label: string }> = [
  { value: "", label: "All devices" },
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
  { value: "unknown", label: "Unknown" },
];

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<ReportsLoaderData | Response> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const gate = canUsePremiumFeature(shop, "ADVANCED_REPORTING");
  const url = new URL(request.url);
  const filterValues = readReportFilterValues(url);
  const campaignOptions = await loadCampaignOptions(shop.id);

  if (!gate.allowed) {
    return {
      campaignOptions,
      csvHref: buildReportCsvHref(url),
      filters: filterValues,
      lockedReason: gate.reason,
      report: null,
      shopifyDomain: shop.shopifyDomain,
    };
  }

  const report = await getAdvancedReports(
    shop.id,
    toAdvancedReportFilters(filterValues),
  );

  return {
    campaignOptions,
    csvHref: buildReportCsvHref(url),
    filters: filterValues,
    lockedReason: "",
    report,
    shopifyDomain: shop.shopifyDomain,
  };
};

export default function ReportsPage() {
  const data = useLoaderData<typeof loader>() as ReportsLoaderData;
  const report = data.report;

  return (
    <s-page inlineSize="large" heading="Reports">
      <div className="counterpulse-reports-page">
        <section className="counterpulse-reports-hero">
          <div>
            <h1>Advanced reporting</h1>
            <p>
              Compare campaign outcomes across channels, markets, locales,
              campaign types, experiments, and discount-code usage.
            </p>
            <span>{data.shopifyDomain}</span>
          </div>
          <s-badge tone="success">Premium</s-badge>
        </section>

        {data.lockedReason ? (
          <PlanUpgradeCallout
            message={data.lockedReason}
            title="Advanced reporting is locked"
          />
        ) : (
          <>
            <ReportFilters
              campaignOptions={data.campaignOptions}
              csvHref={data.csvHref}
              filters={data.filters}
              marketOptions={
                report?.market.byMarket.map((row) => row.label) ?? []
              }
            />

            {report ? (
              <>
                <SummarySection report={report} />
                <TrendSection report={report} />
                <section className="counterpulse-reports-breakdown-grid">
                  <BreakdownCard
                    heading="Performance by placement"
                    rows={report.placement.rows}
                  />
                  <BreakdownCard
                    heading="Performance by country"
                    rows={report.market.byCountry}
                  />
                  <BreakdownCard
                    heading="Performance by locale"
                    rows={report.market.byLocale}
                  />
                  <BreakdownCard
                    heading="Performance by campaign type"
                    rows={report.revenue.byCampaignType}
                  />
                  <BreakdownCard
                    heading="Performance by experiment variant"
                    rows={report.experiment.rows}
                  />
                  <DiscountCodeCard report={report} />
                </section>
                <WeeklyReportSection report={report} />
              </>
            ) : null}
          </>
        )}
      </div>
    </s-page>
  );
}

function ReportFilters({
  campaignOptions,
  csvHref,
  filters = defaultReportFilterValues(),
  marketOptions,
}: {
  campaignOptions: CampaignOption[];
  csvHref: string;
  filters?: ReportFilterValues;
  marketOptions: string[];
}) {
  const resolvedMarketOptions = Array.from(
    new Set([filters.market, ...marketOptions].filter(Boolean)),
  );

  return (
    <section className="counterpulse-reports-filters">
      <Form method="get" className="counterpulse-reports-filters__form">
        <label className="counterpulse-form-field counterpulse-reports-filters__date">
          <span>Date range</span>
          <div className="counterpulse-reports-date-range">
            <input name="start" type="date" defaultValue={filters.start} />
            <span>to</span>
            <input name="end" type="date" defaultValue={filters.end} />
          </div>
        </label>
        <label className="counterpulse-form-field">
          <span>Campaign</span>
          <select name="campaignId" defaultValue={filters.campaignId}>
            <option value="">All campaigns</option>
            {campaignOptions.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>
        <label className="counterpulse-form-field">
          <span>Placement</span>
          <select name="placement" defaultValue={filters.placement}>
            <option value="">All placements</option>
            {placementTypeOptions.map((placement) => (
              <option key={placement.value} value={placement.value}>
                {placement.label}
              </option>
            ))}
          </select>
        </label>
        <label className="counterpulse-form-field">
          <span>Country</span>
          <input
            name="country"
            maxLength={2}
            placeholder="All countries"
            defaultValue={filters.country}
          />
        </label>
        <label className="counterpulse-form-field">
          <span>Locale</span>
          <input
            name="locale"
            placeholder="All locales"
            defaultValue={filters.locale}
          />
        </label>
        <label className="counterpulse-form-field">
          <span>Market</span>
          <select name="market" defaultValue={filters.market}>
            <option value="">All markets</option>
            {resolvedMarketOptions.map((market) => (
              <option key={market} value={market}>
                {market}
              </option>
            ))}
          </select>
        </label>
        <label className="counterpulse-form-field">
          <span>Device</span>
          <select name="device" defaultValue={filters.device}>
            {deviceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button className="counterpulse-button" type="submit">
          Apply
        </button>
        <a
          className="counterpulse-button-secondary counterpulse-reports-export"
          data-testid="reports-export-csv"
          href={csvHref}
        >
          <span aria-hidden="true" />
          Export CSV
        </a>
      </Form>
    </section>
  );
}

function SummarySection({ report }: { report: AdvancedReports }) {
  const summary = report.revenue.summary;

  return (
    <section
      aria-label="Revenue overview"
      className="counterpulse-reports-metrics"
    >
      <ReportMetricCard
        label="Impressions"
        value={formatNumber(summary.impressions)}
      />
      <ReportMetricCard
        caption={`CTR ${formatPercent(summary.ctr)}`}
        label="Clicks"
        value={formatNumber(summary.clicks)}
      />
      <ReportMetricCard label="Orders" value={formatNumber(summary.orders)} />
      <ReportMetricCard
        label="Revenue"
        value={formatCurrency(summary.revenue, summary.currencyCode)}
      />
      <ReportMetricCard
        caption={`${summary.visitors} visitors`}
        label="Revenue per visitor"
        value={formatCurrency(summary.revenuePerVisitor, summary.currencyCode)}
      />
      <ReportMetricCard
        label="Conversion rate"
        value={formatPercent(summary.conversionRate)}
      />
      <ReportMetricCard
        caption={`${summary.addToCart} ATC events`}
        label="Add-to-cart rate"
        value={formatPercent(summary.addToCartRate)}
      />
      <ReportMetricCard
        caption={`${summary.checkoutStarted} checkouts`}
        label="Checkout started rate"
        value={formatPercent(summary.checkoutStartedRate)}
      />
      <ReportMetricCard
        caption={`${formatPercent(
          report.discountCodes.totals.conversionRate,
        )} used`}
        label="Unique codes"
        value={`${report.discountCodes.totals.used} / ${report.discountCodes.totals.assigned}`}
      />
      <ReportMetricCard
        label="Email timer views"
        value={formatNumber(report.revenue.emailTimerViews)}
      />
    </section>
  );
}

function ReportMetricCard({
  caption = "-",
  label,
  value,
}: {
  caption?: string;
  label: string;
  value: string;
}) {
  return (
    <article className="counterpulse-reports-metric">
      <div>
        <span aria-hidden="true" />
        <p>{label}</p>
      </div>
      <strong>{value}</strong>
      <small>{caption}</small>
    </article>
  );
}

function TrendSection({ report }: { report: AdvancedReports }) {
  return (
    <section className="counterpulse-reports-panel counterpulse-reports-trend">
      <div className="counterpulse-reports-panel__header">
        <div>
          <h2>Performance trend</h2>
          <div className="counterpulse-reports-legend">
            <span>
              <i className="counterpulse-reports-legend__solid" />
              Impressions
            </span>
            <span>
              <i className="counterpulse-reports-legend__dotted" />
              Clicks
            </span>
          </div>
        </div>
        <button className="counterpulse-reports-period" type="button">
          Daily <span aria-hidden="true">v</span>
        </button>
      </div>
      <ReportsTrendChart rows={report.trend.rows} />
    </section>
  );
}

function ReportsTrendChart({
  rows,
}: {
  rows: AdvancedReports["trend"]["rows"];
}) {
  const impressionPoints = getReportChartPoints(
    rows.map((row) => row.impressions),
    900,
    170,
    18,
  );
  const clickPoints = getReportChartPoints(
    rows.map((row) => row.clicks),
    900,
    170,
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
          `M ${impressionPoints[0].x} 202`,
          ...impressionPoints.map((point) => `L ${point.x} ${point.y}`),
          `L ${impressionPoints[impressionPoints.length - 1].x} 202 Z`,
        ].join(" ")
      : "";
  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [row.impressions, row.clicks]),
  );
  const labels = selectTrendLabels(rows);

  return (
    <div className="counterpulse-reports-chart">
      <svg role="img" viewBox="0 0 960 250">
        <title>Performance trend</title>
        <defs>
          <linearGradient id="reportsTrendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#008060" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#008060" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {[18, 74, 130, 186].map((y) => (
          <line
            className="counterpulse-reports-chart__grid"
            key={y}
            x1="44"
            x2="944"
            y1={y}
            y2={y}
          />
        ))}
        {[
          maxValue,
          Math.round(maxValue * 0.66),
          Math.round(maxValue * 0.33),
          0,
        ].map((tick, index) => (
          <text
            className="counterpulse-reports-chart__tick"
            key={`${tick}-${index}`}
            x="8"
            y={24 + index * 56}
          >
            {tick}
          </text>
        ))}
        {areaPath ? <path d={areaPath} fill="url(#reportsTrendFill)" /> : null}
        <polyline
          className="counterpulse-reports-chart__line"
          fill="none"
          points={impressionPath}
        />
        <polyline
          className="counterpulse-reports-chart__line counterpulse-reports-chart__line--clicks"
          fill="none"
          points={clickPath}
        />
        {labels.map((label) => (
          <text
            className="counterpulse-reports-chart__label"
            key={`${label.x}-${label.text}`}
            textAnchor="middle"
            x={label.x}
            y="236"
          >
            {label.text}
          </text>
        ))}
      </svg>
    </div>
  );
}

function BreakdownCard({
  heading,
  rows,
}: {
  heading: string;
  rows: ReportMetricRow[];
}) {
  return (
    <section className="counterpulse-reports-panel">
      <div className="counterpulse-reports-panel__header">
        <h2>{heading}</h2>
      </div>
      {rows.length === 0 ? (
        <EmptyStateCard
          actionHref="/app/campaigns"
          actionLabel="View campaigns"
          message="No matching report data for the selected filters."
          title="No report data"
        />
      ) : (
        <>
          <MetricBars rows={rows.slice(0, 5)} />
          <ReportTable rows={rows} />
          <a className="counterpulse-reports-full-link" href="/app/reports">
            View full report <span aria-hidden="true">{">"}</span>
          </a>
        </>
      )}
    </section>
  );
}

function MetricBars({ rows }: { rows: ReportMetricRow[] }) {
  const maxValue = Math.max(1, ...rows.map((row) => row.impressions));

  return (
    <div className="counterpulse-reports-bars">
      {rows.map((row) => (
        <div className="counterpulse-reports-bar" key={row.key}>
          <span>{row.label}</span>
          <div>
            <i
              style={
                {
                  width: `${Math.max(5, (row.impressions / maxValue) * 100)}%`,
                } as CSSProperties
              }
            />
          </div>
          <strong>{formatNumber(row.impressions)}</strong>
        </div>
      ))}
    </div>
  );
}

function ReportTable({ rows }: { rows: ReportMetricRow[] }) {
  return (
    <div className="counterpulse-reports-table-wrap">
      <table className="counterpulse-table counterpulse-reports-table">
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Impressions</th>
            <th>Clicks</th>
            <th>CTR</th>
            <th>ATC rate</th>
            <th>Orders</th>
            <th>Revenue</th>
            <th>AOV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.label}</td>
              <td>{formatNumber(row.impressions)}</td>
              <td>{formatNumber(row.clicks)}</td>
              <td>{formatPercent(row.ctr)}</td>
              <td>{formatPercent(row.addToCartRate)}</td>
              <td>{formatNumber(row.orders)}</td>
              <td>{formatCurrency(row.revenue, row.currencyCode)}</td>
              <td>{formatCurrency(row.averageOrderValue, row.currencyCode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiscountCodeCard({ report }: { report: AdvancedReports }) {
  return (
    <section className="counterpulse-reports-panel counterpulse-reports-empty-panel">
      <div className="counterpulse-reports-panel__header">
        <h2>Unique discount codes</h2>
      </div>
      {report.discountCodes.rows.length === 0 ? (
        <div className="counterpulse-reports-empty-state">
          <span aria-hidden="true" />
          <h3>No unique-code data</h3>
          <p>No unique-code activity matched the selected filters.</p>
          <a className="counterpulse-button-secondary" href="/app/campaigns">
            View campaigns
          </a>
        </div>
      ) : (
        <div className="counterpulse-reports-table-wrap">
          <table className="counterpulse-table counterpulse-reports-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Assigned</th>
                <th>Used</th>
                <th>Expired</th>
                <th>Use rate</th>
              </tr>
            </thead>
            <tbody>
              {report.discountCodes.rows.map((row) => (
                <tr key={row.campaignId}>
                  <td>{row.campaignName}</td>
                  <td>{formatNumber(row.assigned)}</td>
                  <td>{formatNumber(row.used)}</td>
                  <td>{formatNumber(row.expired)}</td>
                  <td>{formatPercent(row.conversionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function WeeklyReportSection({ report }: { report: AdvancedReports }) {
  return (
    <section className="counterpulse-reports-panel counterpulse-reports-weekly">
      <h2>Weekly report</h2>
      <div className="counterpulse-reports-weekly__content">
        <div className="counterpulse-reports-weekly__icon" aria-hidden="true" />
        <div>
          <h3>{report.weekly.title}</h3>
          <p>{report.weekly.summary}</p>
          <ul>
            {report.weekly.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
          <small>
            Next weekly report will be available on{" "}
            {formatDateKey(addDays(new Date(), 7).toISOString().slice(0, 10))}.
          </small>
        </div>
      </div>
    </section>
  );
}

async function loadCampaignOptions(shopId: string): Promise<CampaignOption[]> {
  return prisma.campaign.findMany({
    where: { shopId },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, name: true },
  });
}

function getReportChartPoints(
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

function selectTrendLabels(rows: AdvancedReports["trend"]["rows"]) {
  if (rows.length === 0) return [];
  const maxLabels = rows.length > 14 ? 7 : rows.length;
  const step = Math.max(1, Math.ceil(rows.length / maxLabels));

  return rows
    .map((row, index) => ({
      index,
      text: formatDateShort(row.date),
      x: 44 + (index / Math.max(rows.length - 1, 1)) * 900,
    }))
    .filter(
      (label, index, labels) =>
        label.index % step === 0 || index === labels.length - 1,
    );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDateShort(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateKey(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode || "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}
