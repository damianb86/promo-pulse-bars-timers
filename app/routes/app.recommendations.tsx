import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";

import { AppAlert, AppToast } from "../components/Notifications";
import { CampaignPreview } from "../components/CampaignPreview";
import type { PreviewPlacement } from "../components/CampaignPreviewPanel";
import { EmptyStateCard } from "../components/EmptyStateCard";
import { PlanUpgradeCallout } from "../components/PlanUpgradeCallout";
import {
  campaignDesignTemplates,
  defaultCampaignDesignValues,
  type CampaignDesignValues,
} from "../types/campaign-design";
import {
  buildCampaignViewModel,
  type CampaignViewModel,
} from "../utils/campaign-view-model";
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

type RecommendationEvidence = {
  label: string;
  value: string;
  detail?: string;
};

type RecommendationPreview = {
  design: CampaignDesignValues;
  placement: PreviewPlacement;
  viewModel: CampaignViewModel;
};

type RecommendationRow = {
  id: string;
  actionLabel: string;
  campaignId: string | null;
  campaignName: string | null;
  confidence: number;
  description: string;
  evidence: RecommendationEvidence[];
  impact: string | null;
  insight: string;
  preview: RecommendationPreview | null;
  proposalItems: RecommendationEvidence[];
  recommendedAction: string;
  title: string;
  type: string;
};

type RecommendationSummary = {
  campaignLevel: number;
  createdCount: number;
  highConfidence: number;
  shopLevel: number;
  total: number;
};

type LoaderData = {
  lockedReason: string;
  recommendations: RecommendationRow[];
  shopifyDomain: string;
  summary: RecommendationSummary;
};

type ActionData = {
  error?: string;
  notice?: string;
  draftHref?: string;
};

type RecommendationPayloadView = {
  action?: unknown;
  campaign?: DraftCampaignPayloadView;
  evidence?: unknown;
  experiment?: DraftExperimentPayloadView;
  insight?: unknown;
  metrics?: unknown;
  recommendedAction?: unknown;
};

type DraftCampaignPayloadView = {
  name?: unknown;
  type?: unknown;
  goal?: unknown;
  placementType?: unknown;
  headline?: unknown;
  subheadline?: unknown;
  ctaText?: unknown;
  ctaUrl?: unknown;
  country?: unknown;
  locale?: unknown;
  productPath?: unknown;
  freeShippingThreshold?: unknown;
  currencyCode?: unknown;
  timerDurationMinutes?: unknown;
};

type DraftExperimentPayloadView = {
  name?: unknown;
  primaryMetric?: unknown;
  variants?: unknown;
};

