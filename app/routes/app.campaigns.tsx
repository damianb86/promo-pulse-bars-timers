import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { AnalyticsEventType } from "@prisma/client";
import { type ReactNode, useRef, useState } from "react";
import { AppAlert, ConfirmModal } from "../components/Notifications";
import {
  Form,
  Link,
  Outlet,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";

import { CampaignStatusBadge } from "../components/CampaignStatusBadge";
import { EmptyStateCard } from "../components/EmptyStateCard";
import prisma from "../db.server";
import {
  activateCampaign,
  deleteCampaignForShop,
  duplicateCampaign,
  getCampaignsForShop,
  pauseCampaign,
} from "../models/campaign.server";
import { getOrCreateShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import { CampaignRuleError } from "../services/campaign-rules";
import { canActivateCampaign } from "../services/planLimits.server";
import {
  campaignListStatusOptions,
  campaignTypeOptions,
  formatCampaignOption,
  type CampaignStatusValue,
  type CampaignTypeValue,
} from "../types/campaign-options";

type CampaignListItem = {
  id: string;
  name: string;
  status: CampaignStatusValue;
  type: CampaignTypeValue;
  updatedAt: string;
  placements: string[];
  experiment: CampaignExperimentSummary;
  performance: CampaignPerformanceSummary;
};

type CampaignExperimentSummary = {
  status: "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED" | "NONE";
  label: string;
  detail: string;
  variantCount: number;
};

type CampaignPerformanceSummary = {
  impressions: number;
  clicks: number;
  ctr: number;
  orders: number;
};

type LoaderData = {
  campaigns: CampaignListItem[];
  filters: {
    status: string;
    type: string;
    query: string;
  };
  error: string | null;
};

type ActionData = {
  error?: string;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticateAdmin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "";
  const type = url.searchParams.get("type") ?? "";
  const query = url.searchParams.get("q") ?? "";

  try {
    const shop = await getOrCreateShopByDomain(session.shop);
    const campaigns = await getCampaignsForShop(shop.id, {
      status: status && isCampaignStatus(status) ? status : undefined,
      type: isCampaignType(type) ? type : undefined,
      query,
    });
    const performanceByCampaign = await loadCampaignPerformance(
      shop.id,
      campaigns.map((campaign) => campaign.id),
    );

    return {
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        type: campaign.type,
        updatedAt: campaign.updatedAt.toISOString(),
        placements: campaign.placements.map((placement) =>
          formatCampaignOption(placement.placementType),
        ),
        experiment: buildExperimentSummary(campaign.experiments),
        performance:
          performanceByCampaign.get(campaign.id) ??
          createEmptyPerformanceSummary(),
      })),
      filters: { status, type, query },
      error: null,
    };
  } catch (error) {
    console.error("Failed to load campaigns", error);

    return {
      campaigns: [],
      filters: { status, type, query },
      error:
        "Campaigns could not be loaded. Check that Prisma migrations have been applied.",
    };
  }
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData | Response> => {
  const { session, redirect } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("_action") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");

  if (!campaignId) {
    return { error: "Campaign id is required." };
  }

  try {
    if (intent === "duplicate") {
      await duplicateCampaign(campaignId, shop.id);
    } else if (intent === "pause") {
      await pauseCampaign(campaignId, shop.id);
    } else if (intent === "activate") {
      const activationGate = await canActivateCampaign(shop, { campaignId });

      if (!activationGate.allowed) {
        return { error: activationGate.reason };
      }

      await activateCampaign(campaignId, shop.id);
    } else if (intent === "delete") {
      await deleteCampaignForShop(campaignId, shop.id);
    } else {
      return { error: "Unsupported campaign action." };
    }
  } catch (error) {
    if (error instanceof CampaignRuleError) {
      return { error: error.errors.join(" ") };
    }

    console.error("Campaign action failed", error);
    return { error: "Campaign action failed. Try again." };
  }

  return redirect("/app/campaigns");
};

