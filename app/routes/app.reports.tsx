import { Form, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { PlacementType } from "@prisma/client";

import { EmptyStateCard } from "../components/EmptyStateCard";
import { PlanUpgradeCallout } from "../components/PlanUpgradeCallout";
import { StatCard } from "../components/StatCard";
import prisma from "../db.server";
import { getOrCreateShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
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
import { canUsePremiumFeature } from "../services/premiumFeatures.server";
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
    <s-page heading="Reports">
      <s-section>
        <div className="counterpulse-dashboard-header">
          <div>
            <s-heading>Advanced reporting</s-heading>
            <s-paragraph>
              Compare campaign outcomes by channel, market, locale, campaign
              type, experiment variant, and discount-code usage.
            </s-paragraph>
            <div className="counterpulse-muted">{data.shopifyDomain}</div>
          </div>
          <div className="counterpulse-dashboard-header__badges">
            <s-badge tone="info">Premium</s-badge>
          </div>
        </div>
      </s-section>

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
              <BreakdownSection
                heading="Performance by placement"
                rows={report.placement.rows}
              />
              <BreakdownSection
                heading="Performance by country"
                rows={report.market.byCountry}
              />
              <BreakdownSection
                heading="Performance by locale"
                rows={report.market.byLocale}
              />
              <BreakdownSection
                heading="Performance by market"
                rows={report.market.byMarket}
              />
              <BreakdownSection
                heading="Performance by campaign type"
                rows={report.revenue.byCampaignType}
              />
              <BreakdownSection
                heading="Performance by experiment variant"
                rows={report.experiment.rows}
              />
              <DiscountCodeSection report={report} />
              <WeeklyReportSection report={report} />
            </>
          ) : null}
        </>
      )}
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
    <s-section heading="Filters">
      <Form method="get" className="counterpulse-toolbar">
        <label>
          <span>Start date</span>
          <input name="start" type="date" defaultValue={filters.start} />
        </label>
        <label>
          <span>End date</span>
          <input name="end" type="date" defaultValue={filters.end} />
        </label>
        <label>
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
        <label>
          <span>Placement</span>
          <select name="placement" defaultValue={filters.placement}>
            <option value="">All placements</option>
            {Object.values(PlacementType).map((placement) => (
              <option key={placement} value={placement}>
                {formatEnum(placement)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Country</span>
          <input name="country" maxLength={2} defaultValue={filters.country} />
        </label>
        <label>
          <span>Locale</span>
          <input name="locale" defaultValue={filters.locale} />
        </label>
        <label>
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
        <label>
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
          className="counterpulse-button-secondary"
          data-testid="reports-export-csv"
          href={csvHref}
        >
          Export CSV
        </a>
      </Form>
    </s-section>
  );
}

function SummarySection({ report }: { report: AdvancedReports }) {
  const summary = report.revenue.summary;

  return (
    <s-section heading="Revenue overview">
      <div className="counterpulse-stat-grid">
        <StatCard label="Impressions" value={summary.impressions} />
        <StatCard
          label="Clicks"
          value={summary.clicks}
          caption={`CTR ${formatPercent(summary.ctr)}`}
        />
        <StatCard
          label="Add-to-cart rate"
          value={formatPercent(summary.addToCartRate)}
          caption={`${summary.addToCart} add-to-cart events`}
        />
        <StatCard
          label="Checkout started rate"
          value={formatPercent(summary.checkoutStartedRate)}
          caption={`${summary.checkoutStarted} checkout starts`}
        />
        <StatCard label="Orders" value={summary.orders} />
        <StatCard
          label="Revenue"
          value={formatCurrency(summary.revenue, summary.currencyCode)}
          caption={`AOV ${formatCurrency(
            summary.averageOrderValue,
            summary.currencyCode,
          )}`}
        />
        <StatCard
          label="Revenue per visitor"
          value={formatCurrency(
            summary.revenuePerVisitor,
            summary.currencyCode,
          )}
          caption={`${summary.visitors} visitors`}
        />
        <StatCard
          label="Conversion rate"
          value={formatPercent(summary.conversionRate)}
        />
        <StatCard
          label="Unique codes"
          value={`${report.discountCodes.totals.used}/${report.discountCodes.totals.assigned}`}
          caption={`${formatPercent(
            report.discountCodes.totals.conversionRate,
          )} used`}
        />
        <StatCard
          label="Email timer views"
          value={report.revenue.emailTimerViews}
        />
      </div>
    </s-section>
  );
}

function BreakdownSection({
  heading,
  rows,
}: {
  heading: string;
  rows: ReportMetricRow[];
}) {
  const maxRevenue = Math.max(0, ...rows.map((row) => row.revenue));

  return (
    <s-section heading={heading}>
      {rows.length === 0 ? (
        <EmptyStateCard
          actionHref="/app/campaigns"
          actionLabel="View campaigns"
          message="No matching report data for the selected filters."
          title="No report data"
        />
      ) : (
        <>
          <MetricBars rows={rows.slice(0, 6)} />
          <table className="counterpulse-table">
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>CTR</th>
                <th>ATC rate</th>
                <th>Checkout rate</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>RPV</th>
                <th>CVR</th>
                <th>AOV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <div>{row.label}</div>
                    {maxRevenue > 0 && (
                      <div className="counterpulse-report-meter">
                        <div
                          className="counterpulse-report-meter__fill"
                          style={{
                            width: `${Math.max(
                              4,
                              (row.revenue / maxRevenue) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </td>
                  <td>{row.impressions}</td>
                  <td>{row.clicks}</td>
                  <td>{formatPercent(row.ctr)}</td>
                  <td>{formatPercent(row.addToCartRate)}</td>
                  <td>{formatPercent(row.checkoutStartedRate)}</td>
                  <td>{row.orders}</td>
                  <td>{formatCurrency(row.revenue, row.currencyCode)}</td>
                  <td>
                    {formatCurrency(row.revenuePerVisitor, row.currencyCode)}
                  </td>
                  <td>{formatPercent(row.conversionRate)}</td>
                  <td>
                    {formatCurrency(row.averageOrderValue, row.currencyCode)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </s-section>
  );
}

function MetricBars({ rows }: { rows: ReportMetricRow[] }) {
  const maxValue = Math.max(1, ...rows.map((row) => row.revenue));

  return (
    <div className="counterpulse-report-bars">
      {rows.map((row) => (
        <div className="counterpulse-report-bar" key={row.key}>
          <div className="counterpulse-report-bar__label">{row.label}</div>
          <div className="counterpulse-report-bar__track">
            <div
              className="counterpulse-report-bar__fill"
              style={{
                width: `${Math.max(4, (row.revenue / maxValue) * 100)}%`,
              }}
            />
          </div>
          <div className="counterpulse-report-bar__value">
            {formatCurrency(row.revenue, row.currencyCode)}
          </div>
        </div>
      ))}
    </div>
  );
}

function DiscountCodeSection({ report }: { report: AdvancedReports }) {
  return (
    <s-section heading="Unique discount codes">
      {report.discountCodes.rows.length === 0 ? (
        <EmptyStateCard
          actionHref="/app/campaigns"
          actionLabel="View campaigns"
          message="No unique-code activity matched the selected filters."
          title="No unique-code data"
        />
      ) : (
        <table className="counterpulse-table">
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
                <td>{row.assigned}</td>
                <td>{row.used}</td>
                <td>{row.expired}</td>
                <td>{formatPercent(row.conversionRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </s-section>
  );
}

function WeeklyReportSection({ report }: { report: AdvancedReports }) {
  return (
    <s-section heading="Weekly report">
      <div className="counterpulse-card">
        <h3 className="counterpulse-section-heading">{report.weekly.title}</h3>
        <p className="counterpulse-muted">{report.weekly.summary}</p>
        <ul className="counterpulse-report-list">
          {report.weekly.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      </div>
    </s-section>
  );
}

async function loadCampaignOptions(shopId: string): Promise<CampaignOption[]> {
  return prisma.campaign.findMany({
    where: { shopId },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, name: true },
  });
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

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