type ExperimentVariantPayloadView = {
  name?: unknown;
  weight?: unknown;
  textOverride?: unknown;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const gate = canUsePremiumFeature(shop, "RECOMMENDATIONS");

  if (!gate.allowed) {
    return {
      lockedReason: gate.reason,
      recommendations: [],
      shopifyDomain: shop.shopifyDomain,
      summary: {
        campaignLevel: 0,
        createdCount: 0,
        highConfidence: 0,
        shopLevel: 0,
        total: 0,
      },
    };
  }

  const generation = await generateRecommendationsForShop(shop.id);
  const recommendations = await listRecommendationsForShop(shop.id);
  const rows = recommendations.map((recommendation) => {
    const payload = readRecommendationPayload(recommendation.payload);

    return {
      id: recommendation.id,
      campaignId: recommendation.campaignId,
      campaignName: recommendation.campaign?.name ?? null,
      confidence: recommendation.confidence,
      description: recommendation.description,
      evidence: getEvidence(payload),
      impact: recommendation.impact,
      insight: getText(payload?.insight) ?? recommendation.description,
      preview: buildRecommendationPreview({
        campaignName: recommendation.campaign?.name ?? null,
        campaignPlacements:
          recommendation.campaign?.placements?.map(
            (placement) => placement.placementType,
          ) ?? [],
        campaignType: recommendation.campaign?.type ?? null,
        payload,
      }),
      proposalItems: buildProposalItems(payload),
      recommendedAction:
        getText(payload?.recommendedAction) ??
        getDefaultRecommendedAction(payload),
      title: recommendation.title,
      type: recommendation.type,
      actionLabel: getActionLabel(recommendation.payload),
    };
  });

  return {
    lockedReason: "",
    recommendations: rows,
    shopifyDomain: shop.shopifyDomain,
    summary: buildSummary(rows, generation.created.length),
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
      <div className="counterpulse-campaigns-layout counterpulse-recommendations-page">
        <div className="counterpulse-campaigns-header counterpulse-recommendations-header">
          <div>
            <s-heading>Recommendation engine</s-heading>
            <p>
              Data-backed next actions for campaigns, placements, markets, cart
              intent, and unique-code performance.
            </p>
            <div className="counterpulse-campaigns-header__meta">
              <span>{data.shopifyDomain}</span>
              <span>30-day analysis window</span>
              <span>Draft-only actions</span>
            </div>
          </div>
          <div className="counterpulse-campaigns-header__actions">
            <Form method="post">
              <input name="_action" type="hidden" value="refresh" />
              <button className="counterpulse-button" type="submit">
                <RefreshIcon />
                <span>Refresh recommendations</span>
              </button>
            </Form>
          </div>
        </div>

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

            <div className="counterpulse-campaigns-metrics counterpulse-recommendations-metrics">
              <SummaryMetric
                caption="Open recommendations"
                label="Active opportunities"
                value={data.summary.total}
              />
              <SummaryMetric
                caption="Confidence at or above 75%"
                label="High confidence"
                value={data.summary.highConfidence}
              />
              <SummaryMetric
                caption="Specific campaign improvements"
                label="Campaign-level"
                value={data.summary.campaignLevel}
              />
              <SummaryMetric
                caption={`${data.summary.createdCount} created on this refresh`}
                label="New this load"
                value={data.summary.createdCount}
              />
            </div>

            <section className="counterpulse-recommendations-explainer">
              <ExplainerCard
                icon="signals"
                title="Signals analyzed"
                text="Impressions, clicks, orders, attributed revenue, product views, cart intent, markets, placements, and unique-code usage."
              />
              <ExplainerCard
                icon="rules"
                title="How actions are chosen"
                text="Rules compare recent behavior against thresholds, then suppress duplicates with a recommendation fingerprint."
              />
              <ExplainerCard
                icon="draft"
                title="What applying does"
                text="Apply creates a draft campaign or draft experiment. Nothing is published until the merchant reviews it."
              />
            </section>

            <section className="counterpulse-campaigns-list-header counterpulse-recommendations-list-header">
              <div>
                <h2>Recommended next actions</h2>
                <p>
                  Each card explains the observed signal, the proposed action,
                  and the campaign experience that would be created.
                </p>
              </div>
            </section>

            {data.recommendations.length === 0 ? (
              <EmptyStateCard
                title="No recommendations yet"
                message="Recommendations appear after campaigns have enough recent analytics, attribution, market, cart-intent, or unique-code data."
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
          </>
        )}
      </div>
    </s-page>
  );
}

function SummaryMetric({
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
      <strong>{value}</strong>
      <small>{caption}</small>
    </div>
  );
}

