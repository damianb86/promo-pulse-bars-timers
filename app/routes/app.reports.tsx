import { type CSSProperties, type FormEvent, useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { EmptyStateCard } from "../components/EmptyStateCard";
import { AppAlert } from "../components/Notifications";
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
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const summary = report?.revenue.summary;

  const handleExport = async () => {
    setIsExporting(true);
    setExportError("");

    try {
      const response = await fetch(data.csvHref, {
        credentials: "include",
        headers: { Accept: "text/csv" },
      });

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = "promo-pulse-report.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Failed to export Promo Pulse reports", error);
      setExportError("Report export failed. Try again in a moment.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <s-page inlineSize="large">
      <div className="counterpulse-campaigns-layout counterpulse-reports-page">
        {exportError && (
          <AppAlert tone="critical" title="Reports need attention">
            <s-paragraph>{exportError}</s-paragraph>
          </AppAlert>
        )}

        <div className="counterpulse-campaigns-header counterpulse-reports-page-header">
          <div>
            <p className="counterpulse-kicker">Reporting workspace</p>
            <s-heading>Reports</s-heading>
            <s-paragraph>
              Compare campaign outcomes across channels, markets, locales,
              campaign types, experiments, and discount-code usage.
            </s-paragraph>
            <div className="counterpulse-campaigns-header__meta">
              <span>Advanced reporting</span>
              <span>
                {summary ? formatNumber(summary.impressions) : 0} impressions
              </span>
              <span>
                {summary
                  ? formatCurrency(summary.revenue, summary.currencyCode)
                  : "$0.00"}{" "}
                revenue
              </span>
            </div>
          </div>
          {!data.lockedReason && (
            <div className="counterpulse-campaigns-header__actions">
              <button
                className="counterpulse-button-secondary counterpulse-reports-export"
                data-export-href={data.csvHref}
                data-testid="reports-export-csv"
                disabled={isExporting}
                type="button"
                onClick={handleExport}
              >
                <CsvDownloadIcon />
                {isExporting ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          )}
        </div>

        {data.lockedReason ? (
          <PlanUpgradeCallout
            message={data.lockedReason}
            title="Advanced reporting is locked"
          />
        ) : (
          <>
            <ReportFilters
              campaignOptions={data.campaignOptions}
              filters={data.filters}
              marketOptions={
                report?.market.byMarket.map((row) => row.label) ?? []
              }
            />

            {report ? (
              <>
                <SummarySection report={report} />
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
  filters = defaultReportFilterValues(),
  marketOptions,
}: {
  campaignOptions: CampaignOption[];
  filters?: ReportFilterValues;
  marketOptions: string[];
}) {
  const navigate = useNavigate();
  const resolvedMarketOptions = Array.from(
    new Set([filters.market, ...marketOptions].filter(Boolean)),
  );
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    [
      "start",
      "end",
      "campaignId",
      "placement",
      "country",
      "locale",
      "market",
      "device",
    ].forEach((fieldName) => {
      const value = String(formData.get(fieldName) ?? "").trim();

      if (value) {
        params.set(fieldName, value);
      }
    });

    navigate(params.toString() ? `?${params.toString()}` : "/app/reports");
  };

  return (
    <section className="counterpulse-reports-filters">
      <form
        className="counterpulse-reports-filters__form"
        method="get"
        onSubmit={handleSubmit}
      >
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
      </form>
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
        icon="impressions"
        label="Impressions"
        value={formatNumber(summary.impressions)}
      />
      <ReportMetricCard
        caption={`CTR ${formatPercent(summary.ctr)}`}
        icon="clicks"
        label="Clicks"
        value={formatNumber(summary.clicks)}
      />
      <ReportMetricCard
        icon="orders"
        label="Orders"
        value={formatNumber(summary.orders)}
      />
      <ReportMetricCard
        icon="revenue"
        label="Revenue"
        value={formatCurrency(summary.revenue, summary.currencyCode)}
      />
      <ReportMetricCard
        caption={`${summary.visitors} visitors`}
        icon="visitor"
        label="Revenue per visitor"
        value={formatCurrency(summary.revenuePerVisitor, summary.currencyCode)}
      />
      <ReportMetricCard
        icon="conversion"
        label="Conversion rate"
        value={formatPercent(summary.conversionRate)}
      />
      <ReportMetricCard
        caption={`${summary.addToCart} ATC events`}
        icon="cart"
        label="Add-to-cart rate"
        value={formatPercent(summary.addToCartRate)}
      />
      <ReportMetricCard
        caption={`${summary.checkoutStarted} checkouts`}
        icon="checkout"
        label="Checkout started rate"
        value={formatPercent(summary.checkoutStartedRate)}
      />
      <ReportMetricCard
        caption={`${formatPercent(
          report.discountCodes.totals.conversionRate,
        )} used`}
        icon="discount"
        label="Unique codes"
        value={`${report.discountCodes.totals.used} / ${report.discountCodes.totals.assigned}`}
      />
      <ReportMetricCard
        icon="email"
        label="Email timer views"
        value={formatNumber(report.revenue.emailTimerViews)}
      />
    </section>
  );
}

function ReportMetricCard({
  caption = "-",
  icon,
  label,
  value,
}: {
  caption?: string;
  icon: ReportMetricIconType;
  label: string;
  value: string;
}) {
  return (
    <article className="counterpulse-reports-metric">
      <div>
        <span
          aria-hidden="true"
          className={`counterpulse-reports-metric__icon counterpulse-reports-metric__icon--${icon}`}
        >
          <ReportMetricIcon icon={icon} />
        </span>
        <p>{label}</p>
      </div>
      <strong>{value}</strong>
      <small>{caption}</small>
    </article>
  );
}

type ReportMetricIconType =
  | "impressions"
  | "clicks"
  | "orders"
  | "revenue"
  | "visitor"
  | "conversion"
  | "cart"
  | "checkout"
  | "discount"
  | "email";

function ReportMetricIcon({ icon }: { icon: ReportMetricIconType }) {
  if (icon === "impressions") {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path d="M2.5 10s2.7-4.5 7.5-4.5S17.5 10 17.5 10s-2.7 4.5-7.5 4.5S2.5 10 2.5 10Z" />
        <circle cx="10" cy="10" r="2.2" />
      </svg>
    );
  }

  if (icon === "clicks") {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path d="M6 2.8 14.6 10l-4.1.9 2.2 4.6-2.2 1-2.1-4.6-2.4 3Z" />
      </svg>
    );
  }

  if (icon === "orders") {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path d="M5 6.5h10l-1 10H6z" />
        <path d="M7.4 6.5a2.6 2.6 0 1 1 5.2 0" fill="none" />
      </svg>
    );
  }

  if (icon === "revenue") {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 5.8v8.4M12.4 7.3H8.9a1.5 1.5 0 0 0 0 3h2.2a1.5 1.5 0 0 1 0 3H7.6" />
      </svg>
    );
  }

  if (icon === "visitor") {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <circle cx="10" cy="7" r="3" />
        <path d="M4.8 16.2c.8-2.7 2.5-4 5.2-4s4.4 1.3 5.2 4" />
      </svg>
    );
  }

  if (icon === "conversion") {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path d="M4 11.5 8 15l8-9" />
        <path d="M4 5.5h7" />
      </svg>
    );
  }

  if (icon === "cart") {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path d="M3 4h2l1.4 8.2h7.8L16 6.5H6" />
        <circle cx="8" cy="15.5" r="1.2" />
        <circle cx="14" cy="15.5" r="1.2" />
      </svg>
    );
  }

  if (icon === "checkout") {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <rect x="4" y="5" width="12" height="10" rx="2" />
        <path d="M7 9h6M7 12h4" />
      </svg>
    );
  }

  if (icon === "discount") {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path d="M3.8 8.4V4.8h3.6l8.8 8.8-3.6 3.6z" />
        <circle cx="6.8" cy="6.8" r="1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" focusable="false">
      <rect x="4" y="5" width="12" height="10" rx="2" />
      <path d="M4.5 6.2 10 10l5.5-3.8" />
    </svg>
  );
}

function CsvDownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="counterpulse-reports-export__icon"
      focusable="false"
      viewBox="0 0 20 20"
    >
      <path
        d="M5.5 2.75h6.1L15 6.15v11.1H5.5z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M11.5 2.95v3.4h3.25"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M10.25 7.75v5.1m0 0 2.05-2.05m-2.05 2.05L8.2 10.8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M7.6 15.2h5.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
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
          <Link className="counterpulse-button-secondary" to="/app/campaigns">
            View campaigns
          </Link>
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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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
