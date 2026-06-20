import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
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

export default function CampaignsPage() {
  const { campaigns, filters, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const location = useLocation();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const isCampaignsIndexRoute =
    location.pathname.replace(/\/+$/, "") === "/app/campaigns";

  if (!isCampaignsIndexRoute) {
    return <Outlet />;
  }

  return (
    <s-page inlineSize="large" heading="Campaigns">
      <Link
        className="counterpulse-button"
        data-testid="campaign-create-button"
        slot="primary-action"
        to="/app/campaigns/new"
      >
        Create campaign
      </Link>

      {(error || actionData?.error) && (
        <AppAlert tone="critical" title="Campaigns need attention">
          <s-paragraph>{error ?? actionData?.error}</s-paragraph>
        </AppAlert>
      )}

      <s-section heading="Filters">
        <Form method="get" className="counterpulse-toolbar">
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
      </s-section>

      <s-section heading="Campaign list">
        {campaigns.length === 0 ? (
          <EmptyStateCard
            title="No campaigns found"
            message="Create a campaign or adjust filters to see existing promotions."
            actionLabel="Create campaign"
            actionHref="/app/campaigns/new"
          />
        ) : (
          <table className="counterpulse-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Type</th>
                <th>Placements</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <Link to={`/app/campaigns/${campaign.id}`}>
                      {campaign.name}
                    </Link>
                  </td>
                  <td>
                    <CampaignStatusBadge status={campaign.status} />
                  </td>
                  <td>{formatCampaignOption(campaign.type)}</td>
                  <td>{campaign.placements.join(", ") || "No placement"}</td>
                  <td>{formatUpdatedDate(campaign.updatedAt)}</td>
                  <td>
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
        )}
      </s-section>
    </s-page>
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
  const requiresConfirmation = action === "delete";

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
          type={requiresConfirmation ? "button" : "submit"}
          onClick={
            requiresConfirmation ? () => setIsConfirmOpen(true) : undefined
          }
        >
          {children}
        </button>
      </Form>

      {requiresConfirmation && (
        <ConfirmModal
          confirmLabel="Delete campaign"
          open={isConfirmOpen}
          title="Delete campaign?"
          onCancel={() => setIsConfirmOpen(false)}
          onConfirm={() => {
            setIsConfirmOpen(false);
            formRef.current?.requestSubmit();
          }}
        >
          <p>
            This permanently removes the campaign and its configuration.
            Existing storefront displays will stop using it.
          </p>
        </ConfirmModal>
      )}
    </>
  );
}

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