function ExplainerCard({
  icon,
  text,
  title,
}: {
  icon: "signals" | "rules" | "draft";
  text: string;
  title: string;
}) {
  return (
    <div className="counterpulse-recommendations-explainer-card">
      <span className="counterpulse-recommendation-icon">
        <RecommendationIcon kind={icon} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: RecommendationRow;
}) {
  return (
    <article className="counterpulse-recommendation">
      <div className="counterpulse-recommendation__main">
        <div className="counterpulse-recommendation__header">
          <span className="counterpulse-recommendation-icon">
            <RecommendationIcon kind={getRecommendationIcon(recommendation)} />
          </span>
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
            <s-badge
              tone={recommendation.confidence >= 0.75 ? "success" : "info"}
            >
              {Math.round(recommendation.confidence * 100)}% confidence
            </s-badge>
          </div>
        </div>

        <div className="counterpulse-recommendation__insight">
          <strong>Why this is being recommended</strong>
          <p>{recommendation.insight}</p>
        </div>

        {recommendation.evidence.length > 0 && (
          <div className="counterpulse-recommendation-evidence">
            {recommendation.evidence.map((item) => (
              <EvidenceItem item={item} key={`${item.label}-${item.value}`} />
            ))}
          </div>
        )}

        <div className="counterpulse-recommendation__details">
          <div>
            <strong>Observed reason</strong>
            <p>{recommendation.description}</p>
          </div>
          <div>
            <strong>Recommended action</strong>
            <p>{recommendation.recommendedAction}</p>
          </div>
        </div>

        {recommendation.proposalItems.length > 0 && (
          <div className="counterpulse-recommendation-proposal">
            <strong>Draft that will be created</strong>
            <div>
              {recommendation.proposalItems.map((item) => (
                <EvidenceItem item={item} key={`${item.label}-${item.value}`} />
              ))}
            </div>
          </div>
        )}

        {recommendation.impact && (
          <div className="counterpulse-recommendation__impact">
            <strong>Expected impact</strong>
            <p>{recommendation.impact}</p>
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
              <ApplyIcon />
              <span>{recommendation.actionLabel}</span>
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

      {recommendation.preview && (
        <aside className="counterpulse-recommendation-preview">
          <div className="counterpulse-recommendation-preview__header">
            <strong>Recommendation preview</strong>
            <span>{formatEnum(recommendation.preview.placement)}</span>
          </div>
          <CampaignPreview
            design={recommendation.preview.design}
            device="desktop"
            placement={recommendation.preview.placement}
            viewModel={recommendation.preview.viewModel}
          />
        </aside>
      )}
    </article>
  );
}

function EvidenceItem({ item }: { item: RecommendationEvidence }) {
  return (
    <div className="counterpulse-recommendation-evidence__item">
      <span>{item.label}</span>
      <strong>{item.value}</strong>
      {item.detail && <small>{item.detail}</small>}
    </div>
  );
}

function buildSummary(
  recommendations: RecommendationRow[],
  createdCount: number,
): RecommendationSummary {
  return {
    campaignLevel: recommendations.filter((recommendation) =>
      Boolean(recommendation.campaignId),
    ).length,
    createdCount,
    highConfidence: recommendations.filter(
      (recommendation) => recommendation.confidence >= 0.75,
    ).length,
    shopLevel: recommendations.filter(
      (recommendation) => !recommendation.campaignId,
    ).length,
    total: recommendations.length,
  };
}

function buildRecommendationPreview({
  campaignName,
  campaignPlacements,
  campaignType,
  payload,
}: {
  campaignName: string | null;
  campaignPlacements: string[];
  campaignType: string | null;
  payload: RecommendationPayloadView | null;
}): RecommendationPreview | null {
  if (payload?.action === "CREATE_DRAFT_CAMPAIGN" && payload.campaign) {
    return buildCampaignPayloadPreview(payload.campaign);
  }

  if (payload?.action === "CREATE_DRAFT_EXPERIMENT" && payload.experiment) {
    return buildExperimentPayloadPreview({
      campaignName,
      campaignPlacements,
      campaignType,
      experiment: payload.experiment,
    });
  }

  return null;
}

function buildCampaignPayloadPreview(
  campaign: DraftCampaignPayloadView,
): RecommendationPreview | null {
  const type = getText(campaign.type);
  const placementType = getText(campaign.placementType);
  const name = getText(campaign.name);

  if (!type || !placementType || !name) return null;

  const design = getPreviewDesign(type);
  const placement = toPreviewPlacement(placementType, type);

  return {
    design,
    placement,
    viewModel: buildCampaignViewModel({
      name,
      type,
      timezone: "UTC",
      placements: [{ placementType, enabled: true }],
      translations: [
        {
          locale: getText(campaign.locale) ?? "en",
          headline: getText(campaign.headline) ?? name,
          subheadline: getText(campaign.subheadline),
          ctaText: getText(campaign.ctaText) ?? "Shop offer",
          ctaUrl: getText(campaign.ctaUrl) ?? "/collections/all",
          freeShippingEmptyText: "Add items to unlock free shipping.",
          freeShippingProgressText:
            "You are {{ remaining_amount }} away from free shipping.",
          freeShippingSuccessText: "Free shipping unlocked.",
          deliveryBeforeCutoffText:
            "Order today for the current delivery window.",
          deliveryAfterCutoffText: "Order now for the next delivery window.",
          lowStockText: "Limited quantity available.",
          badgeText: getText(campaign.headline) ?? name,
        },
      ],
      design,
      timerSettings: isTimerCampaignType(type)
        ? {
            durationMinutes: getNumber(campaign.timerDurationMinutes) ?? 240,
            expiredBehavior: "UNPUBLISH_TIMER",
            mode: "EVERGREEN_SESSION",
            resetBehavior: "NEVER",
          }
        : null,
      cartRescueSettings:
        type === "CART_TIMER"
          ? {
              rescueReason: "CHECKOUT_REMINDER",
              showButton: true,
              showTimer: true,
            }
          : null,
      deliveryCutoffSettings:
        type === "DELIVERY_CUTOFF"
          ? {
              cutoffHour: 14,
              cutoffMinute: 0,
              maxDeliveryDays: 5,
              minDeliveryDays: 2,
              processingDays: 1,
            }
          : null,
      freeShippingSettings:
        type === "FREE_SHIPPING_GOAL"
          ? {
              currencyCode: getText(campaign.currencyCode) ?? "USD",
              emptyCartMessage: "Add items to unlock free shipping.",
              includeDiscountedSubtotal: true,
              progressStyle: "BAR",
              successMessage: "Free shipping unlocked.",
              thresholdAmount: getText(campaign.freeShippingThreshold) ?? "75",
            }
          : null,
      lowStockSettings: null,
      badgeSettings:
        type === "PRODUCT_BADGE"
          ? {
              badgePosition: "TOP_RIGHT",
              badgeShape: "PILL",
              badgeText: getText(campaign.headline) ?? name,
            }
          : null,
      discountSync: null,
    }),
  };
}

function buildExperimentPayloadPreview({
  campaignName,
  campaignPlacements,
  campaignType,
  experiment,
}: {
  campaignName: string | null;
  campaignPlacements: string[];
  campaignType: string | null;
  experiment: DraftExperimentPayloadView;
}): RecommendationPreview | null {
  const variants = getExperimentVariants(experiment);
  const treatment = variants.find((variant) =>
    hasTextOverride(variant.textOverride),
  );
  const textOverride = readTextOverride(treatment?.textOverride);
  const type = campaignType ?? "COUNTDOWN_BAR";
  const placementType = campaignPlacements[0] ?? "TOP_BAR";
  const name =
    getText(experiment.name) ?? campaignName ?? "Recommendation test";
  const design = getPreviewDesign(type);

  return {
    design,
    placement: toPreviewPlacement(placementType, type),
    viewModel: buildCampaignViewModel({
      name,
      type,
      timezone: "UTC",
      placements: [{ placementType, enabled: true }],
      translations: [
        {
          locale: "en",
          headline:
            textOverride.headline ??
            (campaignName ? `${campaignName} treatment` : "Recommended copy"),
          subheadline:
            textOverride.subheadline ??
            "Draft experiment variant generated from performance signals.",
          ctaText: textOverride.ctaText ?? "Shop offer",
          ctaUrl: "/collections/all",
          badgeText: textOverride.headline ?? "Recommended copy",
        },
      ],
      design,
      timerSettings: isTimerCampaignType(type)
        ? {
            durationMinutes: 240,
            expiredBehavior: "UNPUBLISH_TIMER",
            mode: "EVERGREEN_SESSION",
            resetBehavior: "NEVER",
          }
        : null,
      cartRescueSettings: null,
      deliveryCutoffSettings: null,
      freeShippingSettings: null,
      lowStockSettings: null,
      badgeSettings: null,
      discountSync: null,
    }),
  };
}

function buildProposalItems(
  payload: RecommendationPayloadView | null,
): RecommendationEvidence[] {
  if (payload?.action === "CREATE_DRAFT_CAMPAIGN" && payload.campaign) {
    const campaign = payload.campaign;

    return [
      item("Type", getText(campaign.type), formatEnumValue),
      item("Placement", getText(campaign.placementType), formatEnumValue),
      item("Headline", getText(campaign.headline)),
      item("CTA", getText(campaign.ctaText)),
      item("Country", getText(campaign.country)),
      item("Threshold", getText(campaign.freeShippingThreshold)),
      item(
        "Timer",
        getNumber(campaign.timerDurationMinutes)
          ? `${getNumber(campaign.timerDurationMinutes)} min`
          : null,
      ),
    ].filter(Boolean) as RecommendationEvidence[];
  }

  if (payload?.action === "CREATE_DRAFT_EXPERIMENT" && payload.experiment) {
    const variants = getExperimentVariants(payload.experiment);

    return [
      item("Experiment", getText(payload.experiment.name)),
      item(
        "Primary metric",
        getText(payload.experiment.primaryMetric),
        formatEnumValue,
      ),
      item("Variants", variants.length ? String(variants.length) : null),
      item(
        "Treatment",
        getText(readTextOverride(variants[1]?.textOverride).headline) ??
          getText(variants[1]?.name),
      ),
    ].filter(Boolean) as RecommendationEvidence[];
  }

  return [];
}

function getEvidence(
  payload: RecommendationPayloadView | null,
): RecommendationEvidence[] {
  if (Array.isArray(payload?.evidence)) {
    return payload.evidence.filter(isEvidence);
  }

  if (!payload?.metrics || typeof payload.metrics !== "object") return [];

  return Object.entries(payload.metrics)
    .slice(0, 4)
    .map(([label, value]) => ({
      label: formatEnumValue(label),
      value: String(value ?? "n/a"),
    }));
}

function getDefaultRecommendedAction(
  payload: RecommendationPayloadView | null,
) {
  if (payload?.action === "CREATE_DRAFT_EXPERIMENT") {
    return "Create a draft experiment, review variants, and start it only when the setup is correct.";
  }

  if (payload?.action === "CREATE_DRAFT_CAMPAIGN") {
    return "Create a draft campaign, review copy, targeting, placement, and design before publishing.";
  }

  return "Review the recommendation and decide whether to create a draft.";
}

function readRecommendationPayload(
  payload: unknown,
): RecommendationPayloadView | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return payload as RecommendationPayloadView;
}

function getActionLabel(payload: unknown) {
  const parsed = readRecommendationPayload(payload);

  if (parsed?.action === "CREATE_DRAFT_EXPERIMENT") {
    return "Create draft experiment";
  }

  if (parsed?.action === "CREATE_DRAFT_CAMPAIGN") return "Create draft";

  return "Apply";
}

function getPreviewDesign(type: string): CampaignDesignValues {
  const templateKey =
    type === "FREE_SHIPPING_GOAL"
      ? "free-shipping"
      : type === "DELIVERY_CUTOFF"
        ? "delivery-cutoff"
        : type === "LOW_STOCK"
          ? "low-stock"
          : type === "CART_TIMER"
            ? "premium-dark"
            : type === "PRODUCT_BADGE"
              ? "low-stock"
              : "flash-sale";
  const template =
    campaignDesignTemplates.find((item) => item.templateKey === templateKey) ??
    defaultCampaignDesignValues;

  return { ...template };
}

function toPreviewPlacement(
  placementType: string,
  type: string,
): PreviewPlacement {
  if (type === "PRODUCT_BADGE") return "PRODUCT_BADGE";
  if (
    placementType === "PRODUCT_PAGE_BADGE" ||
    placementType === "COLLECTION_CARD"
  ) {
    return "PRODUCT_BADGE";
  }
  if (
    placementType === "TOP_BAR" ||
    placementType === "BOTTOM_BAR" ||
    placementType === "PRODUCT_PAGE" ||
    placementType === "CART_PAGE" ||
    placementType === "CART_DRAWER"
  ) {
    return placementType;
  }
  if (type === "CART_TIMER" || type === "FREE_SHIPPING_GOAL") {
    return "CART_DRAWER";
  }
  if (type === "PRODUCT_TIMER" || type === "DELIVERY_CUTOFF") {
    return "PRODUCT_PAGE";
  }
  return "TOP_BAR";
}

function isTimerCampaignType(type: string) {
  return (
    type === "COUNTDOWN_BAR" ||
    type === "PRODUCT_TIMER" ||
    type === "CART_TIMER"
  );
}

function getExperimentVariants(
  experiment: DraftExperimentPayloadView,
): ExperimentVariantPayloadView[] {
  if (!Array.isArray(experiment.variants)) return [];

  return experiment.variants.filter(
    (variant): variant is ExperimentVariantPayloadView =>
      Boolean(variant) &&
      typeof variant === "object" &&
      !Array.isArray(variant),
  );
}

function hasTextOverride(value: unknown) {
  const override = readTextOverride(value);

  return Boolean(override.headline || override.subheadline || override.ctaText);
}

function readTextOverride(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;

  return {
    headline: getText(input.headline),
    subheadline: getText(input.subheadline),
    ctaText: getText(input.ctaText),
  };
}

function item(
  label: string,
  value: string | null | undefined,
  formatter: (value: string) => string = (input) => input,
): RecommendationEvidence | null {
  if (!value) return null;

  return {
    label,
    value: formatter(value),
  };
}

function isEvidence(value: unknown): value is RecommendationEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const input = value as Partial<RecommendationEvidence>;

  return typeof input.label === "string" && typeof input.value === "string";
}

