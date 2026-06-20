import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { AppAlert, AppToast } from "../components/Notifications";
import { Form, Link, useActionData, useLoaderData } from "react-router";

import { EmptyStateCard } from "../components/EmptyStateCard";
import { PlanUpgradeCallout } from "../components/PlanUpgradeCallout";
import { getOrCreateShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import { canUsePremiumFeature } from "../services/premiumFeatures.server";
import {
  applyRecommendation,
  dismissRecommendation,
  generateRecommendationsForShop,
  listRecommendationsForShop,
  RecommendationError,
} from "../services/recommendations/recommendations.server";

type RecommendationRow = {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  confidence: number;
  description: string;
  impact: string | null;
  title: string;
  type: string;
  actionLabel: string;
};

type LoaderData = {
  createdCount: number;
  lockedReason: string;
  recommendations: RecommendationRow[];
  shopifyDomain: string;
};

type ActionData = {
  error?: string;
  notice?: string;
  draftHref?: string;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const gate = canUsePremiumFeature(shop, "RECOMMENDATIONS");

  if (!gate.allowed) {
    return {
      createdCount: 0,
      lockedReason: gate.reason,
      recommendations: [],
      shopifyDomain: shop.shopifyDomain,
    };
  }

  const generation = await generateRecommendationsForShop(shop.id);
  const recommendations = await listRecommendationsForShop(shop.id);

  return {
    createdCount: generation.created.length,
    lockedReason: "",
    recommendations: recommendations.map((recommendation) => ({
      id: recommendation.id,
      campaignId: recommendation.campaignId,
      campaignName: recommendation.campaign?.name ?? null,
      confidence: recommendation.confidence,
      description: recommendation.description,
      impact: recommendation.impact,
      title: recommendation.title,
      type: recommendation.type,
      actionLabel: getActionLabel(recommendation.payload),
    })),
    shopifyDomain: shop.shopifyDomain,
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const gate = canUsePremiumFeature(shop, "RECOMMENDATIONS");
  const formData = await request.formData();
  const intent = String(formData.get("_action") ?? "");
  const recommendationId = String(formData.get("recommendationId") ?? "");

  if (!gate.allowed) {
    return { error: gate.reason };
  }

  try {
    if (intent === "refresh") {
      const result = await generateRecommendationsForShop(shop.id);

      return {
        notice:
          result.created.length === 0
            ? "No new recommendations were found."
            : `${result.created.length} recommendation(s) created.`,
      };
    }

    if (!recommendationId) {
      return { error: "Recommendation id is required." };
    }

    if (intent === "dismiss") {
      await dismissRecommendation(shop.id, recommendationId);

      return { notice: "Recommendation dismissed." };
    }

    if (intent === "apply") {
      const result = await applyRecommendation(shop.id, recommendationId);

      if (result.kind === "campaign") {
        return {
          notice: "Draft campaign created from recommendation.",
          draftHref: `/app/campaigns/${result.id}`,
        };
      }

      return {
        notice: "Draft experiment created from recommendation.",
      };
    }

    return { error: "Unsupported recommendation action." };
  } catch (error) {
    if (error instanceof RecommendationError) {
      return { error: error.message };
    }

    console.error("Recommendation action failed", error);
    return { error: "Recommendation action failed. Try again." };
  }
};

export default function RecommendationsPage() {
  const data = useLoaderData<typeof loader>() as LoaderData;
  const actionData = useActionData<typeof action>() as ActionData | undefined;

  return (
    <s-page inlineSize="large" heading="Recommendations">
      <Form method="post" slot="primary-action">
        <input name="_action" type="hidden" value="refresh" />
        <button className="counterpulse-button" type="submit">
          Refresh recommendations
        </button>
      </Form>

      <s-section>
        <div className="counterpulse-dashboard-header">
          <div>
            <s-heading>Recommendations engine</s-heading>
            <s-paragraph>
              Suggestions are generated from Promo Pulse analytics, attribution,
              market, placement, and unique-code data.
            </s-paragraph>
            <div className="counterpulse-muted">{data.shopifyDomain}</div>
          </div>
          <div className="counterpulse-dashboard-header__badges">
            <s-badge tone="info">Premium</s-badge>
            {data.createdCount > 0 && (
              <s-badge tone="success">{data.createdCount} new</s-badge>
            )}
          </div>
        </div>
      </s-section>

      {data.lockedReason ? (
        <PlanUpgradeCallout
          message={data.lockedReason}
          title="Recommendations are locked"
        />
      ) : (
        <>
          {actionData?.notice && (
            <AppToast tone="success" title="Recommendations updated">
              <s-paragraph>
                {actionData.notice}{" "}
                {actionData.draftHref && (
                  <Link to={actionData.draftHref}>Open draft</Link>
                )}
              </s-paragraph>
            </AppToast>
          )}

          {actionData?.error && (
            <AppAlert tone="critical" title="Recommendation action failed">
              <s-paragraph>{actionData.error}</s-paragraph>
            </AppAlert>
          )}

          <s-section heading="Recommended next actions">
            {data.recommendations.length === 0 ? (
              <EmptyStateCard
                title="No recommendations yet"
                message="Recommendations appear after campaigns have enough recent analytics, attribution, market, or unique-code data."
                actionLabel="View reports"
                actionHref="/app/reports"
              />
            ) : (
              <div className="counterpulse-recommendation-list">
                {data.recommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                  />
                ))}
              </div>
            )}
          </s-section>
        </>
      )}
    </s-page>
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: RecommendationRow;
}) {
  return (
    <div className="counterpulse-card counterpulse-recommendation">
      <div className="counterpulse-recommendation__header">
        <div>
          <div className="counterpulse-recommendation__title">
            {recommendation.title}
          </div>
          <div className="counterpulse-muted">
            {recommendation.campaignName
              ? `Campaign: ${recommendation.campaignName}`
              : "Shop-level recommendation"}
          </div>
        </div>
        <div className="counterpulse-recommendation__meta">
          <s-badge tone="neutral">{formatEnum(recommendation.type)}</s-badge>
          <s-badge tone="info">
            {Math.round(recommendation.confidence * 100)}% confidence
          </s-badge>
        </div>
      </div>

      <div>
        <strong>Reason</strong>
        <div className="counterpulse-muted">{recommendation.description}</div>
      </div>

      {recommendation.impact && (
        <div>
          <strong>Expected impact</strong>
          <div className="counterpulse-muted">{recommendation.impact}</div>
        </div>
      )}

      <div className="counterpulse-recommendation__actions">
        <Form method="post">
          <input name="_action" type="hidden" value="apply" />
          <input
            name="recommendationId"
            type="hidden"
            value={recommendation.id}
          />
          <button className="counterpulse-button" type="submit">
            {recommendation.actionLabel}
          </button>
        </Form>
        <Form method="post">
          <input name="_action" type="hidden" value="dismiss" />
          <input
            name="recommendationId"
            type="hidden"
            value={recommendation.id}
          />
          <button className="counterpulse-button-secondary" type="submit">
            Dismiss
          </button>
        </Form>
      </div>
    </div>
  );
}

function getActionLabel(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "Apply";
  }

  const action = (payload as { action?: unknown }).action;

  if (action === "CREATE_DRAFT_EXPERIMENT") return "Create draft experiment";
  if (action === "CREATE_DRAFT_CAMPAIGN") return "Create draft";

  return "Apply";
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
