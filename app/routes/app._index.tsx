import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Link, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { CampaignStatusBadge } from "../components/CampaignStatusBadge";
import { EmptyStateCard } from "../components/EmptyStateCard";
import { OnboardingChecklist } from "../components/OnboardingChecklist";
import { StatCard } from "../components/StatCard";
import {
  createEmptyDashboardSummary,
  getDashboardSummary,
  type DashboardSummary,
} from "../models/dashboard.server";
import { getOrCreateShopByDomain } from "../models/shop.server";
import {
  OnboardingError,
  updateManualOnboardingChecklistField,
} from "../services/onboarding.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import type { OnboardingChecklistField } from "../types/onboarding";

type LoaderData = {
  dashboard: DashboardSummary;
  error: string | null;
};

type ActionData = {
  notice?: string;
  error?: string;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticateAdmin(request);

  try {
    const dashboard = await getDashboardSummary(session.shop);

    return {
      dashboard,
      error: null,
    };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error("Failed to load Promo Pulse dashboard", error);

    return {
      dashboard: createEmptyDashboardSummary(session.shop),
      error:
        "Dashboard data is unavailable. Run Prisma migrations and seed data if this is a local environment.",
    };
  }
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData> => {
  const { session } = await authenticateAdmin(request);
  const formData = await request.formData();

  if (String(formData.get("intent")) !== "updateChecklist") {
    return { error: "Unsupported dashboard action." };
  }

  const field = String(formData.get("field") ?? "") as OnboardingChecklistField;
  const value = String(formData.get("value")) === "true";
  const shop = await getOrCreateShopByDomain(session.shop);

  try {
    await updateManualOnboardingChecklistField(shop.id, field, value);

    return {
      notice: value
        ? "Checklist step marked done."
        : "Checklist step reopened.",
    };
  } catch (error) {
    if (error instanceof OnboardingError) {
      return { error: error.message };
    }

    console.error("Failed to update onboarding checklist", error);
    return { error: "Checklist could not be updated." };
  }
};

export default function Dashboard() {
  const { dashboard, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const revenue = new Intl.NumberFormat("en", {
    style: "currency",
    currency: dashboard.metrics.currencyCode,
  }).format(dashboard.metrics.revenueAttributedLast7Days);

  const installationTone =
    dashboard.installationStatus === "connected"
      ? "success"
      : dashboard.installationStatus === "demo"
        ? "info"
        : "warning";

  return (
    <s-page heading="Promo Pulse: Bars & Timers">
      <Link
        className="counterpulse-button"
        slot="primary-action"
        to="/app/campaigns/new"
      >
        Create campaign
      </Link>

      {error && (
        <s-banner tone="warning" heading="Dashboard data needs attention">
          <s-paragraph>{error}</s-paragraph>
        </s-banner>
      )}

      {actionData?.notice && (
        <s-banner tone="success" heading="Checklist updated">
          <s-paragraph>{actionData.notice}</s-paragraph>
        </s-banner>
      )}

      {actionData?.error && (
        <s-banner tone="critical" heading="Checklist update failed">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-banner>
      )}

      <s-section>
        <div className="counterpulse-dashboard-header">
          <div>
            <s-heading>Dashboard</s-heading>
            <s-paragraph>
              Monitor promotional campaigns, setup progress, and storefront
              engagement from one place.
            </s-paragraph>
            <div className="counterpulse-muted">
              {dashboard.shopifyDomain ?? "No shop connected yet"}
            </div>
          </div>
          <div className="counterpulse-dashboard-header__badges">
            <s-badge tone={installationTone}>
              {formatInstallationStatus(dashboard.installationStatus)}
            </s-badge>
            <s-badge tone="neutral">{formatPlan(dashboard.plan)}</s-badge>
            {dashboard.dataSource === "demo" && (
              <s-badge tone="info">Development demo data</s-badge>
            )}
          </div>
        </div>
      </s-section>

      <s-section heading="Campaign summary">
        <div className="counterpulse-stat-grid">
          <StatCard
            label="Active campaigns"
            value={dashboard.campaignCounts.active}
            caption="Currently eligible to display"
          />
          <StatCard
            label="Paused campaigns"
            value={dashboard.campaignCounts.paused}
            caption="Configured but not displaying"
          />
          <StatCard
            label="Draft campaigns"
            value={dashboard.campaignCounts.drafts}
            caption="Not published yet"
          />
          <StatCard
            label="Revenue attributed"
            value={revenue}
            caption="Last 7 days, approximate"
          />
        </div>
      </s-section>

      <s-section heading="Analytics snapshot">
        <div className="counterpulse-stat-grid">
          <StatCard
            label="Impressions"
            value={dashboard.metrics.impressionsLast7Days}
            caption="Last 7 days"
          />
          <StatCard
            label="Clicks"
            value={dashboard.metrics.clicksLast7Days}
            caption="Last 7 days"
          />
          <StatCard
            label="Click rate"
            value={formatClickRate(
              dashboard.metrics.clicksLast7Days,
              dashboard.metrics.impressionsLast7Days,
            )}
            caption="Clicks divided by impressions"
          />
          <StatCard
            label="Campaigns tracked"
            value={dashboard.campaigns.length}
            caption="Using available Prisma data"
          />
        </div>
      </s-section>

      <s-section heading="Campaigns">
        {dashboard.campaigns.length === 0 ? (
          <EmptyStateCard
            title="No campaigns yet"
            message="Use guided setup or create a campaign manually to start showing promotional messages on your storefront."
            actionLabel="Start guided setup"
            actionHref="/app/onboarding"
          />
        ) : (
          <div className="counterpulse-campaign-list">
            {dashboard.campaigns.slice(0, 5).map((campaign) => (
              <div className="counterpulse-campaign-row" key={campaign.id}>
                <div>
                  <div className="counterpulse-campaign-row__title">
                    {campaign.name}
                  </div>
                  <div className="counterpulse-campaign-row__meta">
                    {formatEnum(campaign.type)} ·{" "}
                    {campaign.placements.map(formatEnum).join(", ") ||
                      "No placement"}
                  </div>
                </div>
                <CampaignStatusBadge status={campaign.status} />
              </div>
            ))}
          </div>
        )}
      </s-section>

      <OnboardingChecklist
        items={[
          {
            label: "Create first campaign",
            completed: dashboard.onboarding.firstCampaignCreated,
            description: "Create and activate a starter promotion.",
          },
          {
            label: "Enable theme app embed",
            completed: dashboard.onboarding.appEmbedEnabled,
            description: "Turn on the Promo Pulse app embed in Theme Editor.",
            manualField: "appEmbedEnabled",
          },
          {
            label: "Add product block",
            completed: dashboard.onboarding.productBlockAdded,
            description: "Add the Promo Pulse block to a product template.",
            manualField: "productBlockAdded",
          },
          {
            label: "Add cart block",
            completed: dashboard.onboarding.cartBlockAdded,
            description: "Add the Promo Pulse block to the cart template.",
            manualField: "cartBlockAdded",
          },
          {
            label: "Receive first impression",
            completed: dashboard.onboarding.firstImpressionReceived,
            description: "Auto detected when a campaign renders on storefront.",
          },
        ]}
      />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

function formatPlan(plan: string) {
  return `${formatEnum(plan)} plan`;
}

function formatInstallationStatus(
  status: DashboardSummary["installationStatus"],
) {
  if (status === "connected") return "Installed";
  if (status === "demo") return "Demo mode";
  return "Not configured";
}

function formatClickRate(clicks: number, impressions: number) {
  if (impressions === 0) return "0%";
  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