async function loadCampaignPerformance(shopId: string, campaignIds: string[]) {
  if (campaignIds.length === 0) {
    return new Map<string, CampaignPerformanceSummary>();
  }

  const rows = await prisma.analyticsEvent.groupBy({
    by: ["campaignId", "eventType"],
    where: {
      shopId,
      campaignId: { in: campaignIds },
      eventType: {
        in: [
          AnalyticsEventType.IMPRESSION,
          AnalyticsEventType.BADGE_IMPRESSION,
          AnalyticsEventType.CLICK,
          AnalyticsEventType.BADGE_CLICK,
          AnalyticsEventType.ORDER_ATTRIBUTED,
        ],
      },
    },
    _count: { _all: true },
  });
  const summaries = new Map<string, CampaignPerformanceSummary>();

  for (const row of rows) {
    if (!row.campaignId) continue;

    const summary =
      summaries.get(row.campaignId) ?? createEmptyPerformanceSummary();
    const count = row._count._all;

    if (
      row.eventType === AnalyticsEventType.IMPRESSION ||
      row.eventType === AnalyticsEventType.BADGE_IMPRESSION
    ) {
      summary.impressions += count;
    } else if (
      row.eventType === AnalyticsEventType.CLICK ||
      row.eventType === AnalyticsEventType.BADGE_CLICK
    ) {
      summary.clicks += count;
    } else if (row.eventType === AnalyticsEventType.ORDER_ATTRIBUTED) {
      summary.orders += count;
    }

    summary.ctr =
      summary.impressions > 0 ? summary.clicks / summary.impressions : 0;
    summaries.set(row.campaignId, summary);
  }

  return summaries;
}

function createEmptyPerformanceSummary(): CampaignPerformanceSummary {
  return {
    impressions: 0,
    clicks: 0,
    ctr: 0,
    orders: 0,
  };
}

function buildExperimentSummary(
  experiments: Array<{
    name: string;
    status: CampaignExperimentSummary["status"];
    variants: Array<unknown>;
  }>,
): CampaignExperimentSummary {
  const experiment =
    experiments.find((item) => item.status === "RUNNING") ??
    experiments.find((item) => item.status === "DRAFT") ??
    experiments.find((item) => item.status === "PAUSED") ??
    experiments.find((item) => item.status === "COMPLETED") ??
    null;

  if (!experiment) {
    return {
      status: "NONE",
      label: "No experiment",
      detail: "Campaign baseline only",
      variantCount: 0,
    };
  }

  const variantCount = experiment.variants.length;
  const variantText = `${variantCount} ${variantCount === 1 ? "variant" : "variants"}`;

  if (experiment.status === "RUNNING") {
    return {
      status: "RUNNING",
      label: "Experiment running",
      detail: variantText,
      variantCount,
    };
  }

  if (experiment.status === "DRAFT") {
    return {
      status: "DRAFT",
      label: "Experiment draft",
      detail: variantText,
      variantCount,
    };
  }

  if (experiment.status === "PAUSED") {
    return {
      status: "PAUSED",
      label: "Experiment paused",
      detail: variantText,
      variantCount,
    };
  }

  return {
    status: "COMPLETED",
    label: "Experiment completed",
    detail: variantText,
    variantCount,
  };
}

