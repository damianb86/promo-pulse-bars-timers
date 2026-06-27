import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { AppAlert } from "../components/Notifications";
import { CampaignStatusBadge } from "../components/CampaignStatusBadge";
import { EmptyStateCard } from "../components/EmptyStateCard";
import { OnboardingChecklist } from "../components/OnboardingChecklist";
import { StatCard } from "../components/StatCard";
import {
  createEmptyDashboardSummary,
  getDashboardSummary,
  type DashboardSummary,
} from "../models/dashboard.server";
import { authenticateAdmin } from "../services/admin-auth.server";

type LoaderData = {
  dashboard: DashboardSummary;
  error: string | null;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session, admin } = await authenticateAdmin(request);

  try {
    const dashboard = await getDashboardSummary(session.shop, admin);

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

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticateAdmin(request);

  // Runs every onboarding check, including the theme app-block inspection that
  // needs the (optional) read_themes scope. The scope is requested client-side
  // before this submits, so it only happens when the button is pressed.
  await getDashboardSummary(session.shop, admin, { inspectTheme: true });

  return { ok: true };
};

export default function Dashboard() {
  const { dashboard, error } = useLoaderData<typeof loader>();
  const checksFetcher = useFetcher();
  const isRunningChecks = checksFetcher.state !== "idle";

  const runOnboardingChecks = async () => {
    // Request the theme permission on demand; ignore the result so the checks
    // still run (the theme inspection simply returns nothing without it).
    try {
      await window.shopify?.scopes?.request?.(["read_themes"]);
    } catch {
      // Permission declined or unavailable — continue with the other checks.
    }

    checksFetcher.submit({ _action: "runOnboardingChecks" }, { method: "post" });
  };
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
    <s-page inlineSize="large" heading="Promo Pulse: Bars & Timers">
      <Link
        className="counterpulse-button"
        slot="primary-action"
        to="/app/campaigns/new"
      >
        Create campaign
      </Link>

      {error && (
        <AppAlert tone="warning" title="Dashboard data needs attention">
          <s-paragraph>{error}</s-paragraph>
        </AppAlert>
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
            message="Create a campaign manually to start showing promotional messages on your storefront."
            actionLabel="Create campaign"
            actionHref="/app/campaigns/new"
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
        isRunning={isRunningChecks}
        onRunChecks={runOnboardingChecks}
        items={[
          {
            label: "Create first campaign",
            completed: dashboard.onboarding.firstCampaignCreated,
            description: "Create and activate a starter promotion.",
            actionLabel: "Create campaign",
            actionHref: "/app/campaigns/new",
          },
          {
            label: "Enable theme app embed",
            completed: dashboard.onboarding.appEmbedEnabled,
            description:
              "Detected automatically once the Promo Pulse app embed is turned on in Theme Editor.",
            actionLabel: "Open theme editor",
            actionHref: themeEditorUrl(dashboard.shopifyDomain, {
              context: "apps",
            }),
          },
          {
            label: "Add product block",
            completed: dashboard.onboarding.productBlockAdded,
            description:
              "Detected automatically once the Promo Pulse block is added to a product template.",
            actionLabel: "Add to product template",
            actionHref: themeEditorUrl(dashboard.shopifyDomain, {
              template: "product",
              addAppBlockId: `${THEME_EXTENSION_UID}/product-timer`,
              target: "mainSection",
            }),
          },
          {
            label: "Add cart block",
            completed: dashboard.onboarding.cartBlockAdded,
            description:
              "Detected automatically once the Promo Pulse block is added to the cart template.",
            actionLabel: "Add to cart template",
            actionHref: themeEditorUrl(dashboard.shopifyDomain, {
              template: "cart",
              addAppBlockId: `${THEME_EXTENSION_UID}/cart-timer`,
              target: "mainSection",
            }),
          },
          {
            label: "Receive first impression",
            completed: dashboard.onboarding.firstImpressionReceived,
            description:
              "Detected automatically the first time a campaign renders on the storefront.",
            actionLabel: "View analytics",
            actionHref: "/app/reports",
          },
        ]}
      />
    </s-page>
  );
}

const THEME_EXTENSION_UID = "07333e7d-52b3-bfc5-0ef1-b67701f5552ae39da71d";

function themeEditorUrl(
  shopifyDomain: string | null,
  params: Record<string, string>,
) {
  const domain = shopifyDomain ?? "admin.shopify.com";
  const search = new URLSearchParams(params).toString();

  return `https://${domain}/admin/themes/current/editor?${search}`;
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
