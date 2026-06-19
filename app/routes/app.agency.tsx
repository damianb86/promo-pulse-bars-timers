import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";

import { EmptyStateCard } from "../components/EmptyStateCard";
import { PlanUpgradeCallout } from "../components/PlanUpgradeCallout";
import { getOrCreateShopByDomain } from "../models/shop.server";
import {
  AgencyAuthorizationError,
  copyCampaignToAgencyShop,
  copyTemplateToAgencyShop,
  getAgencyDashboard,
} from "../services/agency/agencyDashboard.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import { canUsePremiumFeature } from "../services/premiumFeatures.server";
import { TemplateLibraryError } from "../services/templates/templateLibrary.server";
import { formatCampaignOption } from "../types/campaign-options";

type AgencyShopRow = {
  id: string;
  shopifyDomain: string;
  plan: string;
  role: string;
  activeCampaigns: number;
  attributedRevenue: number;
  currencyCode: string;
  openRecommendations: number;
};

type AgencyCampaignRow = {
  id: string;
  name: string;
  status: string;
  type: string;
  updatedAt: string;
  placements: string[];
};

type AgencyTemplateRow = {
  key: string;
  category: string;
  countryCode: string | null;
  locale: string;
  eventName: string;
  type: string;
};

type LoaderData = {
  agencyName: string;
  campaigns: AgencyCampaignRow[];
  lockedReason: string;
  selectedShopId: string;
  shops: AgencyShopRow[];
  shopifyDomain: string;
  templates: AgencyTemplateRow[];
  warning: string;
};

type ActionData = {
  draftHref?: string;
  error?: string;
  notice?: string;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const gate = canUsePremiumFeature(shop, "AGENCY_DASHBOARD");
  const url = new URL(request.url);
  const selectedShopId = url.searchParams.get("shopId") || undefined;

  if (!gate.allowed) {
    return {
      agencyName: "",
      campaigns: [],
      lockedReason: gate.reason,
      selectedShopId: shop.id,
      shops: [],
      shopifyDomain: shop.shopifyDomain,
      templates: [],
      warning: "",
    };
  }

  try {
    const dashboard = await getAgencyDashboard(shop, selectedShopId);

    return serializeDashboard(shop.shopifyDomain, dashboard, "");
  } catch (error) {
    if (error instanceof AgencyAuthorizationError) {
      const dashboard = await getAgencyDashboard(shop);

      return serializeDashboard(
        shop.shopifyDomain,
        dashboard,
        "Selected shop is not connected to this agency workspace.",
      );
    }

    throw error;
  }
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const gate = canUsePremiumFeature(shop, "AGENCY_DASHBOARD");
  const formData = await request.formData();
  const intent = readFormValue(formData, "_action");

  if (!gate.allowed) {
    return { error: gate.reason };
  }

  try {
    if (intent === "copyCampaign") {
      const copied = await copyCampaignToAgencyShop(shop, {
        campaignId: readRequiredFormValue(formData, "campaignId"),
        sourceShopId: readRequiredFormValue(formData, "sourceShopId"),
        destinationShopId: readRequiredFormValue(formData, "destinationShopId"),
      });

      return {
        draftHref: `/app/campaigns/${copied.id}`,
        notice: "Campaign copied as a draft in the destination shop.",
      };
    }

    if (intent === "copyTemplate") {
      const copied = await copyTemplateToAgencyShop(shop, {
        destinationShopId: readRequiredFormValue(formData, "destinationShopId"),
        templateKey: readRequiredFormValue(formData, "templateKey"),
      });

      return {
        draftHref: `/app/campaigns/${copied.id}`,
        notice: "Template copied as a draft in the destination shop.",
      };
    }

    return { error: "Unsupported agency action." };
  } catch (error) {
    if (error instanceof AgencyAuthorizationError) {
      return { error: error.message };
    }

    if (error instanceof TemplateLibraryError) {
      return { error: error.message };
    }

    console.error("Agency action failed", error);
    return { error: "Agency action failed. Try again." };
  }
};