function getText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRecommendationIcon(recommendation: RecommendationRow) {
  if (recommendation.type === "PLACEMENT") return "placement";
  if (recommendation.type === "DISCOUNT_VALUE") return "discount";
  if (recommendation.type === "MARKET_LOCALIZATION") return "market";
  if (recommendation.type === "TIMING") return "timing";
  if (recommendation.type === "CAMPAIGN_TEMPLATE") return "draft";

  return "message";
}

function RecommendationIcon({
  kind,
}: {
  kind:
    | "discount"
    | "draft"
    | "market"
    | "message"
    | "placement"
    | "rules"
    | "signals"
    | "timing";
}) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      {kind === "signals" && (
        <path
          d="M4 18.5h16M6.5 15v-4M12 15V5.5M17.5 15V8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      )}
      {kind === "rules" && (
        <path
          d="M5 7h14M5 12h10M5 17h7M17 15l1.8 1.8L22 13.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {kind === "draft" && (
        <path
          d="M6 4.5h8l4 4V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1ZM14 4.5V9h4M8 13h7M8 16h5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {kind === "message" && (
        <path
          d="M5 6.5h14v9H9l-4 3v-12Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {kind === "placement" && (
        <path
          d="M4.5 5.5h15v13h-15zM4.5 9.5h15M8 15h8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {kind === "discount" && (
        <>
          <path
            d="M4.5 12.2 12.2 4H20v7.8L11.8 20z"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <circle cx="16.6" cy="7.4" r="1.2" fill="currentColor" />
        </>
      )}
      {kind === "market" && (
        <>
          <circle
            cx="12"
            cy="12"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M4.5 12h15M12 4c2.1 2.2 3.2 4.8 3.2 8s-1.1 5.8-3.2 8c-2.1-2.2-3.2-4.8-3.2-8S9.9 6.2 12 4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      )}
      {kind === "timing" && (
        <path
          d="M12 7v5l3.2 2M6.5 4.8 4 7.3M17.5 4.8 20 7.3M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path
        d="M20 12a8 8 0 0 1-13.4 5.9M4 12A8 8 0 0 1 17.4 6.1M17.5 3.8v4.5h-4.5M6.5 20.2v-4.5H11"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ApplyIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path
        d="m5 12 4.2 4.2L19 6.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function formatEnum(value: string) {
  return formatEnumValue(value);
}

function formatEnumValue(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