export default function CampaignsPage() {
  const { campaigns, filters, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const location = useLocation();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const hasActiveFilters = Boolean(
    filters.query.trim() || filters.status || filters.type,
  );
  const statusCounts = campaigns.reduce<Record<CampaignStatusValue, number>>(
    (counts, campaign) => {
      counts[campaign.status] += 1;
      return counts;
    },
    {
      ACTIVE: 0,
      DRAFT: 0,
      EXPIRED: 0,
      PAUSED: 0,
    },
  );
  const runningExperiments = campaigns.filter(
    (campaign) => campaign.experiment.status === "RUNNING",
  ).length;
  const isCampaignsIndexRoute =
    location.pathname.replace(/\/+$/, "") === "/app/campaigns";

  if (!isCampaignsIndexRoute) {
    return <Outlet />;
  }

  return (
    <s-page inlineSize="large">
      <div className="counterpulse-campaigns-layout">
        {(error || actionData?.error) && (
          <AppAlert tone="critical" title="Campaigns need attention">
            <s-paragraph>{error ?? actionData?.error}</s-paragraph>
          </AppAlert>
        )}

        <div className="counterpulse-campaigns-header">
          <div>
            <p className="counterpulse-kicker">Campaign workspace</p>
            <s-heading>Campaigns</s-heading>
            <s-paragraph>
              Review promotions, control publishing status, and create new
              campaign drafts from the same workspace.
            </s-paragraph>
            <div className="counterpulse-campaigns-header__meta">
              <span>{formatCampaignCount(campaigns.length)} showing</span>
              {runningExperiments > 0 && (
                <span>
                  {runningExperiments} running{" "}
                  {runningExperiments === 1 ? "experiment" : "experiments"}
                </span>
              )}
              {hasActiveFilters && <span>Filtered view</span>}
            </div>
          </div>
          <div className="counterpulse-campaigns-header__actions">
            <Link
              className="counterpulse-button"
              data-testid="campaign-create-button"
              to="/app/campaigns/new"
            >
              Create campaign
            </Link>
          </div>
        </div>

        <div className="counterpulse-campaigns-metrics">
          <CampaignMetric
            caption="Current filtered list"
            label="Showing"
            value={campaigns.length}
          />
          <CampaignMetric
            caption="Eligible if schedule and targeting match"
            label="Active"
            value={statusCounts.ACTIVE}
          />
          <CampaignMetric
            caption="Ready to finish before publishing"
            label="Draft"
            value={statusCounts.DRAFT}
          />
          <CampaignMetric
            caption="Paused or expired"
            label="Not running"
            value={statusCounts.PAUSED + statusCounts.EXPIRED}
          />
        </div>

        <div className="counterpulse-campaigns-filter-panel">
          <div className="counterpulse-campaigns-filter-header">
            <div>
              <p className="counterpulse-kicker">Filters</p>
              <h2>Find campaigns</h2>
              <p>
                Narrow the list by name, lifecycle status, or campaign type
                before editing live promotions.
              </p>
            </div>
            {hasActiveFilters && (
              <Link
                className="counterpulse-button-secondary"
                to="/app/campaigns"
              >
                Clear filters
              </Link>
            )}
          </div>
          <Form
            method="get"
            className="counterpulse-toolbar counterpulse-campaigns-toolbar"
          >
            <label className="counterpulse-form-field">
              <span>Search by name</span>
              <input name="q" defaultValue={filters.query} />
            </label>
            <label className="counterpulse-form-field">
              <span>Status</span>
              <select name="status" defaultValue={filters.status}>
                {campaignListStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="counterpulse-form-field">
              <span>Type</span>
              <select name="type" defaultValue={filters.type}>
                <option value="">All types</option>
                {campaignTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="counterpulse-button" type="submit">
              Apply
            </button>
          </Form>
        </div>

        <div className="counterpulse-campaigns-list-header">
          <div>
            <p className="counterpulse-kicker">Campaign list</p>
            <h2>Manage campaigns</h2>
            <p>
              Keep draft, active, and paused campaigns easy to compare before
              changing behavior on the storefront.
            </p>
          </div>
        </div>
        {campaigns.length === 0 ? (
          <EmptyStateCard
            title="No campaigns found"
            message={
              hasActiveFilters
                ? "No campaigns match the current filters."
                : "Create a campaign to start managing promotional messages."
            }
            actionLabel={hasActiveFilters ? "Clear filters" : undefined}
            actionHref={hasActiveFilters ? "/app/campaigns" : undefined}
          />
        ) : (
          <div className="counterpulse-campaigns-table-shell">
            <table
              aria-label="Campaigns"
              className="counterpulse-table counterpulse-campaigns-table"
            >
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Placements</th>
                  <th>Experiment</th>
                  <th>Performance</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td data-label="Campaign">
                      <div className="counterpulse-campaign-title">
                        <Link
                          className="counterpulse-campaign-title__link"
                          to={`/app/campaigns/${campaign.id}`}
                        >
                          {campaign.name}
                        </Link>
                        <span className="counterpulse-campaign-title__meta">
                          {formatCampaignOption(campaign.type)}
                        </span>
                      </div>
                    </td>
                    <td data-label="Status">
                      <CampaignStatusBadge status={campaign.status} />
                    </td>
                    <td data-label="Placements">
                      <CampaignPlacementChips
                        placements={campaign.placements}
                      />
                    </td>
                    <td data-label="Experiment">
                      <CampaignExperimentBadge experiment={campaign.experiment} />
                    </td>
                    <td data-label="Performance">
                      <CampaignPerformanceSummaryView
                        performance={campaign.performance}
                      />
                    </td>
                    <td data-label="Updated">
                      <span className="counterpulse-muted">
                        {formatUpdatedDate(campaign.updatedAt)}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div className="counterpulse-row-actions">
                        <Link
                          className="counterpulse-button-secondary"
                          data-testid="campaign-edit-button"
                          to={`/app/campaigns/${campaign.id}`}
                        >
                          Edit
                        </Link>
                        <CampaignActionButton
                          action="duplicate"
                          campaignId={campaign.id}
                          disabled={isSubmitting}
                        >
                          Duplicate
                        </CampaignActionButton>
                        {campaign.status === "ACTIVE" ? (
                          <CampaignActionButton
                            action="pause"
                            campaignId={campaign.id}
                            disabled={isSubmitting}
                          >
                            Pause
                          </CampaignActionButton>
                        ) : (
                          <CampaignActionButton
                            action="activate"
                            campaignId={campaign.id}
                            disabled={isSubmitting}
                          >
                            Activate
                          </CampaignActionButton>
                        )}
                        <CampaignActionButton
                          action="delete"
                          campaignId={campaign.id}
                          disabled={isSubmitting}
                          destructive
                        >
                          Delete
                        </CampaignActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </s-page>
  );
}

function CampaignMetric({
  caption,
  label,
  value,
}: {
  caption: string;
  label: string;
  value: number;
}) {
  return (
    <div className="counterpulse-campaigns-metric">
      <span>{label}</span>
      <strong>{formatCompactNumber(value)}</strong>
      <small>{caption}</small>
    </div>
  );
}

function CampaignPlacementChips({ placements }: { placements: string[] }) {
  if (placements.length === 0) {
    return <span className="counterpulse-muted">No placement</span>;
  }

  return (
    <div
      className={
        placements.length > 1
          ? "counterpulse-placement-chips counterpulse-placement-chips--has-popover"
          : "counterpulse-placement-chips"
      }
    >
      {placements.map((placement) => (
        <span className="counterpulse-placement-chip" key={placement}>
          {placement}
        </span>
      ))}
      {placements.length > 1 && (
        <div className="counterpulse-placement-popover" role="tooltip">
          <strong>{placements.length} placements</strong>
          <span>{placements.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

function CampaignExperimentBadge({
  experiment,
}: {
  experiment: CampaignExperimentSummary;
}) {
  return (
    <div
      className={`counterpulse-experiment-pill counterpulse-experiment-pill--${experiment.status.toLowerCase()}`}
    >
      <span className="counterpulse-experiment-pill__dot" />
      <span>
        <strong>{experiment.label}</strong>
        <small>{experiment.detail}</small>
      </span>
    </div>
  );
}

function CampaignPerformanceSummaryView({
  performance,
}: {
  performance: CampaignPerformanceSummary;
}) {
  const hasData =
    performance.impressions > 0 ||
    performance.clicks > 0 ||
    performance.orders > 0;

  if (!hasData) {
    return (
      <div className="counterpulse-campaign-performance counterpulse-campaign-performance--empty">
        <strong>No data yet</strong>
        <span>Waiting for impressions</span>
      </div>
    );
  }

  return (
    <div className="counterpulse-campaign-performance">
      <strong>{formatCompactNumber(performance.impressions)}</strong>
      <span>impressions</span>
      <small>
        {formatPercent(performance.ctr)} CTR ·{" "}
        {formatCompactNumber(performance.clicks)} clicks
        {performance.orders > 0
          ? ` · ${formatCompactNumber(performance.orders)} orders`
          : ""}
      </small>
    </div>
  );
}

function CampaignActionButton({
  action,
  campaignId,
  disabled,
  destructive = false,
  children,
}: {
  action: "duplicate" | "pause" | "activate" | "delete";
  campaignId: string;
  disabled: boolean;
  destructive?: boolean;
  children: ReactNode;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmation = campaignActionConfirmations[action];

  return (
    <>
      <Form method="post" ref={formRef}>
        <input type="hidden" name="_action" value={action} />
        <input type="hidden" name="campaignId" value={campaignId} />
        <button
          className={
            destructive
              ? "counterpulse-button-danger"
              : "counterpulse-button-secondary"
          }
          data-testid={`campaign-${action}-button`}
          disabled={disabled}
          type="button"
          onClick={() => setIsConfirmOpen(true)}
        >
          {children}
        </button>
      </Form>

      <ConfirmModal
        confirmLabel={confirmation.confirmLabel}
        open={isConfirmOpen}
        title={confirmation.title}
        tone={destructive ? "critical" : "warning"}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          formRef.current?.requestSubmit();
        }}
      >
        <p>{confirmation.description}</p>
      </ConfirmModal>
    </>
  );
}

const campaignActionConfirmations: Record<
  "duplicate" | "pause" | "activate" | "delete",
  { confirmLabel: string; description: string; title: string }
> = {
  activate: {
    confirmLabel: "Activate campaign",
    title: "Activate campaign?",
    description:
      "This can make the campaign eligible on the storefront immediately if its schedule and targeting match.",
  },
  delete: {
    confirmLabel: "Delete campaign",
    title: "Delete campaign?",
    description:
      "This permanently removes the campaign and its configuration. Existing storefront displays will stop using it.",
  },
  duplicate: {
    confirmLabel: "Duplicate campaign",
    title: "Duplicate campaign?",
    description:
      "This creates a draft copy with the same configuration so you can edit it before publishing.",
  },
  pause: {
    confirmLabel: "Pause campaign",
    title: "Pause campaign?",
    description:
      "This stops the campaign from rendering for shoppers until you activate it again.",
  },
};

function isCampaignStatus(value: string): value is CampaignStatusValue {
  return campaignListStatusOptions.some(
    (option) => option.value !== "" && option.value === value,
  );
}

function isCampaignType(value: string): value is CampaignTypeValue {
  return campaignTypeOptions.some((option) => option.value === value);
}

function formatUpdatedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

function formatCampaignCount(value: number) {
  return `${value} ${value === 1 ? "campaign" : "campaigns"}`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    compactDisplay: "short",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 10000 ? "compact" : "standard",
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(value);
}