export default function AgencyDashboardPage() {
  const data = useLoaderData<typeof loader>() as LoaderData;
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const selectedShop = data.shops.find(
    (shop) => shop.id === data.selectedShopId,
  );

  return (
    <s-page heading="Agency">
      <s-section>
        <div className="counterpulse-dashboard-header">
          <div>
            <s-heading>Multi-store dashboard</s-heading>
            <s-paragraph>
              Review connected stores, attributed performance, and cross-store
              draft creation from one Promo Pulse workspace.
            </s-paragraph>
            <div className="counterpulse-muted">{data.shopifyDomain}</div>
          </div>
          <div className="counterpulse-dashboard-header__badges">
            <s-badge tone="info">Pro</s-badge>
          </div>
        </div>
      </s-section>

      {data.lockedReason ? (
        <PlanUpgradeCallout
          message={data.lockedReason}
          title="Agency dashboard is locked"
        />
      ) : (
        <>
          {data.warning && (
            <s-banner tone="warning" heading="Shop context reset">
              <s-paragraph>{data.warning}</s-paragraph>
            </s-banner>
          )}

          {actionData?.notice && (
            <s-banner tone="success" heading="Agency action complete">
              <s-paragraph>
                {actionData.notice}{" "}
                {actionData.draftHref && (
                  <Link to={actionData.draftHref}>Open draft</Link>
                )}
              </s-paragraph>
            </s-banner>
          )}

          {actionData?.error && (
            <s-banner tone="critical" heading="Agency action failed">
              <s-paragraph>{actionData.error}</s-paragraph>
            </s-banner>
          )}

          <s-section heading="Shop context">
            <Form method="get" className="counterpulse-toolbar">
              <label className="counterpulse-form-field">
                <span>Agency workspace</span>
                <input readOnly value={data.agencyName} />
              </label>
              <label className="counterpulse-form-field">
                <span>Current shop</span>
                <select name="shopId" defaultValue={data.selectedShopId}>
                  {data.shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.shopifyDomain}
                    </option>
                  ))}
                </select>
              </label>
              <div className="counterpulse-form-field">
                <span>Role</span>
                <input readOnly value={selectedShop?.role ?? ""} />
              </div>
              <button className="counterpulse-button" type="submit">
                Switch shop
              </button>
            </Form>
          </s-section>

          <s-section heading="Connected shops">
            <table className="counterpulse-table">
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Role</th>
                  <th>Plan</th>
                  <th>Active campaigns</th>
                  <th>Attributed revenue</th>
                  <th>Alerts/recommendations</th>
                </tr>
              </thead>
              <tbody>
                {data.shops.map((shop) => (
                  <tr key={shop.id}>
                    <td>
                      <Link to={`/app/agency?shopId=${shop.id}`}>
                        {shop.shopifyDomain}
                      </Link>
                    </td>
                    <td>{formatCampaignOption(shop.role)}</td>
                    <td>{formatCampaignOption(shop.plan)}</td>
                    <td>{shop.activeCampaigns}</td>
                    <td>
                      {formatMoney(shop.attributedRevenue, shop.currencyCode)}
                    </td>
                    <td>{shop.openRecommendations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </s-section>

          <s-section heading="Campaigns in selected shop">
            {data.campaigns.length === 0 ? (
              <EmptyStateCard
                title="No campaigns in this shop"
                message="Switch shops or create a draft from a template to start building."
                actionLabel="Create campaign"
                actionHref="/app/campaigns/new"
              />
            ) : (
              <table className="counterpulse-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Placements</th>
                    <th>Updated</th>
                    <th>Copy</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td>
                        <Link to={`/app/campaigns/${campaign.id}`}>
                          {campaign.name}
                        </Link>
                      </td>
                      <td>{formatCampaignOption(campaign.status)}</td>
                      <td>{formatCampaignOption(campaign.type)}</td>
                      <td>
                        {campaign.placements
                          .map((placement) => formatCampaignOption(placement))
                          .join(", ")}
                      </td>
                      <td>{formatDate(campaign.updatedAt)}</td>
                      <td>
                        <CopyCampaignForm
                          campaign={campaign}
                          selectedShopId={data.selectedShopId}
                          shops={data.shops}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </s-section>

          <s-section heading="Copy template to shop">
            <Form method="post" className="counterpulse-toolbar">
              <input name="_action" type="hidden" value="copyTemplate" />
              <label className="counterpulse-form-field">
                <span>Template</span>
                <select name="templateKey" required>
                  {data.templates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.eventName} -{" "}
                      {formatCampaignOption(template.type)} (
                      {formatTemplateMarket(template)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="counterpulse-form-field">
                <span>Destination shop</span>
                <select
                  name="destinationShopId"
                  defaultValue={data.selectedShopId}
                >
                  {data.shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.shopifyDomain}
                    </option>
                  ))}
                </select>
              </label>
              <div className="counterpulse-form-field">
                <span>Result</span>
                <input readOnly value="Draft campaign" />
              </div>
              <button className="counterpulse-button" type="submit">
                Copy template
              </button>
            </Form>
          </s-section>
        </>
      )}
    </s-page>
  );
}

function CopyCampaignForm({
  campaign,
  selectedShopId,
  shops,
}: {
  campaign: AgencyCampaignRow;
  selectedShopId: string;
  shops: AgencyShopRow[];
}) {
  const defaultDestination =
    shops.find((shop) => shop.id !== selectedShopId)?.id ?? selectedShopId;

  return (
    <Form method="post" className="counterpulse-agency-copy-form">
      <input name="_action" type="hidden" value="copyCampaign" />
      <input name="campaignId" type="hidden" value={campaign.id} />
      <input name="sourceShopId" type="hidden" value={selectedShopId} />
      <label className="counterpulse-form-field">
        <span>Destination</span>
        <select name="destinationShopId" defaultValue={defaultDestination}>
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.shopifyDomain}
            </option>
          ))}
        </select>
      </label>
      <button className="counterpulse-button-secondary" type="submit">
        Copy as draft
      </button>
    </Form>
  );
}

function serializeDashboard(
  shopifyDomain: string,
  dashboard: Awaited<ReturnType<typeof getAgencyDashboard>>,
  warning: string,
): LoaderData {
  return {
    agencyName: dashboard.agency.name,
    campaigns: dashboard.campaigns.map((campaign) => ({
      ...campaign,
      updatedAt: campaign.updatedAt.toISOString(),
    })),
    lockedReason: "",
    selectedShopId: dashboard.selectedShopId,
    shops: dashboard.shops,
    shopifyDomain,
    templates: dashboard.templates,
    warning,
  };
}

function readFormValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function readRequiredFormValue(formData: FormData, key: string) {
  const value = readFormValue(formData, key);

  if (!value) {
    throw new AgencyAuthorizationError(
      `${formatCampaignOption(key)} is required.`,
    );
  }

  return value;
}

function formatMoney(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatTemplateMarket(template: AgencyTemplateRow) {
  return [template.countryCode, template.locale].filter(Boolean).join(" / ");
}
