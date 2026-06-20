import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { AppAlert } from "../components/Notifications";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { EmptyStateCard } from "../components/EmptyStateCard";
import { PlanUpgradeCallout } from "../components/PlanUpgradeCallout";
import { StatCard } from "../components/StatCard";
import {
  buildAnalyticsByDay,
  getAnalyticsByCampaign,
  getAnalyticsByDay,
  getShopAnalyticsSummary,
  summarizeAnalyticsEvents,
  type AnalyticsByCampaignRow,
  type AnalyticsByDayRow,
  type AnalyticsSummary,
} from "../models/analytics.server";
import { getShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import { getLockedFeatureReason } from "../services/planLimits.server";

const demoShopDomain = "counterpulse-demo.myshopify.com";

type LoaderData = {
  summary: AnalyticsSummary;
  byCampaign: AnalyticsByCampaignRow[];
  byDay: AnalyticsByDayRow[];
  rangeDays: 7 | 30;
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
  const rangeDays = url.searchParams.get("range") === "30" ? 30 : 7;

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
        rangeDays,
        shopifyDomain: shop.shopifyDomain,
        dataSource: liveShop ? "shop" : "demo",
        error: null,
        lockedAnalyticsReason,
      };
    }

    const [summary, byCampaign, byDay] = await Promise.all([
      getShopAnalyticsSummary(shop.id, { days: rangeDays }),
      getAnalyticsByCampaign(shop.id, { days: rangeDays }),
      getAnalyticsByDay(shop.id, { days: rangeDays }),
    ]);

    return {
      summary,
      byCampaign,
      byDay,
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
        <div className="counterpulse-dashboard-header">
          <div>
            <s-heading>Storefront engagement</s-heading>
            <s-paragraph>
              Track rendered campaigns, clicks, coupon copies, cart events, and
              attributed revenue.
            </s-paragraph>
            <div className="counterpulse-muted">
              {shopifyDomain ?? "No shop connected yet"}
            </div>
          </div>
          <div className="counterpulse-dashboard-header__badges">
            <s-badge tone="neutral">Last {rangeDays} days</s-badge>
            {dataSource === "demo" && (
              <s-badge tone="info">Development demo data</s-badge>
            )}
          </div>
        </div>
      </s-section>

      {!lockedAnalyticsReason && (
        <div data-testid="analytics-dashboard">
          <s-section heading="Date range">
            <div className="counterpulse-actions">
              <a
                className={
                  rangeDays === 7
                    ? "counterpulse-button"
                    : "counterpulse-button-secondary"
                }
                href="/app/analytics?range=7"
              >
                7 days
              </a>
              <a
                className={
                  rangeDays === 30
                    ? "counterpulse-button"
                    : "counterpulse-button-secondary"
                }
                href="/app/analytics?range=30"
              >
                30 days
              </a>
            </div>
          </s-section>

          <s-section heading="Summary">
            <div className="counterpulse-stat-grid">
              <StatCard
                label="Impressions"
                value={summary.impressions}
                caption={`Last ${rangeDays} days`}
              />
              <StatCard
                label="Clicks"
                value={summary.clicks}
                caption={`CTR ${formatPercent(summary.ctr)}`}
              />
              <StatCard
                label="Add to cart"
                value={summary.addToCart}
                caption="Tracked storefront events"
              />
              <StatCard
                label="Checkout started"
                value={summary.checkoutStarted}
                caption="Tracked storefront events"
              />
              <StatCard
                label="Coupon copies"
                value={summary.copyCode}
                caption="COPY_CODE events"
              />
              <StatCard
                label="Attributed revenue"
                value={revenue}
                caption="Approximate order attribution"
              />
            </div>
          </s-section>

          <s-section heading="Campaign performance">
            {byCampaign.length === 0 ? (
              <EmptyStateCard
                title="No analytics events yet"
                message="Events will appear here after the theme embed renders campaigns or after test events are posted to the analytics endpoint."
                actionLabel="View campaigns"
                actionHref="/app/campaigns"
              />
            ) : (
              <table className="counterpulse-table">
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
                      <td>{row.campaignName}</td>
                      <td>{formatEnum(row.campaignType)}</td>
                      <td>{row.impressions}</td>
                      <td>{row.clicks}</td>
                      <td>{formatPercent(row.ctr)}</td>
                      <td>{row.copyCode}</td>
                      <td>{row.addToCart}</td>
                      <td>{row.checkoutStarted}</td>
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
            )}
          </s-section>

          <s-section heading="Daily trend">
            <table className="counterpulse-table">
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
                {byDay.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{row.impressions}</td>
                    <td>{row.clicks}</td>
                    <td>{formatPercent(row.ctr)}</td>
                    <td>
                      {formatCurrency(row.revenueAttributed, row.currencyCode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </s-section>
        </div>
      )}
    </s-page>
  );
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
