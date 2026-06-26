import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Form, useFetcher, useNavigation } from "react-router";

import { AiGenerateIcon } from "./AiGenerateIcon";
import { CampaignPromoSurface } from "./CampaignPreview";
import { DesignControls } from "./DesignControls";
import { DevicePreviewToggle, type PreviewDevice } from "./DevicePreviewToggle";
import { AppAlert, FieldInfoButton } from "./Notifications";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";
import {
  defaultCampaignDesignValues,
  findCampaignDesignTemplate,
  isMobileDesignLayout,
  type CampaignDesignMediaOptions,
  type CampaignDesignValues,
} from "../types/campaign-design";
import { deriveMobileDesignFromDesktop } from "../utils/responsive-design";
import {
  formatCampaignOption,
  placementTypeOptions,
  type PlacementTypeValue,
} from "../types/campaign-options";
import type { CampaignViewModel } from "../utils/campaign-view-model";

export type ExperimentVariantRow = {
  id: string;
  name: string;
  weight: number;
  status: string;
  designOverrideJson: string;
  textOverrideJson: string;
  discountOverrideJson: string;
  placementOverrideJson: string;
};

export type ExperimentVariantResultRow = {
  variantId: string;
  variantName: string;
  trafficSplit: number;
  impressions: number;
  clicks: number;
  ctr: number;
  addToCart: number;
  checkoutStarted: number;
  orders: number;
  revenue: number;
  revenuePerVisitor: number;
  conversionRate: number;
  visitors: number;
  primaryMetricValue: number;
};

export type ExperimentRow = {
  id: string;
  name: string;
  status: string;
  primaryMetric: string;
  trafficSplitStrategy: string;
  startsAt: string;
  endsAt: string;
  winnerVariantId: string;
  winnerAppliedAt: string;
  autoWinnerEnabled: boolean;
  autoWinnerMinSampleSize: number;
  autoWinnerMinRuntimeHours: number;
  autoWinnerConfidenceThreshold: number;
  variants: ExperimentVariantRow[];
  results: {
    runtimeHours: number;
    currencyCode: string;
    variants: ExperimentVariantResultRow[];
  };
};

export type ExperimentErrors = {
  form?: string;
  [key: string]: string | undefined;
};

type ExperimentsEditorProps = {
  baseDesign: CampaignDesignValues;
  baseViewModel: CampaignViewModel;
  designMediaOptions: CampaignDesignMediaOptions;
  errors?: ExperimentErrors;
  experiments: ExperimentRow[];
  isProPlan: boolean;
  lockedReason?: string;
  notice?: string;
};

type TextOverrideKey =
  | "headline"
  | "subheadline"
  | "ctaText"
  | "ctaUrl"
  | "expiredText"
  | "freeShippingEmptyText"
  | "freeShippingProgressText"
  | "freeShippingSuccessText"
  | "deliveryBeforeCutoffText"
  | "deliveryAfterCutoffText"
  | "lowStockText"
  | "badgeText";

type VariantTextDraft = Record<TextOverrideKey, string>;

type VariantPlacementDraft = {
  placementType: PlacementTypeValue | "";
  customSelector: string;
};

type VariantDraft = {
  id: string;
  name: string;
  weight: number;
  status: string;
  text: VariantTextDraft;
  design: CampaignDesignValues;
  mobileDesign: CampaignDesignValues;
  placement: VariantPlacementDraft;
};

type DrawerTab = "copy" | "placement" | "design" | "settings";
type AiVariantStrategy =
  | "urgency"
  | "benefit"
  | "trust"
  | "gentle"
  | "premium"
  | "visual";
type AiVariantDesignIntensity = "copy_only" | "balanced" | "bold";
type AiVariantPlacementIntent = "inherit" | "engagement" | "product" | "cart";
type AiVariantRequestDraft = {
  strategy: AiVariantStrategy;
  designIntensity: AiVariantDesignIntensity;
  placementIntent: AiVariantPlacementIntent;
  notes: string;
};
type AiVariantSuggestion = {
  name: string;
  rationale: string;
  hypothesis: string;
  text: Partial<VariantTextDraft>;
  design: Partial<CampaignDesignValues> & {
    mobileDesign?: Partial<CampaignDesignValues>;
  };
  placement: Partial<VariantPlacementDraft>;
};
type AiVariantFetcherData = {
  aiVariant?: {
    source: "mock" | "provider";
    variant: AiVariantSuggestion;
  };
  aiVariantError?: string;
};
type VariantEditRequest = {
  requestId: number;
  variantId: string;
};
type LifecycleActionValue =
  | "startExperiment"
  | "pauseExperiment"
  | "stopExperiment";

const metricOptions = [
  { label: "CTR", value: "CLICK_RATE" },
  { label: "Add-to-cart rate", value: "ADD_TO_CART_RATE" },
  { label: "Checkout rate", value: "CHECKOUT_RATE" },
  { label: "Revenue per visitor", value: "REVENUE_PER_VISITOR" },
];

const aiVariantStrategyOptions: Array<{
  value: AiVariantStrategy;
  label: string;
  description: string;
}> = [
  {
    value: "benefit",
    label: "Benefit-led clarity",
    description:
      "Make the value proposition easier to scan and pair it with a clearer CTA.",
  },
  {
    value: "urgency",
    label: "Urgency push",
    description:
      "Sharper deadline language, stronger contrast, and a more immediate CTA.",
  },
  {
    value: "trust",
    label: "Trust and proof",
    description:
      "Reduce hesitation with calmer copy, confidence cues, and cleaner styling.",
  },
  {
    value: "gentle",
    label: "Soft reminder",
    description:
      "Lower-pressure language for shoppers who respond poorly to hard urgency.",
  },
  {
    value: "premium",
    label: "Premium polish",
    description:
      "More refined copy and restrained styling for high-intent audiences.",
  },
  {
    value: "visual",
    label: "Visual contrast",
    description:
      "Keep the offer close to control while testing layout, color, timer, and icon emphasis.",
  },
];

const aiVariantDesignIntensityOptions: Array<{
  value: AiVariantDesignIntensity;
  label: string;
  description: string;
}> = [
  {
    value: "balanced",
    label: "Balanced copy + design",
    description: "Adjust copy and design enough to create a meaningful test.",
  },
  {
    value: "copy_only",
    label: "Copy only",
    description:
      "Change text and CTA while keeping the campaign design stable.",
  },
  {
    value: "bold",
    label: "Bold creative",
    description:
      "Allow larger layout, color, typography, motion, and timer changes.",
  },
];

const aiVariantPlacementIntentOptions: Array<{
  value: AiVariantPlacementIntent;
  label: string;
  description: string;
}> = [
  {
    value: "inherit",
    label: "Keep campaign placement",
    description: "Use the same placement as the control for a cleaner test.",
  },
  {
    value: "engagement",
    label: "Optimize for engagement",
    description: "Let AI decide only if a placement change is useful.",
  },
  {
    value: "product",
    label: "Product-page focus",
    description:
      "Bias the variant toward product detail page decision moments.",
  },
  {
    value: "cart",
    label: "Cart intent focus",
    description: "Bias the variant toward cart drawer or cart-page shoppers.",
  },
];

const defaultAiVariantRequest: AiVariantRequestDraft = {
  strategy: "benefit",
  designIntensity: "balanced",
  placementIntent: "inherit",
  notes: "",
};

const variantStatuses = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "WINNER",
  "LOSER",
  "ARCHIVED",
];

const collapsedVariantChangeCount = 3;

const defaultVariantRows: ExperimentVariantRow[] = [
  {
    id: "",
    name: "Control",
    weight: 100,
    status: "DRAFT",
    designOverrideJson: "",
    textOverrideJson: "",
    discountOverrideJson: "",
    placementOverrideJson: "",
  },
];

const textFields: Array<{
  key: TextOverrideKey;
  label: string;
  description: string;
  maxLength?: number;
}> = [
  {
    key: "headline",
    label: "Headline",
    description: "Main title shown in the campaign surface.",
    maxLength: 80,
  },
  {
    key: "subheadline",
    label: "Subheadline",
    description: "Supporting message below the headline.",
    maxLength: 140,
  },
  {
    key: "ctaText",
    label: "CTA text",
    description: "Button text for the primary action.",
    maxLength: 40,
  },
  {
    key: "ctaUrl",
    label: "CTA URL",
    description: "Destination URL for the variant CTA.",
  },
  {
    key: "expiredText",
    label: "Expired message",
    description: "Message shown after the timer expires.",
    maxLength: 120,
  },
  {
    key: "freeShippingEmptyText",
    label: "Free shipping empty-cart message",
    description: "Free shipping title when the cart is empty.",
    maxLength: 140,
  },
  {
    key: "freeShippingProgressText",
    label: "Free shipping progress message",
    description: "Message while shoppers move toward the threshold.",
    maxLength: 160,
  },
  {
    key: "freeShippingSuccessText",
    label: "Free shipping success message",
    description: "Message after the threshold is reached.",
    maxLength: 140,
  },
  {
    key: "deliveryBeforeCutoffText",
    label: "Delivery before-cutoff message",
    description: "Delivery promise shown before the cutoff time.",
    maxLength: 160,
  },
  {
    key: "deliveryAfterCutoffText",
    label: "Delivery after-cutoff message",
    description: "Delivery promise shown after the cutoff time.",
    maxLength: 160,
  },
  {
    key: "lowStockText",
    label: "Low stock message",
    description: "Message used by low-stock campaigns.",
    maxLength: 120,
  },
  {
    key: "badgeText",
    label: "Badge title",
    description: "Text shown inside product badges.",
    maxLength: 60,
  },
];

const designOverrideKeys: Array<keyof CampaignDesignValues> = [
  "templateKey",
  "layout",
  "backgroundType",
  "backgroundColor",
  "backgroundImageUrl",
  "gradientStartColor",
  "gradientEndColor",
  "gradientAngle",
  "textColor",
  "accentColor",
  "buttonColor",
  "buttonTextColor",
  "closeButtonColor",
  "fontSize",
  "borderRadius",
  "borderSize",
  "borderColor",
  "fontFamily",
  "titleFontSize",
  "titleColor",
  "subheadingFontSize",
  "subheadingColor",
  "timerFontSize",
  "timerColor",
  "legendFontSize",
  "legendColor",
  "timerStyle",
  "timerFormat",
  "timerShowLabels",
  "timerShowSeconds",
  "timerDaysLabel",
  "timerHoursLabel",
  "timerMinutesLabel",
  "timerSecondsLabel",
  "timerHideZeroDays",
  "timerSurfaceColor",
  "timerSurfaceBorderColor",
  "timerSurfaceBorderSize",
  "timerSurfaceRadius",
  "paddingBlock",
  "paddingInline",
  "contentGap",
  "contentMaxWidth",
  "fullWidth",
  "positionMode",
  "positionSticky",
  "entranceAnimation",
  "exitAnimation",
  "animationDurationMs",
  "timerTickAnimation",
  "customCss",
  "alignment",
  "showCloseButton",
  "showButton",
  "showProgressBar",
  "showIcon",
  "icon",
  "iconSize",
  "customIconUrl",
  "mobileEnabled",
];

const backgroundDesignKeys: Array<keyof CampaignDesignValues> = [
  "backgroundType",
  "backgroundColor",
  "backgroundImageUrl",
  "gradientStartColor",
  "gradientEndColor",
  "gradientAngle",
];

const cardDesignKeys: Array<keyof CampaignDesignValues> = [
  "alignment",
  "borderRadius",
  "borderSize",
  "borderColor",
  "paddingBlock",
  "paddingInline",
  "contentGap",
  "contentMaxWidth",
  "fullWidth",
  "positionMode",
  "positionSticky",
];

const typographyDesignKeys: Array<keyof CampaignDesignValues> = [
  "fontFamily",
  "fontSize",
  "textColor",
  "titleFontSize",
  "titleColor",
  "subheadingFontSize",
  "subheadingColor",
];

const timerDesignKeys: Array<keyof CampaignDesignValues> = [
  "timerStyle",
  "timerFormat",
  "timerFontSize",
  "timerColor",
  "legendFontSize",
  "legendColor",
  "timerShowLabels",
  "timerShowSeconds",
  "timerDaysLabel",
  "timerHoursLabel",
  "timerMinutesLabel",
  "timerSecondsLabel",
  "timerHideZeroDays",
  "timerSurfaceColor",
  "timerSurfaceBorderColor",
  "timerSurfaceBorderSize",
  "timerSurfaceRadius",
];

const elementDesignKeys: Array<keyof CampaignDesignValues> = [
  "accentColor",
  "buttonColor",
  "buttonTextColor",
  "closeButtonColor",
  "showCloseButton",
  "showButton",
  "showProgressBar",
  "showIcon",
  "icon",
  "iconSize",
  "customIconUrl",
  "mobileEnabled",
];

const motionDesignKeys: Array<keyof CampaignDesignValues> = [
  "entranceAnimation",
  "exitAnimation",
  "animationDurationMs",
  "timerTickAnimation",
];

const summarizedDesignKeys: Array<keyof CampaignDesignValues> = [
  "templateKey",
  "layout",
  "customCss",
  ...backgroundDesignKeys,
  ...cardDesignKeys,
  ...typographyDesignKeys,
  ...timerDesignKeys,
  ...elementDesignKeys,
  ...motionDesignKeys,
];

export function ExperimentsEditor({
  baseDesign,
  baseViewModel,
  designMediaOptions,
  errors,
  experiments,
  isProPlan,
  lockedReason,
  notice,
}: ExperimentsEditorProps) {
  const openExperiments = experiments.filter(
    (experiment) => experiment.status !== "COMPLETED",
  );
  const completedExperiments = experiments.filter(
    (experiment) => experiment.status === "COMPLETED",
  );
  const canCreateNewExperiment = openExperiments.length === 0;

  return (
    <s-section heading="Experiments">
      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Experiments are locked"
        />
      )}

      {notice && (
        <AppAlert
          tone="info"
          title={
            notice.includes("created as draft")
              ? "Experiment created as draft"
              : "Experiments updated"
          }
        >
          <s-paragraph>{notice}</s-paragraph>
        </AppAlert>
      )}

      {errors?.form && (
        <AppAlert tone="critical" title="Experiments could not be updated">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {!lockedReason && (
        <div className="counterpulse-experiments">
          <ExperimentIntro />

          {canCreateNewExperiment && (
            <ExperimentComposer
              baseDesign={baseDesign}
              baseViewModel={baseViewModel}
              designMediaOptions={designMediaOptions}
              isProPlan={isProPlan}
            />
          )}

          <div className="counterpulse-experiments-list">
            {openExperiments.map((experiment) => (
              <ExistingExperiment
                baseDesign={baseDesign}
                baseViewModel={baseViewModel}
                canDuplicateCompletedExperiment={false}
                designMediaOptions={designMediaOptions}
                experiment={experiment}
                isProPlan={isProPlan}
                key={experiment.id}
              />
            ))}

            {completedExperiments.length > 0 ? (
              <section className="counterpulse-experiment-history">
                <div className="counterpulse-experiment-history__header">
                  <div>
                    <h3>Completed experiments</h3>
                    <p>
                      Historical results are locked after a winner is declared.
                    </p>
                  </div>
                </div>
                <div className="counterpulse-experiment-history__list">
                  {completedExperiments.map((experiment) => (
                    <CompletedExperimentCard
                      baseDesign={baseDesign}
                      baseViewModel={baseViewModel}
                      canDuplicateExperiment={canCreateNewExperiment}
                      experiment={experiment}
                      key={experiment.id}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      )}
    </s-section>
  );
}

function ExperimentIntro() {
  return (
    <section className="counterpulse-experiment-hero">
      <div>
        <p className="counterpulse-kicker">A/B Testing</p>
        <h2>Campaign experiments</h2>
        <p>
          Test controlled variants of the same campaign to compare messages, CTA
          URLs, placement, and visual design. Every variant inherits the same
          offers, targeting, markets, schedule, and discount setup from the base
          campaign.
        </p>
      </div>
      <dl>
        <div>
          <dt>Editable</dt>
          <dd>Copy, CTA, placement, design</dd>
        </div>
        <div>
          <dt>Locked</dt>
          <dd>Offers, targeting, markets</dd>
        </div>
      </dl>
    </section>
  );
}

function ExistingExperiment({
  baseDesign,
  baseViewModel,
  canDuplicateCompletedExperiment,
  designMediaOptions,
  experiment,
  isProPlan,
}: {
  baseDesign: CampaignDesignValues;
  baseViewModel: CampaignViewModel;
  canDuplicateCompletedExperiment: boolean;
  designMediaOptions: CampaignDesignMediaOptions;
  experiment: ExperimentRow;
  isProPlan: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [variantEditRequest, setVariantEditRequest] =
    useState<VariantEditRequest | null>(null);
  const canEditExperiment = experiment.status !== "COMPLETED";
  const openVariantEditor = (variantId: string) => {
    setVariantEditRequest({ variantId, requestId: Date.now() });
    setIsEditing(true);
  };
  const closeExperimentEditor = () => {
    setVariantEditRequest(null);
    setIsEditing(false);
  };
  const openExperimentEditor = () => {
    setVariantEditRequest(null);
    setIsEditing(true);
  };

  if (experiment.status === "COMPLETED") {
    return (
      <CompletedExperimentCard
        baseDesign={baseDesign}
        baseViewModel={baseViewModel}
        canDuplicateExperiment={canDuplicateCompletedExperiment}
        experiment={experiment}
      />
    );
  }

  return (
    <section className="counterpulse-experiment-shell">
      {isEditing && canEditExperiment ? (
        <ExperimentComposer
          baseDesign={baseDesign}
          baseViewModel={baseViewModel}
          designMediaOptions={designMediaOptions}
          experiment={experiment}
          isProPlan={isProPlan}
          key={variantEditRequest?.requestId ?? "experiment-editor"}
          variantEditRequest={variantEditRequest}
          onClose={closeExperimentEditor}
        />
      ) : (
        <ExperimentSummary
          canEdit={canEditExperiment}
          experiment={experiment}
          isEditing={isEditing}
          onEdit={openExperimentEditor}
        />
      )}

      <ExperimentResultsTable
        canEdit={canEditExperiment}
        experiment={experiment}
        onEditVariant={openVariantEditor}
      />
      <ExperimentAutoWinnerForm experiment={experiment} />
      <ExperimentLifecycleActions
        canDuplicateCompletedExperiment={canDuplicateCompletedExperiment}
        experiment={experiment}
      />
    </section>
  );
}

function CompletedExperimentCard({
  baseDesign,
  baseViewModel,
  canDuplicateExperiment,
  experiment,
}: {
  baseDesign: CampaignDesignValues;
  baseViewModel: CampaignViewModel;
  canDuplicateExperiment: boolean;
  experiment: ExperimentRow;
}) {
  const visibleVariants = experiment.variants.filter(
    (variant) => variant.status !== "ARCHIVED",
  );
  const winnerVariant =
    visibleVariants.find(
      (variant) => variant.id === experiment.winnerVariantId,
    ) ??
    visibleVariants[0] ??
    null;
  const winnerResult =
    experiment.results.variants.find(
      (variant) => variant.variantId === experiment.winnerVariantId,
    ) ??
    experiment.results.variants[0] ??
    null;
  const sortedResults = sortExperimentResultsByPrimaryMetric(experiment);
  const runnerUpResult = sortedResults.find(
    (variant) => variant.variantId !== winnerResult?.variantId,
  );
  const totals = calculateExperimentTotals(experiment.results.variants);
  const primaryMetricLift = calculateMetricLift(
    winnerResult?.primaryMetricValue ?? 0,
    runnerUpResult?.primaryMetricValue ?? 0,
  );
  const previewVariant = winnerVariant
    ? toVariantDraft(winnerVariant, baseDesign, baseViewModel)
    : toVariantDraft(defaultVariantRows[0], baseDesign, baseViewModel);
  const preview = buildVariantPreviewModel(baseViewModel, previewVariant);
  const hasWinner = Boolean(experiment.winnerVariantId && winnerResult);
  const isWinnerApplied = Boolean(experiment.winnerAppliedAt);

  return (
    <article className="counterpulse-experiment-history-card">
      <div className="counterpulse-experiment-history-card__winner">
        <div className="counterpulse-experiment-history-card__preview">
          <VariantMiniPreview
            design={previewVariant.design}
            viewModel={preview}
          />
        </div>
        <div className="counterpulse-experiment-history-card__winner-copy">
          <div className="counterpulse-experiment-history-card__badges">
            <ExperimentStatusBadge status={experiment.status} />
            {hasWinner ? (
              <span className="counterpulse-result-winner">Winner</span>
            ) : (
              <span className="counterpulse-experiment-history-card__muted-badge">
                No winner
              </span>
            )}
            {isWinnerApplied ? (
              <span className="counterpulse-experiment-applied-badge">
                Applied
              </span>
            ) : hasWinner ? (
              <span className="counterpulse-experiment-pending-badge">
                Pending apply
              </span>
            ) : null}
          </div>
          <p className="counterpulse-kicker">A/B Testing result</p>
          <h3>{experiment.name}</h3>
          <p>
            {hasWinner
              ? `${winnerResult?.variantName ?? "Winning variant"} won on ${formatMetric(
                  experiment.primaryMetric,
                )}.`
              : "Experiment ended without a declared winner."}
          </p>
        </div>
      </div>

      <dl className="counterpulse-experiment-history-card__stats">
        <div>
          <dt>Winner conversion</dt>
          <dd>
            {winnerResult ? formatPercent(winnerResult.conversionRate) : "-"}
          </dd>
        </div>
        <div>
          <dt>{formatMetric(experiment.primaryMetric)} lift</dt>
          <dd>{primaryMetricLift}</dd>
        </div>
        <div>
          <dt>Visitors</dt>
          <dd>{totals.visitors}</dd>
        </div>
        <div>
          <dt>Revenue</dt>
          <dd>
            {formatCurrency(totals.revenue, experiment.results.currencyCode)}
          </dd>
        </div>
      </dl>

      <div className="counterpulse-experiment-history-card__variants">
        {sortedResults.slice(0, 4).map((variant, index) => (
          <span
            className={
              variant.variantId === experiment.winnerVariantId
                ? "is-winner"
                : ""
            }
            key={variant.variantId}
          >
            <span
              aria-hidden="true"
              className={`counterpulse-variant-dot counterpulse-variant-dot--${index % 6}`}
            />
            <strong>{variant.variantName}</strong>
            <small>{formatPercent(variant.conversionRate)}</small>
          </span>
        ))}
      </div>

      <div className="counterpulse-experiment-history-card__actions">
        {hasWinner && !isWinnerApplied ? (
          <Form method="post">
            <input name="experimentId" type="hidden" value={experiment.id} />
            <button
              className="counterpulse-button counterpulse-button-secondary--small"
              name="_action"
              type="submit"
              value="applyExperimentWinner"
            >
              Apply winner
            </button>
          </Form>
        ) : null}
        <Form method="post">
          <input name="experimentId" type="hidden" value={experiment.id} />
          <button
            className="counterpulse-button-secondary counterpulse-button-secondary--small"
            disabled={!canDuplicateExperiment}
            name="_action"
            title={
              canDuplicateExperiment
                ? undefined
                : "Finish the current experiment before duplicating another."
            }
            type="submit"
            value="duplicateExperiment"
          >
            Duplicate
          </button>
        </Form>
      </div>
    </article>
  );
}

function ExperimentSummary({
  canEdit,
  experiment,
  isEditing,
  onEdit,
}: {
  canEdit: boolean;
  experiment: ExperimentRow;
  isEditing: boolean;
  onEdit: () => void;
}) {
  const visibleVariants = experiment.variants.filter(
    (variant) => variant.status !== "ARCHIVED",
  );
  const winnerVariant = visibleVariants.find(
    (variant) => variant.id === experiment.winnerVariantId,
  );

  return (
    <header className="counterpulse-experiment-summary">
      <div className="counterpulse-experiment-summary__main">
        <div>
          <h2>Experiments</h2>
          <p>Run and analyze A/B tests to find what converts best.</p>
        </div>
        <div className="counterpulse-experiment-summary__actions">
          <ExperimentStatusBadge status={experiment.status} />
          <span className="counterpulse-experiment-runtime">
            <span aria-hidden="true">◷</span>
            {experiment.results.runtimeHours.toFixed(1)} runtime hours
          </span>
          {canEdit && !isEditing && (
            <button
              aria-label="Edit experiment"
              className="counterpulse-button-secondary counterpulse-experiment-summary__details-button"
              type="button"
              onClick={onEdit}
            >
              <span aria-hidden="true">☰</span>
              View experiment details
            </button>
          )}
        </div>
      </div>

      <div className="counterpulse-experiment-summary__overview">
        <div>
          <p className="counterpulse-kicker">A/B Testing</p>
          <h3>{experiment.name}</h3>
          <p>{getExperimentStatusDescription(experiment)}</p>
        </div>

        <dl className="counterpulse-experiment-summary__stats">
          <div>
            <dt>Primary metric</dt>
            <dd>{formatMetric(experiment.primaryMetric)}</dd>
          </div>
          <div>
            <dt>Variants</dt>
            <dd>{visibleVariants.length}</dd>
          </div>
          <div>
            <dt>Traffic split</dt>
            <dd>
              {visibleVariants
                .map((variant) => `${variant.weight}%`)
                .join(" / ")}
            </dd>
          </div>
          <div>
            <dt>Winner</dt>
            <dd>{winnerVariant?.name || "Not declared"}</dd>
          </div>
        </dl>
      </div>

      <div className="counterpulse-experiment-summary__variants">
        {visibleVariants.map((variant, index) => (
          <span key={variant.id || variant.name}>
            <span
              className={`counterpulse-variant-dot counterpulse-variant-dot--${index % 6}`}
              aria-hidden="true"
            />
            {variant.name}
            <small>{variant.weight}%</small>
          </span>
        ))}
      </div>
    </header>
  );
}

function ExperimentStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`counterpulse-experiment-status counterpulse-experiment-status--${status.toLowerCase()}`}
    >
      {formatExperimentStatus(status)}
    </span>
  );
}

function ExperimentComposer({
  baseDesign,
  baseViewModel,
  designMediaOptions,
  experiment,
  isProPlan,
  variantEditRequest,
  onClose,
}: {
  baseDesign: CampaignDesignValues;
  baseViewModel: CampaignViewModel;
  designMediaOptions: CampaignDesignMediaOptions;
  experiment?: ExperimentRow;
  isProPlan: boolean;
  variantEditRequest?: VariantEditRequest | null;
  onClose?: () => void;
}) {
  const navigation = useNavigation();
  const aiVariantFetcher = useFetcher<AiVariantFetcherData>();
  const isSubmitting = navigation.state === "submitting";
  const isAiVariantGenerating = aiVariantFetcher.state !== "idle";
  const initialVariants = useMemo(
    () =>
      normalizeVariantWeights(
        (experiment?.variants.length ? experiment.variants : defaultVariantRows)
          .filter((variant) => variant.status !== "ARCHIVED")
          .map((variant) => toVariantDraft(variant, baseDesign, baseViewModel)),
      ),
    [baseDesign, baseViewModel, experiment],
  );
  const initialArchivedVariants = useMemo(
    () =>
      (experiment?.variants ?? [])
        .filter((variant) => variant.status === "ARCHIVED")
        .map((variant) => toVariantDraft(variant, baseDesign, baseViewModel)),
    [baseDesign, baseViewModel, experiment],
  );
  const [variants, setVariants] = useState<VariantDraft[]>(initialVariants);
  const [archivedVariants, setArchivedVariants] = useState<VariantDraft[]>(
    initialArchivedVariants,
  );

  // The control variant always mirrors the live campaign. When the campaign is
  // saved (baseDesign) or its copy changes (baseViewModel), refresh the control
  // in place so its preview matches the design preview without a page refresh.
  // Derived during render (React's "adjust state when a prop changes" pattern)
  // so the control updates synchronously without an extra effect pass.
  const controlDesign = useMemo(
    () => normalizeDesign({ ...baseDesign }),
    [baseDesign],
  );
  const controlMobileDesign = useMemo(
    () => normalizeDesign(deriveMobileDesignFromDesktop(baseDesign)),
    [baseDesign],
  );
  const controlText = useMemo(
    () => toTextDraft({}, baseViewModel),
    [baseViewModel],
  );
  const controlSyncKey = useMemo(
    () => JSON.stringify([controlDesign, controlMobileDesign, controlText]),
    [controlDesign, controlMobileDesign, controlText],
  );
  const [appliedControlSyncKey, setAppliedControlSyncKey] =
    useState(controlSyncKey);

  if (controlSyncKey !== appliedControlSyncKey) {
    setAppliedControlSyncKey(controlSyncKey);
    setVariants((current) =>
      current.length === 0
        ? current
        : [
            {
              ...current[0],
              design: controlDesign,
              mobileDesign: controlMobileDesign,
              text: controlText,
            },
            ...current.slice(1),
          ],
    );
  }
  const initialActiveVariantIndex = useMemo(() => {
    if (!variantEditRequest?.variantId) return -1;

    const variantIndex = initialVariants.findIndex(
      (variant) => variant.id === variantEditRequest.variantId,
    );

    return variantIndex > 0 ? variantIndex : -1;
  }, [initialVariants, variantEditRequest]);
  const [activeVariantIndex, setActiveVariantIndex] = useState(
    initialActiveVariantIndex,
  );
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(
    null,
  );
  const [lastAdjustedVariantIndex, setLastAdjustedVariantIndex] = useState<
    number | null
  >(null);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [aiVariantRequest, setAiVariantRequest] =
    useState<AiVariantRequestDraft>(defaultAiVariantRequest);
  const [aiVariantSuggestion, setAiVariantSuggestion] =
    useState<AiVariantSuggestion | null>(null);
  const [aiVariantNotice, setAiVariantNotice] = useState<{
    tone: "success" | "critical";
    message: string;
  } | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("copy");
  const variantGridRef = useRef<HTMLDivElement | null>(null);
  const pendingVariantScrollIndexRef = useRef<number | null>(null);
  const [name, setName] = useState(
    experiment?.name || `${baseViewModel.name} experiment`,
  );
  const [primaryMetric, setPrimaryMetric] = useState(
    experiment?.primaryMetric || "CLICK_RATE",
  );

  const activeVariant =
    activeVariantIndex >= 0 ? (variants[activeVariantIndex] ?? null) : null;
  const pendingDeleteVariant =
    pendingDeleteIndex === null ? null : (variants[pendingDeleteIndex] ?? null);
  const positiveVariantCount = variants.filter(
    (variant) => variant.status !== "ARCHIVED" && variant.weight > 0,
  ).length;
  const canSubmitExperiment = experiment
    ? variants.length > 0
    : variants.length >= 2 && positiveVariantCount >= 2;

  // Track whether the experiment has unsaved edits so the save button only
  // activates when something actually changed. The baseline is derived from the
  // same initial values (and recomputes if the underlying campaign changes), so
  // the control auto-sync does not register as a manual change.
  const initialName = experiment?.name || `${baseViewModel.name} experiment`;
  const initialPrimaryMetric = experiment?.primaryMetric || "CLICK_RATE";
  const currentExperimentSignature = useMemo(
    () => JSON.stringify({ name, primaryMetric, variants, archivedVariants }),
    [name, primaryMetric, variants, archivedVariants],
  );
  const baselineExperimentSignature = useMemo(
    () =>
      JSON.stringify({
        name: initialName,
        primaryMetric: initialPrimaryMetric,
        variants: initialVariants,
        archivedVariants: initialArchivedVariants,
      }),
    [
      initialName,
      initialPrimaryMetric,
      initialVariants,
      initialArchivedVariants,
    ],
  );
  const hasExperimentChanges =
    currentExperimentSignature !== baselineExperimentSignature;

  useEffect(() => {
    const data = aiVariantFetcher.data;

    if (!data) return;

    const syncAiVariant = window.setTimeout(() => {
      if (data.aiVariant?.variant) {
        setAiVariantSuggestion(data.aiVariant.variant);
        setAiVariantNotice({
          tone: "success",
          message:
            data.aiVariant.source === "mock"
              ? "Local AI draft generated for review."
              : "AI variant generated for review.",
        });
      } else if (data.aiVariantError) {
        setAiVariantNotice({
          tone: "critical",
          message: data.aiVariantError,
        });
      }
    }, 0);

    return () => window.clearTimeout(syncAiVariant);
  }, [aiVariantFetcher.data]);

  useEffect(() => {
    const variantIndex = pendingVariantScrollIndexRef.current;

    if (variantIndex === null) return;

    const scrollTimeout = window.setTimeout(() => {
      const variantCard = variantGridRef.current?.querySelector<HTMLElement>(
        `[data-variant-index="${variantIndex}"]`,
      );

      variantCard?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      pendingVariantScrollIndexRef.current = null;
    }, 220);

    return () => window.clearTimeout(scrollTimeout);
  }, [variants.length]);

  const updateVariant = (
    index: number,
    updater: (variant: VariantDraft) => VariantDraft,
  ) => {
    setVariants((currentVariants) =>
      currentVariants.map((variant, variantIndex) =>
        variantIndex === index ? updater(variant) : variant,
      ),
    );
  };

  const updateVariantWeight = (index: number, weight: number) => {
    setVariants((currentVariants) =>
      redistributeVariantWeight(
        currentVariants,
        index,
        weight,
        lastAdjustedVariantIndex,
      ),
    );
    setLastAdjustedVariantIndex(index);
  };

  const addVariant = () => {
    setLastAdjustedVariantIndex(null);
    setVariants((currentVariants) => {
      const nextVariant = createVariantDraft(
        currentVariants.length,
        baseDesign,
        baseViewModel,
      );
      const nextVariants = rebalanceVariantWeightsEvenly([
        ...currentVariants,
        nextVariant,
      ]);
      setActiveVariantIndex(nextVariants.length - 1);
      setDrawerTab("copy");

      return nextVariants;
    });
  };

  const openAiDrawer = () => {
    setAiVariantSuggestion(null);
    setAiVariantNotice(null);
    setIsAiDrawerOpen(true);
  };

  const requestAiVariant = () => {
    setAiVariantSuggestion(null);
    setAiVariantNotice(null);
    aiVariantFetcher.submit(
      buildAiVariantFormData({
        baseDesign,
        baseViewModel,
        request: aiVariantRequest,
        variants,
      }),
      { method: "post" },
    );
  };

  const acceptAiVariant = () => {
    if (!aiVariantSuggestion) return;

    setVariants((currentVariants) => {
      const nextVariant = createVariantDraft(
        currentVariants.length,
        baseDesign,
        baseViewModel,
      );
      const acceptedVariant = applyAiVariantSuggestion(
        nextVariant,
        aiVariantSuggestion,
      );
      const nextVariants = rebalanceVariantWeightsEvenly([
        ...currentVariants,
        acceptedVariant,
      ]);

      pendingVariantScrollIndexRef.current = nextVariants.length - 1;
      setActiveVariantIndex(nextVariants.length - 1);
      setDrawerTab("copy");

      return nextVariants;
    });
    setAiVariantSuggestion(null);
    setAiVariantNotice(null);
    setIsAiDrawerOpen(false);
  };

  const requestDeleteVariant = (index: number) => {
    if (isControlVariantIndex(index)) return;

    setPendingDeleteIndex(index);
  };

  const confirmDeleteVariant = () => {
    if (pendingDeleteIndex === null) return;

    const variantToDelete = variants[pendingDeleteIndex];

    if (!variantToDelete || isControlVariantIndex(pendingDeleteIndex)) {
      setPendingDeleteIndex(null);
      return;
    }

    if (variantToDelete.id) {
      setArchivedVariants((currentArchivedVariants) => [
        ...currentArchivedVariants.filter(
          (variant) => variant.id !== variantToDelete.id,
        ),
        toArchivedVariant(variantToDelete),
      ]);
    }

    setVariants((currentVariants) =>
      normalizeVariantWeights(
        currentVariants.filter((_, index) => index !== pendingDeleteIndex),
      ),
    );
    setLastAdjustedVariantIndex(null);
    setActiveVariantIndex(-1);
    setPendingDeleteIndex(null);
  };

  return (
    <Form method="post" className="counterpulse-experiment-form">
      <input
        name="_action"
        type="hidden"
        value={experiment ? "updateExperiment" : "createExperiment"}
      />
      {experiment && (
        <input name="experimentId" type="hidden" value={experiment.id} />
      )}
      <VariantHiddenInputs
        archivedVariants={archivedVariants}
        baseDesign={baseDesign}
        baseViewModel={baseViewModel}
        variants={variants}
      />

      <header className="counterpulse-experiment-header">
        <div>
          <p className="counterpulse-kicker">
            {experiment ? "Saved experiment" : "New experiment"}
          </p>
          <div className="counterpulse-experiment-title-row">
            <h3>{experiment?.name || "Create experiment"}</h3>
            {experiment && <ExperimentStatusBadge status={experiment.status} />}
          </div>
        </div>
        <div className="counterpulse-experiment-header__aside">
          <div className="counterpulse-experiment-metrics">
            <MetricPill
              label="Primary metric"
              value={formatMetric(primaryMetric)}
            />
            {experiment && (
              <>
                <MetricPill
                  label="Minimum sample"
                  value={`${experiment.autoWinnerMinSampleSize} per variant`}
                />
                <MetricPill
                  label="Confidence"
                  value={`${Math.round(
                    experiment.autoWinnerConfidenceThreshold * 100,
                  )}%`}
                />
              </>
            )}
          </div>
          {onClose && (
            <button
              className="counterpulse-button-secondary"
              type="button"
              onClick={onClose}
            >
              Close editor
            </button>
          )}
        </div>
      </header>

      <div className="counterpulse-experiment-settings">
        <FormField label="Experiment name">
          <input
            name="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField
          label="Primary metric"
          info={
            <FieldInfoButton
              label="Primary metric"
              title="Experiment primary metric"
            >
              <ExperimentInfoContent
                intro="The primary metric is the one Promo Pulse uses when comparing variants and detecting a winner."
                items={[
                  [
                    "CTR",
                    "Best when you are testing headline, CTA, design, or placement engagement.",
                  ],
                  [
                    "Add-to-cart rate",
                    "Best when the campaign should move shoppers from viewing to cart intent.",
                  ],
                  [
                    "Checkout rate",
                    "Best for cart or checkout-focused urgency messaging.",
                  ],
                  [
                    "Revenue per visitor",
                    "Best when downstream revenue matters more than clicks.",
                  ],
                ]}
              />
            </FieldInfoButton>
          }
        >
          <select
            name="primaryMetric"
            value={primaryMetric}
            onChange={(event) => setPrimaryMetric(event.target.value)}
          >
            {metricOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="counterpulse-experiment-board-header">
        <div>
          <h3>Variants</h3>
          <p>
            Compare variants side by side. Traffic split always totals 100% and
            is adjusted from the slider.
          </p>
        </div>
        <div className="counterpulse-experiment-board-header__actions">
          <button
            className="counterpulse-ai-action-button counterpulse-ai-variant-button"
            type="button"
            onClick={openAiDrawer}
          >
            <AiGenerateIcon />
            <span>Generate with AI</span>
          </button>
          <button
            className="counterpulse-button-secondary"
            type="button"
            onClick={addVariant}
          >
            Add variant
          </button>
        </div>
      </div>

      <div className="counterpulse-experiment-board">
        <div className="counterpulse-variant-grid" ref={variantGridRef}>
          {variants.map((variant, index) => (
            <VariantCard
              baseDesign={baseDesign}
              baseViewModel={baseViewModel}
              isActive={activeVariantIndex === index}
              isControl={isControlVariantIndex(index)}
              index={index}
              key={`${variant.id || "new"}-${index}`}
              variant={variant}
              onEdit={() => {
                if (isControlVariantIndex(index)) return;

                setActiveVariantIndex(index);
                setDrawerTab("copy");
              }}
              onRequestDelete={() => requestDeleteVariant(index)}
              onResume={() =>
                updateVariant(index, (current) => ({
                  ...current,
                  status: "ACTIVE",
                }))
              }
              onWeightChange={(weight) => updateVariantWeight(index, weight)}
            />
          ))}
        </div>

        {archivedVariants.length > 0 && (
          <div className="counterpulse-archived-variants">
            <span className="counterpulse-archived-variants__label">
              Archived
            </span>
            <ul className="counterpulse-archived-variants__list">
              {archivedVariants.map((variant, index) => (
                <li
                  className="counterpulse-archived-variant-chip"
                  key={`${variant.id || "archived"}-${index}`}
                  title={`${variant.name || `Variant ${index + 1}`} (archived)`}
                >
                  <ArchivedVariantIcon />
                  <span className="counterpulse-archived-variant-chip__name">
                    {variant.name || `Variant ${index + 1}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {activeVariant && !isControlVariantIndex(activeVariantIndex) && (
        <VariantDrawer
          baseViewModel={baseViewModel}
          designMediaOptions={designMediaOptions}
          drawerTab={drawerTab}
          index={activeVariantIndex}
          isProPlan={isProPlan}
          variant={activeVariant}
          onChange={(nextVariant) =>
            updateVariant(activeVariantIndex, () => nextVariant)
          }
          onClose={() => setActiveVariantIndex(-1)}
          onDrawerTabChange={setDrawerTab}
          onWeightChange={(weight) =>
            updateVariantWeight(activeVariantIndex, weight)
          }
        />
      )}

      {isAiDrawerOpen && (
        <AiVariantDrawer
          baseDesign={baseDesign}
          baseViewModel={baseViewModel}
          isGenerating={isAiVariantGenerating}
          notice={aiVariantNotice}
          request={aiVariantRequest}
          suggestion={aiVariantSuggestion}
          onAccept={acceptAiVariant}
          onChangeRequest={setAiVariantRequest}
          onClose={() => setIsAiDrawerOpen(false)}
          onGenerate={requestAiVariant}
        />
      )}

      {pendingDeleteVariant && (
        <DeleteVariantModal
          variantName={pendingDeleteVariant.name}
          onCancel={() => setPendingDeleteIndex(null)}
          onConfirm={confirmDeleteVariant}
        />
      )}

      <div className="counterpulse-actions">
        <button
          className="counterpulse-button"
          disabled={
            isSubmitting ||
            !canSubmitExperiment ||
            (Boolean(experiment) && !hasExperimentChanges)
          }
          title={
            !canSubmitExperiment
              ? "Add at least one editable variant before creating the experiment."
              : experiment && !hasExperimentChanges
                ? "Make a change to save the experiment."
                : undefined
          }
          type="submit"
        >
          {isSubmitting
            ? experiment
              ? "Saving..."
              : "Creating..."
            : experiment
              ? "Save experiment"
              : "Create experiment"}
        </button>
      </div>
    </Form>
  );
}

function ArchivedVariantIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height="14"
      viewBox="0 0 24 24"
      width="14"
    >
      <path
        d="M4 7h16M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M4 7l1.5-3h13L20 7M10 11h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function VariantCard({
  baseDesign,
  baseViewModel,
  index,
  isActive,
  isControl,
  variant,
  onEdit,
  onRequestDelete,
  onResume,
  onWeightChange,
}: {
  baseDesign: CampaignDesignValues;
  baseViewModel: CampaignViewModel;
  index: number;
  isActive: boolean;
  isControl: boolean;
  variant: VariantDraft;
  onEdit: () => void;
  onRequestDelete: () => void;
  onResume: () => void;
  onWeightChange: (weight: number) => void;
}) {
  const preview = buildVariantPreviewModel(baseViewModel, variant);
  const changes = describeVariantChanges(
    variant,
    baseDesign,
    baseViewModel,
    isControl,
  );
  // The control variant has no status of its own — it is simply the live
  // campaign without overrides, so it is always "active" and must never show a
  // Draft/Paused chip or a resume prompt.
  const isDraft = !isControl && variant.status === "DRAFT";
  const isPaused = !isControl && variant.status === "PAUSED";
  const needsResume = isDraft || isPaused;

  return (
    <article
      className={
        isActive
          ? "counterpulse-variant-card is-active"
          : "counterpulse-variant-card"
      }
      data-variant-index={index}
    >
      <header>
        <div>
          <span
            className={`counterpulse-variant-dot counterpulse-variant-dot--${index % 6}`}
            aria-hidden="true"
          />
          <h4 title={variant.name || `Variant ${index + 1}`}>
            {variant.name || `Variant ${index + 1}`}
          </h4>
          {index === 0 && <span>Baseline</span>}
          {isDraft && (
            <span className="counterpulse-variant-status-tag counterpulse-variant-status-tag--draft">
              Draft
            </span>
          )}
          {isPaused && (
            <span className="counterpulse-variant-status-tag counterpulse-variant-status-tag--paused">
              Paused
            </span>
          )}
        </div>
        {!isControl && (
          <button
            aria-label={`Delete ${variant.name || `Variant ${index + 1}`}`}
            className="counterpulse-variant-delete-button"
            type="button"
            onClick={onRequestDelete}
          >
            Delete
          </button>
        )}
      </header>

      <div className="counterpulse-traffic-split">
        <label>
          <span>Traffic split</span>
          <strong>{variant.weight}%</strong>
          <input
            aria-label={`Variant ${index + 1} traffic split slider`}
            max={100}
            min={0}
            type="range"
            value={variant.weight}
            onChange={(event) => onWeightChange(Number(event.target.value))}
          />
        </label>
        <div>
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="counterpulse-variant-changes">
        <VariantChangesList
          changes={changes}
          isControl={isControl}
          title={index === 0 ? "What is shown" : "Changes vs. control"}
        />
      </div>

      <VariantMiniPreview design={variant.design} viewModel={preview} />

      {needsResume && (
        <div className="counterpulse-variant-draft-notice" role="status">
          <span>
            {isDraft
              ? "This variant is a draft and isn't receiving traffic yet."
              : "This variant is paused and isn't receiving traffic."}
          </span>
          <button
            className="counterpulse-button"
            type="button"
            onClick={onResume}
          >
            Resume variant
          </button>
        </div>
      )}

      {!isControl && (
        <button
          className="counterpulse-button-secondary"
          type="button"
          onClick={onEdit}
        >
          Edit variant
        </button>
      )}
    </article>
  );
}

function VariantDrawer({
  baseViewModel,
  designMediaOptions,
  drawerTab,
  index,
  isProPlan,
  variant,
  onChange,
  onClose,
  onDrawerTabChange,
  onWeightChange,
}: {
  baseViewModel: CampaignViewModel;
  designMediaOptions: CampaignDesignMediaOptions;
  drawerTab: DrawerTab;
  index: number;
  isProPlan: boolean;
  variant: VariantDraft;
  onChange: (variant: VariantDraft) => void;
  onClose: () => void;
  onDrawerTabChange: (tab: DrawerTab) => void;
  onWeightChange: (weight: number) => void;
}) {
  const [designDevice, setDesignDevice] = useState<PreviewDevice>("desktop");
  const isMobileSurface =
    designDevice === "mobile" && variant.design.separateMobileDesign;
  const activeVariantDesign = isMobileSurface
    ? variant.mobileDesign
    : variant.design;
  const basePreview = buildVariantPreviewModel(baseViewModel, variant);
  const preview = { ...basePreview, design: activeVariantDesign };
  const [isClosing, setIsClosing] = useState(false);
  const requestClose = () => setIsClosing(true);

  useEffect(() => {
    if (!isClosing) return;

    const timeout = window.setTimeout(onClose, 180);

    return () => window.clearTimeout(timeout);
  }, [isClosing, onClose]);

  return (
    <div
      className={
        isClosing
          ? "counterpulse-variant-drawer-shell is-closing"
          : "counterpulse-variant-drawer-shell"
      }
    >
      <button
        aria-label="Close variant editor"
        className="counterpulse-variant-drawer-backdrop"
        type="button"
        onClick={requestClose}
      />
      <div className="counterpulse-variant-drawer-cluster">
        <section
          aria-label="Variant preview"
          className="counterpulse-variant-drawer-preview-wing"
          data-testid="variant-drawer-preview"
        >
          <div>
            <strong>Preview</strong>
            <span>
              {variant.placement.placementType
                ? formatCampaignOption(variant.placement.placementType)
                : formatBasePlacement(baseViewModel)}
            </span>
          </div>
          <VariantMiniPreview design={activeVariantDesign} viewModel={preview} />
        </section>
        <aside
          className="counterpulse-variant-drawer"
          aria-label="Edit variant"
        >
          <header className="counterpulse-variant-drawer__header">
            <div>
              <p className="counterpulse-kicker">Variant {index + 1}</p>
              <h3>Edit {variant.name || `Variant ${index + 1}`}</h3>
            </div>
            <button
              aria-label="Close variant editor"
              className="counterpulse-icon-button"
              type="button"
              onClick={requestClose}
            >
              x
            </button>
          </header>

          <div className="counterpulse-subtabs" role="tablist">
            {(["copy", "placement", "design", "settings"] as DrawerTab[]).map(
              (tab) => (
                <button
                  aria-selected={drawerTab === tab}
                  className={drawerTab === tab ? "is-active" : ""}
                  key={tab}
                  role="tab"
                  type="button"
                  onClick={() => onDrawerTabChange(tab)}
                >
                  <span>{formatDrawerTab(tab)}</span>
                </button>
              ),
            )}
          </div>

          {drawerTab === "copy" && (
            <div className="counterpulse-variant-drawer__body">
              {textFields.map((field) => (
                <VariantDrawerField
                  description={field.description}
                  key={field.key}
                  label={field.label}
                >
                  <input
                    maxLength={field.maxLength}
                    value={variant.text[field.key]}
                    onChange={(event) =>
                      onChange({
                        ...variant,
                        text: {
                          ...variant.text,
                          [field.key]: event.target.value,
                        },
                      })
                    }
                  />
                </VariantDrawerField>
              ))}
            </div>
          )}

          {drawerTab === "placement" && (
            <div className="counterpulse-variant-drawer__body">
              <div className="counterpulse-variant-drawer-field">
                <span>
                  <strong>Placement</strong>
                  <small>
                    Choose one storefront surface for this variant, or inherit
                    the campaign placement.
                  </small>
                </span>
                <div
                  className="counterpulse-placement-grid counterpulse-variant-placement-grid"
                  role="group"
                  aria-label="Variant placement"
                >
                  <button
                    aria-pressed={!variant.placement.placementType}
                    className={
                      !variant.placement.placementType
                        ? "counterpulse-placement-tile is-selected"
                        : "counterpulse-placement-tile"
                    }
                    type="button"
                    onClick={() =>
                      onChange({
                        ...variant,
                        placement: {
                          ...variant.placement,
                          placementType: "",
                        },
                      })
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="counterpulse-placement-tile__initial"
                    >
                      BP
                    </span>
                    <span className="counterpulse-placement-tile__body">
                      <strong>Base campaign</strong>
                      <small>{formatBasePlacement(baseViewModel)}</small>
                    </span>
                  </button>
                  {placementTypeOptions.map((option) => {
                    const isSelected =
                      variant.placement.placementType === option.value;

                    return (
                      <button
                        aria-pressed={isSelected}
                        className={
                          isSelected
                            ? "counterpulse-placement-tile is-selected"
                            : "counterpulse-placement-tile"
                        }
                        key={option.value}
                        type="button"
                        onClick={() =>
                          onChange({
                            ...variant,
                            placement: {
                              ...variant.placement,
                              placementType: option.value,
                              customSelector:
                                option.value === "CUSTOM_SELECTOR"
                                  ? variant.placement.customSelector
                                  : "",
                            },
                          })
                        }
                      >
                        <span
                          aria-hidden="true"
                          className="counterpulse-placement-tile__initial"
                        >
                          {placementInitial(option.label)}
                        </span>
                        <span className="counterpulse-placement-tile__body">
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <input
                  name={`variant-${index}-placementType`}
                  type="hidden"
                  value={variant.placement.placementType}
                />
              </div>

              {variant.placement.placementType === "CUSTOM_SELECTOR" && (
                <VariantDrawerField
                  description="CSS selector used by the custom HTML slot."
                  label="Custom selector"
                >
                  <input
                    placeholder="#promo-slot"
                    value={variant.placement.customSelector}
                    onChange={(event) =>
                      onChange({
                        ...variant,
                        placement: {
                          ...variant.placement,
                          customSelector: event.target.value,
                        },
                      })
                    }
                  />
                </VariantDrawerField>
              )}
            </div>
          )}

          {drawerTab === "design" && (
            <div className="counterpulse-variant-drawer__design">
              <div className="counterpulse-variant-responsive-bar">
                <div className="counterpulse-variant-responsive-bar__device">
                  <DevicePreviewToggle
                    value={designDevice}
                    onChange={setDesignDevice}
                  />
                </div>
                <label className="counterpulse-variant-responsive-switch">
                  <input
                    type="checkbox"
                    checked={variant.design.separateMobileDesign}
                    aria-label="Separate desktop and mobile design"
                    onChange={(event) => {
                      const separate = event.target.checked;
                      onChange({
                        ...variant,
                        design: {
                          ...variant.design,
                          separateMobileDesign: separate,
                        },
                        mobileDesign: {
                          ...(separate
                            ? variant.mobileDesign
                            : deriveMobileDesignFromDesktop(variant.design)),
                          separateMobileDesign: separate,
                        },
                      });
                      if (!separate) setDesignDevice("desktop");
                    }}
                  />
                  <span>
                    <strong>Separate desktop and mobile</strong>
                    <small>
                      {variant.design.separateMobileDesign
                        ? "Editing each device independently."
                        : "Mobile mirrors the desktop variant with slightly smaller text."}
                    </small>
                  </span>
                </label>
              </div>
              {isMobileSurface && (
                <p className="counterpulse-variant-scope-note">
                  You are editing the mobile version of this variant. Mobile
                  layouts are available here.
                </p>
              )}
              <DesignControls
                errors={{}}
                hasTimer={Boolean(
                  baseViewModel.timer || baseViewModel.deliveryCutoff,
                )}
                isProPlan={isProPlan}
                mediaOptions={designMediaOptions}
                device={isMobileSurface ? "mobile" : "desktop"}
                values={activeVariantDesign}
                onChange={(design) =>
                  onChange(
                    isMobileSurface
                      ? { ...variant, mobileDesign: design }
                      : {
                          ...variant,
                          design,
                          // Keep the separate flag mirrored on both designs.
                          mobileDesign: {
                            ...variant.mobileDesign,
                            separateMobileDesign: design.separateMobileDesign,
                          },
                        },
                  )
                }
              />
            </div>
          )}

          {drawerTab === "settings" && (
            <div className="counterpulse-variant-drawer__body">
              <VariantDrawerField
                description="Internal label used in reports and result tables."
                label="Variant name"
              >
                <input
                  value={variant.name}
                  onChange={(event) =>
                    onChange({ ...variant, name: event.target.value })
                  }
                />
              </VariantDrawerField>
              <VariantDrawerField
                description="Traffic allocation for this variant. Moving the slider rebalances the other variants automatically."
                label="Traffic split"
              >
                <div className="counterpulse-variant-weight-editor">
                  <input
                    aria-label={`Variant ${index + 1} traffic split`}
                    max={100}
                    min={0}
                    type="range"
                    value={variant.weight}
                    onChange={(event) =>
                      onWeightChange(Number(event.target.value))
                    }
                  />
                  <strong>{variant.weight}%</strong>
                </div>
              </VariantDrawerField>
              <VariantDrawerField
                description="Controls whether the variant can receive traffic when the experiment is running."
                label="Status"
              >
                <select
                  value={variant.status}
                  onChange={(event) =>
                    onChange({ ...variant, status: event.target.value })
                  }
                >
                  {variantStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatEnum(status)}
                    </option>
                  ))}
                </select>
              </VariantDrawerField>
              <div className="counterpulse-variant-scope-note">
                Offers, discount setup, targeting, markets, and schedule are
                always inherited from the base campaign for every variant.
              </div>
            </div>
          )}

          <footer className="counterpulse-variant-drawer__footer">
            <button
              className="counterpulse-button"
              type="button"
              onClick={requestClose}
            >
              Done
            </button>
          </footer>
        </aside>
      </div>
    </div>
  );
}

function AiVariantDrawer({
  baseDesign,
  baseViewModel,
  isGenerating,
  notice,
  request,
  suggestion,
  onAccept,
  onChangeRequest,
  onClose,
  onGenerate,
}: {
  baseDesign: CampaignDesignValues;
  baseViewModel: CampaignViewModel;
  isGenerating: boolean;
  notice: { tone: "success" | "critical"; message: string } | null;
  request: AiVariantRequestDraft;
  suggestion: AiVariantSuggestion | null;
  onAccept: () => void;
  onChangeRequest: (request: AiVariantRequestDraft) => void;
  onClose: () => void;
  onGenerate: () => void;
}) {
  const [isClosing, setIsClosing] = useState(false);
  const suggestionRef = useRef<HTMLElement | null>(null);
  const requestClose = () => setIsClosing(true);
  const previewVariant = useMemo(() => {
    if (!suggestion) return null;

    return applyAiVariantSuggestion(
      createVariantDraft(1, baseDesign, baseViewModel),
      suggestion,
    );
  }, [baseDesign, baseViewModel, suggestion]);
  const previewViewModel = previewVariant
    ? buildVariantPreviewModel(baseViewModel, previewVariant)
    : null;
  const previewChanges = previewVariant
    ? describeVariantChanges(previewVariant, baseDesign, baseViewModel, false)
    : [];

  useEffect(() => {
    if (!isClosing) return;

    const timeout = window.setTimeout(onClose, 180);

    return () => window.clearTimeout(timeout);
  }, [isClosing, onClose]);

  useEffect(() => {
    if (!suggestion) return;

    const scrollTimeout = window.setTimeout(() => {
      suggestionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }, 40);

    return () => window.clearTimeout(scrollTimeout);
  }, [suggestion]);

  return (
    <div
      className={
        isClosing
          ? "counterpulse-variant-drawer-shell counterpulse-ai-variant-drawer-shell is-closing"
          : "counterpulse-variant-drawer-shell counterpulse-ai-variant-drawer-shell"
      }
    >
      <button
        aria-label="Close AI variant generator"
        className="counterpulse-variant-drawer-backdrop"
        type="button"
        onClick={requestClose}
      />
      <aside
        aria-label="Generate AI variant"
        className="counterpulse-ai-variant-drawer"
      >
        <header className="counterpulse-variant-drawer__header">
          <div>
            <p className="counterpulse-kicker">AI variant generator</p>
            <h3>Generate experiment variant</h3>
          </div>
          <button
            aria-label="Close AI variant generator"
            className="counterpulse-icon-button"
            type="button"
            onClick={requestClose}
          >
            x
          </button>
        </header>

        <div className="counterpulse-ai-variant-drawer__body">
          <section className="counterpulse-ai-variant-section">
            <div>
              <h4>Testing direction</h4>
              <p>
                Choose the hypothesis you want to explore. AI will keep the same
                offer, targeting, market, and schedule.
              </p>
            </div>
            <div className="counterpulse-ai-variant-option-grid">
              {aiVariantStrategyOptions.map((option) => (
                <button
                  aria-pressed={request.strategy === option.value}
                  className="counterpulse-ai-variant-option"
                  key={option.value}
                  type="button"
                  onClick={() =>
                    onChangeRequest({
                      ...request,
                      strategy: option.value,
                    })
                  }
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="counterpulse-ai-variant-section">
            <div>
              <h4>Creative scope</h4>
              <p>
                Control how far AI can move the variant away from the control.
              </p>
            </div>
            <div className="counterpulse-ai-variant-choice-row">
              {aiVariantDesignIntensityOptions.map((option) => (
                <button
                  aria-pressed={request.designIntensity === option.value}
                  className="counterpulse-ai-variant-chip"
                  key={option.value}
                  type="button"
                  onClick={() =>
                    onChangeRequest({
                      ...request,
                      designIntensity: option.value,
                    })
                  }
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="counterpulse-ai-variant-section">
            <div>
              <h4>Placement intent</h4>
              <p>
                Prefer the base placement for cleaner experiments, or test a
                shopper moment when placement itself is part of the hypothesis.
              </p>
            </div>
            <div className="counterpulse-ai-variant-choice-row">
              {aiVariantPlacementIntentOptions.map((option) => (
                <button
                  aria-pressed={request.placementIntent === option.value}
                  className="counterpulse-ai-variant-chip"
                  key={option.value}
                  type="button"
                  onClick={() =>
                    onChangeRequest({
                      ...request,
                      placementIntent: option.value,
                    })
                  }
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="counterpulse-ai-variant-section">
            <VariantDrawerField
              description="Optional context for AI: audience, product angle, objections, brand tone, or what you want to avoid."
              label="Guidance"
            >
              <textarea
                maxLength={800}
                placeholder="Example: make the message feel more premium without adding false urgency."
                value={request.notes}
                onChange={(event) =>
                  onChangeRequest({
                    ...request,
                    notes: event.target.value,
                  })
                }
              />
            </VariantDrawerField>
            {notice && (
              <div
                className={`counterpulse-ai-variant-notice counterpulse-ai-variant-notice--${notice.tone}`}
              >
                {notice.message}
              </div>
            )}
            <button
              className="counterpulse-ai-action-button counterpulse-ai-variant-generate-button"
              disabled={isGenerating}
              type="button"
              onClick={onGenerate}
            >
              <AiGenerateIcon />
              <span>{isGenerating ? "Generating..." : "Generate variant"}</span>
            </button>
          </section>

          {suggestion && previewVariant && previewViewModel && (
            <section
              className="counterpulse-ai-variant-suggestion"
              ref={suggestionRef}
            >
              <div>
                <p className="counterpulse-kicker">Suggested variant</p>
                <h4>{suggestion.name}</h4>
              </div>
              <div className="counterpulse-ai-variant-suggestion__grid">
                <div className="counterpulse-ai-variant-suggestion__preview">
                  <span>Preview</span>
                  <VariantMiniPreview
                    design={previewVariant.design}
                    viewModel={previewViewModel}
                  />
                </div>
                <div className="counterpulse-ai-variant-suggestion__copy">
                  <strong>Hypothesis</strong>
                  <p>{suggestion.hypothesis}</p>
                  <strong>Why this variant</strong>
                  <p>{suggestion.rationale}</p>
                  <VariantChangesList
                    changes={previewChanges}
                    title="What AI changed"
                  />
                </div>
              </div>
            </section>
          )}
        </div>

        <footer className="counterpulse-variant-drawer__footer counterpulse-ai-variant-drawer__footer">
          <button
            className="counterpulse-button-secondary"
            type="button"
            onClick={requestClose}
          >
            Cancel
          </button>
          <button
            className="counterpulse-button"
            disabled={!suggestion || isGenerating}
            type="button"
            onClick={onAccept}
          >
            Accept variant
          </button>
        </footer>
      </aside>
    </div>
  );
}

function DeleteVariantModal({
  variantName,
  onCancel,
  onConfirm,
}: {
  variantName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="counterpulse-modal-backdrop" role="presentation">
      <button
        aria-label="Cancel variant deletion"
        className="counterpulse-modal-backdrop__dismiss"
        type="button"
        onClick={onCancel}
      />
      <section
        aria-labelledby="counterpulse-delete-variant-title"
        aria-modal="true"
        className="counterpulse-modal"
        role="dialog"
      >
        <div className="counterpulse-modal__header">
          <span
            aria-hidden="true"
            className="counterpulse-modal__icon counterpulse-modal__icon--critical"
          >
            !
          </span>
          <div>
            <h2 id="counterpulse-delete-variant-title">Delete variant?</h2>
            <p className="counterpulse-modal__body">
              {variantName || "This variant"} will be removed from this
              experiment. Existing saved variants are archived so they stop
              receiving traffic.
            </p>
          </div>
        </div>
        <div className="counterpulse-modal__actions">
          <button
            className="counterpulse-button-secondary"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="counterpulse-button-danger"
            type="button"
            onClick={onConfirm}
          >
            Delete variant
          </button>
        </div>
      </section>
    </div>
  );
}

function VariantChangesList({
  changes,
  isControl = false,
  title,
}: {
  changes: string[];
  isControl?: boolean;
  title: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleLimit = isControl ? 4 : collapsedVariantChangeCount;
  const visibleChanges = changes.slice(0, visibleLimit);
  const hiddenChanges = isControl ? [] : changes.slice(visibleLimit);
  const hasHiddenChanges = hiddenChanges.length > 0;

  return (
    <>
      <strong>{title}</strong>
      <ul>
        {visibleChanges.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>
      {hasHiddenChanges && (
        <>
          <div
            className={[
              "counterpulse-variant-changes__extra",
              isExpanded ? "is-expanded" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div>
              <ul>
                {hiddenChanges.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </div>
          </div>
          <button
            aria-expanded={isExpanded}
            className="counterpulse-variant-changes__toggle"
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? "See less" : `See more (${hiddenChanges.length})`}
          </button>
        </>
      )}
    </>
  );
}

function VariantHiddenInputs({
  archivedVariants,
  baseDesign,
  baseViewModel,
  variants,
}: {
  archivedVariants: VariantDraft[];
  baseDesign: CampaignDesignValues;
  baseViewModel: CampaignViewModel;
  variants: VariantDraft[];
}) {
  const submittedVariants = [...variants, ...archivedVariants];

  return (
    <>
      {submittedVariants.map((variant, index) => {
        // The control variant (index 0) represents the campaign as configured:
        // it never sends overrides. Its weight is the derived remainder.
        const isControl = index === 0;

        return (
          <div hidden key={`${variant.id || "new"}-${index}`}>
            <input name="variantId" readOnly value={variant.id} />
            <input name="variantName" readOnly value={variant.name} />
            <input name="variantWeight" readOnly value={variant.weight} />
            <input name="variantStatus" readOnly value={variant.status} />
            <textarea
              name="textOverride"
              readOnly
              value={
                isControl
                  ? ""
                  : jsonOverrideValue(
                      buildTextOverride(variant.text, baseViewModel),
                    )
              }
            />
            <textarea
              name="designOverride"
              readOnly
              value={
                isControl
                  ? ""
                  : jsonOverrideValue(buildDesignOverride(variant, baseDesign))
              }
            />
            <textarea
              name="placementOverride"
              readOnly
              value={
                isControl
                  ? ""
                  : jsonOverrideValue(buildPlacementOverride(variant.placement))
              }
            />
          </div>
        );
      })}
    </>
  );
}

function ExperimentResultsTable({
  canEdit = false,
  experiment,
  onEditVariant,
}: {
  canEdit?: boolean;
  experiment: ExperimentRow;
  onEditVariant?: (variantId: string) => void;
}) {
  const isCompleted = experiment.status === "COMPLETED";
  const [openMenuVariantId, setOpenMenuVariantId] = useState("");
  const [pendingArchiveVariant, setPendingArchiveVariant] =
    useState<ExperimentVariantResultRow | null>(null);
  const recommendedCandidateVariantId = getRecommendedVariantId(experiment);
  const recommendedVariantId = isRecommendedSampleReady(
    experiment,
    recommendedCandidateVariantId,
  )
    ? recommendedCandidateVariantId
    : "";
  const visibleExperimentVariants = experiment.variants.filter(
    (variant) => variant.status !== "ARCHIVED",
  );
  const visibleVariantIds = new Set(
    visibleExperimentVariants.map((variant) => variant.id),
  );
  const controlVariantId = visibleExperimentVariants[0]?.id ?? "";
  const sortedVariants = [...experiment.results.variants].sort(
    (left, right) => {
      const leftIsRecommended = left.variantId === recommendedVariantId ? 1 : 0;
      const rightIsRecommended =
        right.variantId === recommendedVariantId ? 1 : 0;

      if (leftIsRecommended !== rightIsRecommended) {
        return rightIsRecommended - leftIsRecommended;
      }

      return (
        right.primaryMetricValue - left.primaryMetricValue ||
        right.conversionRate - left.conversionRate ||
        right.ctr - left.ctr ||
        right.orders - left.orders ||
        right.clicks - left.clicks ||
        right.impressions - left.impressions
      );
    },
  );

  const primaryMetricColumn = getPrimaryMetricColumn(experiment.primaryMetric);
  const columnClass = (column: string) =>
    column === primaryMetricColumn
      ? "counterpulse-experiment-results__cell--primary"
      : undefined;

  return (
    <section className="counterpulse-experiment-results">
      <div className="counterpulse-experiment-results__header">
        <h3>Experiment Results</h3>
        <span>
          Metrics refresh automatically. All values are up to the minute.
        </span>
      </div>
      <div className="counterpulse-experiment-results__table-wrap">
        <table className="counterpulse-table counterpulse-experiment-results__table">
          <thead>
            <tr>
              <th>Variant</th>
              <th>Traffic split</th>
              <th>Impressions</th>
              <th>Clicks</th>
              <ResultHeaderCell
                column="ctr"
                primaryMetricColumn={primaryMetricColumn}
              >
                CTR
              </ResultHeaderCell>
              <ResultHeaderCell
                column="addToCart"
                primaryMetricColumn={primaryMetricColumn}
              >
                Add-to-cart
              </ResultHeaderCell>
              <th>Orders</th>
              <th>Revenue</th>
              <ResultHeaderCell
                column="rpv"
                primaryMetricColumn={primaryMetricColumn}
              >
                RPV
              </ResultHeaderCell>
              <ResultHeaderCell
                column="conversion"
                primaryMetricColumn={primaryMetricColumn}
              >
                Conversion
              </ResultHeaderCell>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedVariants.map((variant, sortedIndex) => {
              const isWinner = variant.variantId === experiment.winnerVariantId;
              const isRecommended =
                !isCompleted && variant.variantId === recommendedVariantId;
              const canManageVariant =
                canEdit &&
                visibleVariantIds.has(variant.variantId) &&
                variant.variantId !== controlVariantId;
              const opensMenuAbove =
                sortedIndex >= Math.max(1, sortedVariants.length - 2);
              const originalIndex = experiment.results.variants.findIndex(
                (result) => result.variantId === variant.variantId,
              );

              return (
                <tr
                  className={
                    isRecommended
                      ? "counterpulse-experiment-results__row counterpulse-experiment-results__row--recommended"
                      : "counterpulse-experiment-results__row"
                  }
                  key={variant.variantId}
                >
                  <td
                    aria-label={`${variant.variantName}${isWinner ? " (winner)" : ""}`}
                  >
                    <div className="counterpulse-result-variant">
                      <span
                        aria-hidden="true"
                        className={`counterpulse-result-avatar counterpulse-result-avatar--${Math.max(originalIndex, 0) % 6}`}
                      >
                        {formatVariantLetter(Math.max(originalIndex, 0))}
                      </span>
                      <span className="counterpulse-result-variant__name">
                        {variant.variantName}
                      </span>
                      {isWinner ? (
                        <span className="counterpulse-result-winner">
                          Winner
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>{formatPercent(variant.trafficSplit / 100)}</td>
                  <td>{variant.impressions}</td>
                  <td>{variant.clicks}</td>
                  <td className={columnClass("ctr")}>
                    {formatPercent(variant.ctr)}
                  </td>
                  <td className={columnClass("addToCart")}>
                    {variant.addToCart}
                  </td>
                  <td>{variant.orders}</td>
                  <td>
                    {formatCurrency(
                      variant.revenue,
                      experiment.results.currencyCode,
                    )}
                  </td>
                  <td className={columnClass("rpv")}>
                    {formatCurrency(
                      variant.revenuePerVisitor,
                      experiment.results.currencyCode,
                    )}
                  </td>
                  <td className={columnClass("conversion")}>
                    {formatPercent(variant.conversionRate)}
                  </td>
                  <td>
                    <ExperimentResultActions
                      canManageVariant={canManageVariant}
                      experimentId={experiment.id}
                      isCompleted={isCompleted}
                      isMenuOpen={openMenuVariantId === variant.variantId}
                      isRecommended={isRecommended}
                      isWinner={isWinner}
                      opensMenuAbove={opensMenuAbove}
                      variant={variant}
                      onCloseMenu={() => setOpenMenuVariantId("")}
                      onDeleteVariant={() => {
                        setOpenMenuVariantId("");
                        setPendingArchiveVariant(variant);
                      }}
                      onEditVariant={() => {
                        setOpenMenuVariantId("");
                        onEditVariant?.(variant.variantId);
                      }}
                      onToggleMenu={() =>
                        setOpenMenuVariantId((currentVariantId) =>
                          currentVariantId === variant.variantId
                            ? ""
                            : variant.variantId,
                        )
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="counterpulse-experiment-results__footnote">
        Metrics refresh automatically. All values are up to the minute.
      </p>
      {pendingArchiveVariant ? (
        <ArchiveExperimentVariantModal
          experimentId={experiment.id}
          variant={pendingArchiveVariant}
          onCancel={() => setPendingArchiveVariant(null)}
        />
      ) : null}
    </section>
  );
}

function ExperimentResultActions({
  canManageVariant,
  experimentId,
  isCompleted,
  isMenuOpen,
  isRecommended,
  isWinner,
  opensMenuAbove,
  variant,
  onCloseMenu,
  onDeleteVariant,
  onEditVariant,
  onToggleMenu,
}: {
  canManageVariant: boolean;
  experimentId: string;
  isCompleted: boolean;
  isMenuOpen: boolean;
  isRecommended: boolean;
  isWinner: boolean;
  opensMenuAbove: boolean;
  variant: ExperimentVariantResultRow;
  onCloseMenu: () => void;
  onDeleteVariant: () => void;
  onEditVariant: () => void;
  onToggleMenu: () => void;
}) {
  return (
    <div className="counterpulse-result-actions">
      {isRecommended ? (
        <span className="counterpulse-result-recommended">
          <span aria-hidden="true">✧</span>
          Recommended
        </span>
      ) : null}
      {isCompleted ? (
        isWinner ? (
          <span className="counterpulse-result-winner">Winner</span>
        ) : (
          <span className="counterpulse-muted">Finished</span>
        )
      ) : isWinner ? (
        <span className="counterpulse-result-winner">Winner</span>
      ) : (
        <Form method="post">
          <input name="experimentId" type="hidden" value={experimentId} />
          <input name="variantId" type="hidden" value={variant.variantId} />
          <button
            className="counterpulse-button-secondary counterpulse-button-secondary--small"
            name="_action"
            type="submit"
            value="declareExperimentWinner"
          >
            Set winner
          </button>
        </Form>
      )}
      <div
        className="counterpulse-result-menu"
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;

          if (
            !(nextTarget instanceof Node) ||
            !event.currentTarget.contains(nextTarget)
          ) {
            onCloseMenu();
          }
        }}
      >
        <button
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label={`Open actions for ${variant.variantName}`}
          className="counterpulse-result-menu-button"
          type="button"
          onClick={onToggleMenu}
        >
          ⋮
        </button>
        {isMenuOpen ? (
          <div
            className={
              opensMenuAbove
                ? "counterpulse-result-menu__dropdown counterpulse-result-menu__dropdown--above"
                : "counterpulse-result-menu__dropdown"
            }
            role="menu"
          >
            <button
              disabled={!canManageVariant}
              role="menuitem"
              type="button"
              onClick={onEditVariant}
            >
              Edit variant
            </button>
            <button
              className="counterpulse-result-menu__delete"
              disabled={!canManageVariant}
              role="menuitem"
              type="button"
              onClick={onDeleteVariant}
            >
              Delete variant
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ArchiveExperimentVariantModal({
  experimentId,
  variant,
  onCancel,
}: {
  experimentId: string;
  variant: ExperimentVariantResultRow;
  onCancel: () => void;
}) {
  return (
    <div className="counterpulse-modal-backdrop" role="presentation">
      <button
        aria-label="Cancel variant deletion"
        className="counterpulse-modal-backdrop__dismiss"
        type="button"
        onClick={onCancel}
      />
      <section
        aria-labelledby="counterpulse-archive-result-variant-title"
        aria-modal="true"
        className="counterpulse-modal"
        role="dialog"
      >
        <div className="counterpulse-modal__header">
          <span
            aria-hidden="true"
            className="counterpulse-modal__icon counterpulse-modal__icon--critical"
          >
            !
          </span>
          <div>
            <h2 id="counterpulse-archive-result-variant-title">
              Delete variant?
            </h2>
            <p className="counterpulse-modal__body">
              {variant.variantName} will be removed from this experiment and
              stop receiving traffic. Historical results remain available.
            </p>
          </div>
        </div>
        <Form method="post" className="counterpulse-modal__actions">
          <input name="experimentId" type="hidden" value={experimentId} />
          <input name="variantId" type="hidden" value={variant.variantId} />
          <button
            className="counterpulse-button-secondary"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="counterpulse-button-danger"
            name="_action"
            type="submit"
            value="archiveExperimentVariant"
          >
            Delete variant
          </button>
        </Form>
      </section>
    </div>
  );
}

function ExperimentAutoWinnerForm({
  experiment,
}: {
  experiment: ExperimentRow;
}) {
  const fetcher = useFetcher();
  const persistedValues = useMemo(
    () => ({
      enabled: experiment.autoWinnerEnabled,
      minSampleSize: experiment.autoWinnerMinSampleSize,
      minRuntimeHours: experiment.autoWinnerMinRuntimeHours,
      confidenceThreshold: experiment.autoWinnerConfidenceThreshold,
    }),
    [
      experiment.autoWinnerConfidenceThreshold,
      experiment.autoWinnerEnabled,
      experiment.autoWinnerMinRuntimeHours,
      experiment.autoWinnerMinSampleSize,
    ],
  );
  const [values, setValues] = useState(persistedValues);
  const valuesRef = useRef(values);
  const persistedKey = useMemo(
    () => JSON.stringify(persistedValues),
    [persistedValues],
  );
  const draftKey = useMemo(() => JSON.stringify(values), [values]);
  const isDirty = draftKey !== persistedKey;
  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    const syncValues = window.setTimeout(() => {
      setValues(persistedValues);
    }, 0);

    return () => window.clearTimeout(syncValues);
  }, [persistedKey, persistedValues]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("promo-pulse:experiment-auto-winner-state", {
        detail: {
          dirty: isDirty,
          saving: isSaving,
        },
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("promo-pulse:experiment-auto-winner-state", {
          detail: {
            dirty: false,
            saving: false,
          },
        }),
      );
    };
  }, [isDirty, isSaving]);

  useEffect(() => {
    const saveAutoWinner = () => {
      if (!isDirty || isSaving) return;

      fetcher.submit(
        buildAutoWinnerFormData(experiment.id, valuesRef.current),
        { method: "post" },
      );
    };
    const discardAutoWinner = () => setValues(persistedValues);

    window.addEventListener(
      "promo-pulse:experiment-auto-winner-save",
      saveAutoWinner,
    );
    window.addEventListener(
      "promo-pulse:experiment-auto-winner-discard",
      discardAutoWinner,
    );

    return () => {
      window.removeEventListener(
        "promo-pulse:experiment-auto-winner-save",
        saveAutoWinner,
      );
      window.removeEventListener(
        "promo-pulse:experiment-auto-winner-discard",
        discardAutoWinner,
      );
    };
  }, [experiment.id, fetcher, isDirty, isSaving, persistedValues]);

  return (
    <fetcher.Form
      method="post"
      className="counterpulse-experiment-auto-winner"
      onSubmit={(event) => event.preventDefault()}
    >
      <input name="_action" type="hidden" value="saveExperimentAutoWinner" />
      <input name="experimentId" type="hidden" value={experiment.id} />
      <div className="counterpulse-experiment-auto-winner__header">
        <div>
          <h3>Auto-winner settings</h3>
          <p>
            Configure when the system should automatically declare a winner.
          </p>
        </div>
      </div>
      <div className="counterpulse-experiment-auto-winner__grid">
        <div className="counterpulse-toggle counterpulse-experiment-auto-winner__toggle">
          <label className="counterpulse-toggle-label">
            <input
              checked={values.enabled}
              name="autoWinnerEnabled"
              type="checkbox"
              onChange={(event) =>
                setValues((currentValues) => ({
                  ...currentValues,
                  enabled: event.target.checked,
                }))
              }
            />
            <span>Enable auto-winner</span>
          </label>
          <FieldInfoButton label="Enable auto-winner" title="Auto-winner">
            <ExperimentInfoContent
              intro="Auto-winner can detect a likely winning variant using conservative thresholds."
              items={[
                [
                  "Sample and runtime",
                  "Minimum sample size and runtime prevent early, noisy winners.",
                ],
                [
                  "Confidence",
                  "The threshold is a conservative guard for winner detection.",
                ],
              ]}
            />
          </FieldInfoButton>
        </div>
        <FormField label="Minimum sample size">
          <input
            min="1"
            name="autoWinnerMinSampleSize"
            step="1"
            type="number"
            value={values.minSampleSize}
            onChange={(event) =>
              setValues((currentValues) => ({
                ...currentValues,
                minSampleSize: Number(event.target.value),
              }))
            }
          />
        </FormField>
        <FormField label="Minimum runtime hours">
          <input
            min="0"
            name="autoWinnerMinRuntimeHours"
            step="1"
            type="number"
            value={values.minRuntimeHours}
            onChange={(event) =>
              setValues((currentValues) => ({
                ...currentValues,
                minRuntimeHours: Number(event.target.value),
              }))
            }
          />
        </FormField>
        <FormField label="Confidence threshold">
          <input
            max="0.99"
            min="0.5"
            name="autoWinnerConfidenceThreshold"
            step="0.01"
            type="number"
            value={values.confidenceThreshold}
            onChange={(event) =>
              setValues((currentValues) => ({
                ...currentValues,
                confidenceThreshold: Number(event.target.value),
              }))
            }
          />
        </FormField>
      </div>
    </fetcher.Form>
  );
}

function buildAutoWinnerFormData(
  experimentId: string,
  values: {
    enabled: boolean;
    minSampleSize: number;
    minRuntimeHours: number;
    confidenceThreshold: number;
  },
) {
  const formData = new FormData();

  formData.set("_action", "saveExperimentAutoWinner");
  formData.set("experimentId", experimentId);
  if (values.enabled) {
    formData.set("autoWinnerEnabled", "on");
  }
  formData.set("autoWinnerMinSampleSize", String(values.minSampleSize));
  formData.set("autoWinnerMinRuntimeHours", String(values.minRuntimeHours));
  formData.set(
    "autoWinnerConfidenceThreshold",
    String(values.confidenceThreshold),
  );

  return formData;
}

function ExperimentLifecycleActions({
  canDuplicateCompletedExperiment,
  experiment,
}: {
  canDuplicateCompletedExperiment: boolean;
  experiment: ExperimentRow;
}) {
  const [pendingAction, setPendingAction] =
    useState<LifecycleActionValue | null>(null);
  const isCompleted = experiment.status === "COMPLETED";
  const hasDeclaredWinner = Boolean(experiment.winnerVariantId);
  const startActionLabel =
    experiment.status === "PAUSED" ? "Resume experiment" : "Start experiment";

  return (
    <section className="counterpulse-experiment-controls">
      <div className="counterpulse-experiment-controls__header">
        <h3>Experiment controls</h3>
        <p>Manage the status of this experiment.</p>
      </div>
      <Form method="post" className="counterpulse-experiment-controls__actions">
        <input name="experimentId" type="hidden" value={experiment.id} />
        {isCompleted ? (
          <button
            className="counterpulse-button counterpulse-experiment-control-button"
            disabled={!canDuplicateCompletedExperiment}
            name="_action"
            title={
              canDuplicateCompletedExperiment
                ? undefined
                : "Finish the current draft experiment before duplicating another."
            }
            type="submit"
            value="duplicateExperiment"
          >
            Duplicate experiment
          </button>
        ) : null}
        {experiment.status !== "RUNNING" && !isCompleted && (
          <button
            className="counterpulse-experiment-start-button counterpulse-experiment-control-button"
            type="button"
            onClick={() => setPendingAction("startExperiment")}
          >
            <span aria-hidden="true">▷</span>
            {startActionLabel}
          </button>
        )}
        {experiment.status === "RUNNING" && !isCompleted && (
          <button
            className="counterpulse-button-secondary counterpulse-experiment-control-button"
            type="button"
            onClick={() => setPendingAction("pauseExperiment")}
          >
            <span aria-hidden="true">Ⅱ</span>
            Pause
          </button>
        )}
        {(experiment.status === "RUNNING" ||
          experiment.status === "PAUSED") && (
          <button
            className="counterpulse-button-danger counterpulse-experiment-control-button"
            type="button"
            onClick={() => setPendingAction("stopExperiment")}
          >
            <span aria-hidden="true">□</span>
            Stop experiment
          </button>
        )}
        {!isCompleted && (
          <>
            <button
              className="counterpulse-button-secondary counterpulse-experiment-control-button"
              name="_action"
              type="submit"
              value="detectExperimentWinner"
            >
              <span aria-hidden="true">♕</span>
              Auto declare winner
            </button>
            <button
              className="counterpulse-button counterpulse-experiment-control-button"
              disabled={!hasDeclaredWinner}
              name="_action"
              title={
                hasDeclaredWinner
                  ? undefined
                  : "Declare a winning variant before applying it."
              }
              type="submit"
              value="applyExperimentWinner"
            >
              <span aria-hidden="true">♕</span>
              Apply winner
            </button>
          </>
        )}
      </Form>
      {pendingAction && (
        <ExperimentLifecycleConfirmModal
          action={pendingAction}
          experiment={experiment}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </section>
  );
}

function ExperimentLifecycleConfirmModal({
  action,
  experiment,
  onCancel,
}: {
  action: LifecycleActionValue;
  experiment: ExperimentRow;
  onCancel: () => void;
}) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const copy = getLifecycleConfirmationCopy(action, experiment.status);

  return (
    <div className="counterpulse-modal-backdrop" role="presentation">
      <button
        aria-label="Cancel experiment status change"
        className="counterpulse-modal-backdrop__dismiss"
        type="button"
        onClick={onCancel}
      />
      <section
        aria-labelledby="counterpulse-experiment-lifecycle-title"
        aria-modal="true"
        className="counterpulse-modal"
        role="dialog"
      >
        <div className="counterpulse-modal__header">
          <span
            aria-hidden="true"
            className={`counterpulse-modal__icon ${copy.isCritical ? "counterpulse-modal__icon--critical" : "counterpulse-modal__icon--info"}`}
          >
            {copy.icon}
          </span>
          <div>
            <h2 id="counterpulse-experiment-lifecycle-title">{copy.title}</h2>
            <p className="counterpulse-modal__body">{copy.body}</p>
          </div>
        </div>
        <Form
          method="post"
          className="counterpulse-modal__actions"
          onSubmit={() => {
            globalThis.setTimeout(onCancel, 0);
          }}
        >
          <input name="experimentId" type="hidden" value={experiment.id} />
          <button
            className="counterpulse-button-secondary"
            disabled={isSubmitting}
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={
              copy.isCritical
                ? "counterpulse-button-danger"
                : "counterpulse-button"
            }
            disabled={isSubmitting}
            name="_action"
            type="submit"
            value={action}
          >
            {isSubmitting ? "Saving..." : copy.confirmLabel}
          </button>
        </Form>
      </section>
    </div>
  );
}

function getLifecycleConfirmationCopy(
  action: LifecycleActionValue,
  currentStatus: string,
) {
  if (action === "pauseExperiment") {
    return {
      body: "Traffic will stop rotating through experiment variants until you resume it.",
      confirmLabel: "Pause experiment",
      icon: "Ⅱ",
      isCritical: false,
      title: "Pause experiment?",
    };
  }

  if (action === "stopExperiment") {
    return {
      body: "This ends the experiment and keeps the results visible. This same experiment cannot be started again after it is stopped.",
      confirmLabel: "Stop experiment",
      icon: "!",
      isCritical: true,
      title: "Stop experiment?",
    };
  }

  const isResume = currentStatus === "PAUSED";

  return {
    body: isResume
      ? "Traffic will resume rotating through eligible variants using the current split."
      : "Traffic will begin rotating through eligible variants using the current split.",
    confirmLabel: isResume ? "Resume experiment" : "Start experiment",
    icon: "▷",
    isCritical: false,
    title: isResume ? "Resume experiment?" : "Start experiment?",
  };
}

function VariantMiniPreview({
  design,
  viewModel,
}: {
  design: CampaignDesignValues;
  viewModel: CampaignViewModel;
}) {
  const previewPlacements = [
    "TOP_BAR",
    "BOTTOM_BAR",
    "PRODUCT_PAGE",
    "CART_PAGE",
    "CART_DRAWER",
    "PRODUCT_BADGE",
  ] as const;
  const placement =
    previewPlacements.find((option) => option === viewModel.placements[0]) ??
    "TOP_BAR";

  return (
    <div className="counterpulse-variant-preview">
      <CampaignPromoSurface
        className={[
          "counterpulse-variant-preview__surface",
          design.mobileEnabled
            ? ""
            : "counterpulse-variant-preview__surface--mobile-disabled",
        ]
          .filter(Boolean)
          .join(" ")}
        dataTestId="variant-preview-surface"
        design={design}
        placement={placement}
        variant="bar"
        viewModel={viewModel}
      />
    </div>
  );
}

function VariantDrawerField({
  children,
  description,
  label,
}: {
  children: ReactNode;
  description: string;
  label: string;
}) {
  return (
    <label className="counterpulse-variant-drawer-field">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      {children}
    </label>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ExperimentInfoContent({
  intro,
  items,
}: {
  intro: string;
  items: Array<[string, string]>;
}) {
  return (
    <div className="counterpulse-info-copy">
      <p>{intro}</p>
      <ul className="counterpulse-info-list">
        {items.map(([title, description]) => (
          <li key={title}>
            <strong>{title}</strong>
            <span>{description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FormField({
  label,
  children,
  info,
}: {
  label: string;
  children: ReactNode;
  info?: ReactNode;
}) {
  return (
    <div className="counterpulse-form-field">
      <span className="counterpulse-field-label-row">
        <span>{label}</span>
        {info}
      </span>
      <label className="counterpulse-field-control">
        <span className="counterpulse-sr-only">{label}</span>
        {children}
      </label>
    </div>
  );
}

function toVariantDraft(
  variant: ExperimentVariantRow,
  baseDesign: CampaignDesignValues,
  baseViewModel: CampaignViewModel,
): VariantDraft {
  const textOverride = readJsonRecord(variant.textOverrideJson);
  const designOverride = readJsonRecord(variant.designOverrideJson);
  const placementOverride = readJsonRecord(variant.placementOverrideJson);
  // The variant design override can carry a nested mobile override so a variant
  // can configure desktop and mobile separately (mirrors the campaign design).
  const { mobileDesign: mobileOverrideRaw, ...desktopOverride } = designOverride;
  const mobileOverride = readRecordValue(mobileOverrideRaw);
  const separate = Boolean(desktopOverride.separateMobileDesign);
  const baseMobileDesign = deriveMobileDesignFromDesktop(baseDesign);

  const desktopDesign = normalizeDesign({
    ...baseDesign,
    ...desktopOverride,
  });

  return {
    id: variant.id,
    name: variant.name,
    weight: Number.isFinite(variant.weight) ? variant.weight : 0,
    status: variant.status || "DRAFT",
    text: toTextDraft(textOverride, baseViewModel),
    design: desktopDesign,
    mobileDesign: normalizeDesign({
      ...baseMobileDesign,
      separateMobileDesign: separate,
      ...(separate ? mobileOverride : {}),
    }),
    placement: {
      placementType: readPlacementOverride(placementOverride),
      customSelector:
        readString(placementOverride.customSelector) ||
        readString(placementOverride.placementSelector),
    },
  };
}

function buildAiVariantFormData({
  baseDesign,
  baseViewModel,
  request,
  variants,
}: {
  baseDesign: CampaignDesignValues;
  baseViewModel: CampaignViewModel;
  request: AiVariantRequestDraft;
  variants: VariantDraft[];
}) {
  const formData = new FormData();

  formData.set("_action", "generateExperimentVariantWithAi");
  formData.set("strategy", request.strategy);
  formData.set("designIntensity", request.designIntensity);
  formData.set("placementIntent", request.placementIntent);
  formData.set("notes", request.notes);
  formData.set(
    "campaignJson",
    JSON.stringify({
      name: baseViewModel.name,
      type: baseViewModel.type,
      goal: baseViewModel.type,
      status: "DRAFT",
      placements: baseViewModel.placements,
      basePlacement: baseViewModel.placements[0] || "",
      text: textDraftFromViewModel(baseViewModel),
      design: normalizeDesign(baseDesign),
    }),
  );
  formData.set(
    "variantsJson",
    JSON.stringify(
      variants.map((variant) => ({
        name: variant.name,
        weight: variant.weight,
        text: buildTextOverride(variant.text, baseViewModel) ?? variant.text,
        design: buildDesignOverride(variant, baseDesign) ?? {},
        placement: buildPlacementOverride(variant.placement) ?? {},
      })),
    ),
  );

  return formData;
}

function applyAiVariantSuggestion(
  variant: VariantDraft,
  suggestion: AiVariantSuggestion,
): VariantDraft {
  const placement = suggestion.placement ?? {};
  const placementType = readAiPlacementType(placement.placementType);
  const { mobileDesign: mobileSuggestion, ...desktopSuggestion } =
    suggestion.design ?? {};
  // A mobile layout never belongs on the desktop design.
  if (desktopSuggestion.layout && isMobileDesignLayout(desktopSuggestion.layout)) {
    delete desktopSuggestion.layout;
  }
  const separate = Boolean(desktopSuggestion.separateMobileDesign);
  const desktopDesign = normalizeDesign({
    ...variant.design,
    ...desktopSuggestion,
  });

  return {
    ...variant,
    name: suggestion.name || variant.name,
    text: {
      ...variant.text,
      ...readAiTextSuggestion(suggestion.text),
    },
    design: desktopDesign,
    mobileDesign: normalizeDesign({
      ...(separate
        ? variant.mobileDesign
        : deriveMobileDesignFromDesktop(desktopDesign)),
      ...(separate && mobileSuggestion ? mobileSuggestion : {}),
      separateMobileDesign: separate,
    }),
    placement: {
      placementType,
      customSelector:
        placementType === "CUSTOM_SELECTOR"
          ? readString(placement.customSelector).slice(0, 120)
          : "",
    },
  };
}

function readAiTextSuggestion(
  text: Partial<VariantTextDraft>,
): Partial<VariantTextDraft> {
  return textFields.reduce((draft, field) => {
    const value = text[field.key];

    if (typeof value === "string") {
      draft[field.key] = value;
    }

    return draft;
  }, {} as Partial<VariantTextDraft>);
}

function readAiPlacementType(value: unknown): PlacementTypeValue | "" {
  return placementTypeOptions.some((option) => option.value === value)
    ? (value as PlacementTypeValue)
    : "";
}

function createVariantDraft(
  variantCount: number,
  baseDesign: CampaignDesignValues,
  baseViewModel: CampaignViewModel,
): VariantDraft {
  const label =
    variantCount === 0
      ? "Control"
      : `Variant ${letterForVariant(variantCount)}`;

  return {
    id: "",
    name: label,
    weight: variantCount === 0 ? 100 : 0,
    status: "DRAFT",
    text: textDraftFromViewModel(baseViewModel),
    design: normalizeDesign(baseDesign),
    mobileDesign: normalizeDesign(deriveMobileDesignFromDesktop(baseDesign)),
    placement: {
      placementType: "",
      customSelector: "",
    },
  };
}

function isControlVariantIndex(index: number) {
  return index === 0;
}

function toArchivedVariant(variant: VariantDraft): VariantDraft {
  return {
    ...variant,
    weight: 0,
    status: "ARCHIVED",
  };
}

function rebalanceVariantWeightsEvenly(variants: VariantDraft[]) {
  return applyVariantWeights(
    variants,
    distributeIntegerTotal(
      100,
      Array.from({ length: variants.length }, () => 1),
    ),
  );
}

function normalizeVariantWeights(variants: VariantDraft[]) {
  if (variants.length === 0) return variants;
  if (variants.length === 1) {
    return [{ ...variants[0], weight: 100 }];
  }

  const totalWeight = variants.reduce(
    (total, variant) => total + Math.max(0, Math.round(variant.weight)),
    0,
  );

  if (totalWeight <= 0) {
    return rebalanceVariantWeightsEvenly(variants);
  }

  return applyVariantWeights(
    variants,
    distributeIntegerTotal(
      100,
      variants.map((variant) => Math.max(0, Math.round(variant.weight))),
    ),
  );
}

function applyVariantWeights(variants: VariantDraft[], weights: number[]) {
  return variants.map((variant, index) => ({
    ...variant,
    weight: weights[index] ?? 0,
  }));
}

function distributeIntegerTotal(total: number, weights: number[]) {
  if (weights.length === 0) return [];

  const normalizedTotal = Math.max(0, Math.round(total));
  const weightTotal = weights.reduce(
    (sum, weight) => sum + Math.max(0, weight),
    0,
  );
  const baseShares =
    weightTotal > 0
      ? weights.map((weight) => Math.max(0, weight) / weightTotal)
      : weights.map(() => 1 / weights.length);
  const exactValues = baseShares.map((share) => share * normalizedTotal);
  const floors = exactValues.map((value) => Math.floor(value));
  let remainder =
    normalizedTotal - floors.reduce((sum, value) => sum + value, 0);

  const remainderOrder = exactValues
    .map((value, index) => ({
      index,
      remainder: value - Math.floor(value),
    }))
    .sort((a, b) =>
      b.remainder === a.remainder
        ? a.index - b.index
        : b.remainder - a.remainder,
    );

  for (const item of remainderOrder) {
    if (remainder <= 0) break;
    floors[item.index] += 1;
    remainder -= 1;
  }

  return floors;
}

function clampVariantWeight(value: number) {
  if (!Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(100, Math.round(value)));
}

function redistributeVariantWeight(
  variants: VariantDraft[],
  changedIndex: number,
  nextWeight: number,
  lockedIndex: number | null = null,
) {
  if (!variants[changedIndex]) return variants;
  if (variants.length === 1) return [{ ...variants[0], weight: 100 }];

  const preservedIndex =
    variants.length > 2 &&
    lockedIndex !== null &&
    lockedIndex !== changedIndex &&
    variants[lockedIndex]
      ? lockedIndex
      : null;
  const preservedWeight =
    preservedIndex === null
      ? 0
      : clampVariantWeight(variants[preservedIndex].weight);
  const targetWeight = clampVariantWeight(
    preservedIndex === null
      ? nextWeight
      : Math.min(nextWeight, 100 - preservedWeight),
  );
  const remainingWeight = 100 - targetWeight - preservedWeight;
  const otherWeights = variants
    .map((variant, index) =>
      index === changedIndex || index === preservedIndex
        ? null
        : Math.max(0, Math.round(variant.weight)),
    )
    .filter((weight): weight is number => weight !== null);
  const otherTotal = otherWeights.reduce((total, weight) => total + weight, 0);
  const nextOtherWeights =
    otherTotal > 0
      ? distributeIntegerTotal(remainingWeight, otherWeights)
      : distributeIntegerTotal(
          remainingWeight,
          Array.from({ length: otherWeights.length }, () => 1),
        );
  let nextOtherWeightIndex = 0;

  return variants.map((variant, index) => {
    if (index === changedIndex) {
      return { ...variant, weight: targetWeight };
    }

    if (index === preservedIndex) {
      return { ...variant, weight: preservedWeight };
    }

    const weight = nextOtherWeights[nextOtherWeightIndex] ?? 0;
    nextOtherWeightIndex += 1;

    return { ...variant, weight };
  });
}

function letterForVariant(index: number) {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

function textDraftFromViewModel(baseViewModel: CampaignViewModel) {
  return textFields.reduce((draft, field) => {
    draft[field.key] = readString(baseViewModel[field.key]);
    return draft;
  }, {} as VariantTextDraft);
}

function toTextDraft(
  source: Record<string, unknown>,
  baseViewModel: CampaignViewModel,
): VariantTextDraft {
  const draft = textDraftFromViewModel(baseViewModel);

  for (const field of textFields) {
    if (typeof source[field.key] === "string") {
      draft[field.key] = readString(source[field.key]);
    }
  }

  return draft;
}

function normalizeDesign(
  source: Partial<CampaignDesignValues>,
): CampaignDesignValues {
  const design = {
    ...defaultCampaignDesignValues,
    ...source,
  };

  if (design.icon === "NONE") {
    design.showIcon = false;
  }

  return design;
}

function buildTextOverride(
  text: VariantTextDraft,
  baseViewModel: CampaignViewModel,
) {
  const override: Record<string, string> = {};

  for (const field of textFields) {
    const value = text[field.key].trim();
    const baseValue = readString(baseViewModel[field.key]).trim();

    if (value !== baseValue) {
      override[field.key] = value;
    }
  }

  return Object.keys(override).length > 0 ? override : null;
}

function buildDesignOverride(
  variant: VariantDraft,
  baseDesign: CampaignDesignValues,
) {
  const override: Record<string, unknown> = {};

  for (const key of designOverrideKeys) {
    if (variant.design[key] !== baseDesign[key]) {
      override[key] = variant.design[key];
    }
  }

  // When the variant opts into a separate mobile design, persist a nested
  // mobile override (the diff vs the derived base mobile design) so the phone
  // version can differ from the desktop variant.
  if (variant.design.separateMobileDesign) {
    override.separateMobileDesign = true;

    const baseMobileDesign = deriveMobileDesignFromDesktop(baseDesign);
    const mobileOverride: Record<string, unknown> = {};

    for (const key of designOverrideKeys) {
      if (variant.mobileDesign[key] !== baseMobileDesign[key]) {
        mobileOverride[key] = variant.mobileDesign[key];
      }
    }

    if (Object.keys(mobileOverride).length > 0) {
      override.mobileDesign = mobileOverride;
    }
  }

  return Object.keys(override).length > 0 ? override : null;
}

function buildPlacementOverride(placement: VariantPlacementDraft) {
  const override: Record<string, string> = {};

  if (placement.placementType) {
    override.placementType = placement.placementType;
  }

  if (placement.customSelector.trim()) {
    override.customSelector = placement.customSelector.trim();
  }

  return Object.keys(override).length > 0 ? override : null;
}

function buildVariantPreviewModel(
  baseViewModel: CampaignViewModel,
  variant: VariantDraft,
): CampaignViewModel {
  return {
    ...baseViewModel,
    ...variant.text,
    design: variant.design,
    placements: [
      variant.placement.placementType ||
        baseViewModel.placements[0] ||
        "TOP_BAR",
    ],
  };
}

function describeVariantChanges(
  variant: VariantDraft,
  baseDesign: CampaignDesignValues,
  baseViewModel: CampaignViewModel,
  isControl: boolean,
) {
  if (isControl) {
    return [
      `Headline: ${baseViewModel.headline}`,
      baseViewModel.subheadline
        ? `Subheadline: ${baseViewModel.subheadline}`
        : "No subheadline",
      `Placement: ${formatBasePlacement(baseViewModel)}`,
      "Base campaign design",
    ];
  }

  const changes: string[] = [];

  for (const field of textFields) {
    const value = variant.text[field.key].trim();
    const baseValue = String(baseViewModel[field.key] ?? "").trim();

    if (value !== baseValue) {
      changes.push(`${field.label}: ${value || "Empty"}`);
    }
  }

  const placementOverride = buildPlacementOverride(variant.placement);

  if (placementOverride?.placementType) {
    changes.push(
      `Placement: ${formatCampaignOption(placementOverride.placementType)}`,
    );
  }

  if (placementOverride?.customSelector) {
    changes.push(`Custom selector: ${placementOverride.customSelector}`);
  }

  changes.push(...describeDesignChanges(variant.design, baseDesign));

  return changes.length > 0
    ? changes
    : ["No copy, placement, or design changes yet."];
}

function describeDesignChanges(
  design: CampaignDesignValues,
  baseDesign: CampaignDesignValues,
) {
  const changes: string[] = [];

  if (isDesignValueChanged("templateKey", design, baseDesign)) {
    changes.push(
      `Preset: ${formatDesignValue("templateKey", design.templateKey)}`,
    );
  }

  if (isDesignValueChanged("layout", design, baseDesign)) {
    changes.push(`Layout: ${formatDesignValue("layout", design.layout)}`);
  }

  if (hasDesignChanges(backgroundDesignKeys, design, baseDesign)) {
    changes.push(formatBackgroundDesignChange(design));
  }

  if (hasDesignChanges(cardDesignKeys, design, baseDesign)) {
    changes.push(formatCardDesignChange(design, baseDesign));
  }

  if (hasDesignChanges(typographyDesignKeys, design, baseDesign)) {
    changes.push(formatTypographyDesignChange(design, baseDesign));
  }

  if (hasDesignChanges(timerDesignKeys, design, baseDesign)) {
    changes.push(formatTimerDesignChange(design, baseDesign));
  }

  if (hasDesignChanges(elementDesignKeys, design, baseDesign)) {
    changes.push(formatElementDesignChange(design, baseDesign));
  }

  if (hasDesignChanges(motionDesignKeys, design, baseDesign)) {
    changes.push(formatMotionDesignChange(design, baseDesign));
  }

  if (isDesignValueChanged("customCss", design, baseDesign)) {
    changes.push("Custom CSS: Updated");
  }

  const hasUncategorizedDesignChange = designOverrideKeys.some(
    (key) =>
      !summarizedDesignKeys.includes(key) &&
      isDesignValueChanged(key, design, baseDesign),
  );

  if (hasUncategorizedDesignChange) {
    changes.push("Design settings updated");
  }

  return changes;
}

function hasDesignChanges(
  keys: Array<keyof CampaignDesignValues>,
  design: CampaignDesignValues,
  baseDesign: CampaignDesignValues,
) {
  return keys.some((key) => isDesignValueChanged(key, design, baseDesign));
}

function isDesignValueChanged(
  key: keyof CampaignDesignValues,
  design: CampaignDesignValues,
  baseDesign: CampaignDesignValues,
) {
  return design[key] !== baseDesign[key];
}

function formatBackgroundDesignChange(design: CampaignDesignValues) {
  if (design.backgroundType === "IMAGE") return "Background: Image";
  if (design.backgroundType === "GRADIENT") return "Background: Gradient";

  return "Background: Single color";
}

function formatCardDesignChange(
  design: CampaignDesignValues,
  baseDesign: CampaignDesignValues,
) {
  if (isDesignValueChanged("alignment", design, baseDesign)) {
    return `Card: ${formatDesignValue("alignment", design.alignment)} alignment`;
  }

  if (
    isDesignValueChanged("positionMode", design, baseDesign) ||
    isDesignValueChanged("positionSticky", design, baseDesign)
  ) {
    return "Card: Positioning updated";
  }

  return "Card: Spacing and borders updated";
}

function formatTypographyDesignChange(
  design: CampaignDesignValues,
  baseDesign: CampaignDesignValues,
) {
  if (isDesignValueChanged("fontFamily", design, baseDesign)) {
    return `Typography: ${formatDesignValue("fontFamily", design.fontFamily)}`;
  }

  return "Typography: Text styling updated";
}

function formatTimerDesignChange(
  design: CampaignDesignValues,
  baseDesign: CampaignDesignValues,
) {
  if (isDesignValueChanged("timerStyle", design, baseDesign)) {
    return `Timer: ${formatDesignValue("timerStyle", design.timerStyle)} style`;
  }

  if (isDesignValueChanged("timerFormat", design, baseDesign)) {
    return `Timer: ${formatDesignValue("timerFormat", design.timerFormat)} format`;
  }

  return "Timer: Display updated";
}

function formatElementDesignChange(
  design: CampaignDesignValues,
  baseDesign: CampaignDesignValues,
) {
  const details = [
    isDesignValueChanged("showButton", design, baseDesign)
      ? design.showButton
        ? "CTA shown"
        : "CTA hidden"
      : "",
    isDesignValueChanged("showIcon", design, baseDesign) ||
    isDesignValueChanged("icon", design, baseDesign) ||
    isDesignValueChanged("customIconUrl", design, baseDesign)
      ? design.showIcon && design.icon !== "NONE"
        ? `${formatDesignValue("icon", design.icon)} icon`
        : "Icon updated"
      : "",
    isDesignValueChanged("showProgressBar", design, baseDesign)
      ? design.showProgressBar
        ? "Progress shown"
        : "Progress hidden"
      : "",
    isDesignValueChanged("showCloseButton", design, baseDesign)
      ? design.showCloseButton
        ? "Close button shown"
        : "Close button hidden"
      : "",
    hasDesignChanges(
      ["accentColor", "buttonColor", "buttonTextColor", "closeButtonColor"],
      design,
      baseDesign,
    )
      ? "CTA colors updated"
      : "",
    isDesignValueChanged("mobileEnabled", design, baseDesign)
      ? "Mobile visibility updated"
      : "",
  ].filter(Boolean);

  return `Elements: ${compactChangeDetails(details) || "Visibility updated"}`;
}

function formatMotionDesignChange(
  design: CampaignDesignValues,
  baseDesign: CampaignDesignValues,
) {
  const details = [
    isDesignValueChanged("entranceAnimation", design, baseDesign)
      ? `${formatDesignValue("entranceAnimation", design.entranceAnimation)} entrance`
      : "",
    isDesignValueChanged("exitAnimation", design, baseDesign)
      ? `${formatDesignValue("exitAnimation", design.exitAnimation)} exit`
      : "",
    isDesignValueChanged("timerTickAnimation", design, baseDesign)
      ? `${formatDesignValue("timerTickAnimation", design.timerTickAnimation)} timer`
      : "",
    isDesignValueChanged("animationDurationMs", design, baseDesign)
      ? "Timing updated"
      : "",
  ].filter(Boolean);

  return `Motion: ${compactChangeDetails(details) || "Animation updated"}`;
}

function compactChangeDetails(details: string[], visibleCount = 2) {
  if (details.length <= visibleCount) return details.join(", ");

  return `${details.slice(0, visibleCount).join(", ")} +${
    details.length - visibleCount
  } more`;
}

function formatDesignValue(key: keyof CampaignDesignValues, value: unknown) {
  if (key === "templateKey" && typeof value === "string") {
    return findCampaignDesignTemplate(value).label;
  }

  if (key === "customCss") {
    return value ? "Updated" : "Empty";
  }

  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return formatDesignStringValue(value);

  return String(value ?? "");
}

function formatDesignStringValue(value: string) {
  if (!value) return "Empty";
  if (/^[A-Z0-9_]+$/.test(value)) return formatEnum(value);

  return value;
}

function readRecordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readJsonRecord(value: string) {
  const rawValue = value.trim();

  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readPlacementOverride(
  value: Record<string, unknown>,
): PlacementTypeValue | "" {
  const placement =
    readString(value.placementType) || readString(value.placement);

  return placementTypeOptions.some((option) => option.value === placement)
    ? (placement as PlacementTypeValue)
    : "";
}

function jsonOverrideValue(value: Record<string, unknown> | null) {
  return value ? JSON.stringify(value) : "";
}

function formatBasePlacement(baseViewModel: CampaignViewModel) {
  const placement = baseViewModel.placements[0];

  return placement
    ? formatCampaignOption(placement)
    : "Base campaign placement";
}

function placementInitial(label: string) {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDrawerTab(tab: DrawerTab) {
  if (tab === "copy") return "Copy";
  if (tab === "placement") return "Placement";
  if (tab === "design") return "Design";
  return "Settings";
}

function formatMetric(value: string) {
  if (value === "CLICK_RATE") return "CTR";
  if (value === "ADD_TO_CART_RATE") return "Add-to-cart rate";
  if (value === "CHECKOUT_RATE") return "Checkout rate";
  if (value === "REVENUE_PER_VISITOR") return "Revenue per visitor";

  return formatEnum(value);
}

function getPrimaryMetricColumn(metric: string) {
  if (metric === "ADD_TO_CART_RATE") return "addToCart";
  if (metric === "CHECKOUT_RATE") return "conversion";
  if (metric === "REVENUE_PER_VISITOR") return "rpv";

  return "ctr";
}

function ResultHeaderCell({
  children,
  column,
  primaryMetricColumn,
}: {
  children: ReactNode;
  column: string;
  primaryMetricColumn: string;
}) {
  const isPrimary = column === primaryMetricColumn;

  return (
    <th
      className={
        isPrimary ? "counterpulse-experiment-results__cell--primary" : undefined
      }
    >
      <span className="counterpulse-result-th">
        {children}
        {isPrimary ? (
          <span className="counterpulse-result-primary-tag">
            Primary metric
          </span>
        ) : null}
      </span>
    </th>
  );
}

function formatExperimentStatus(value: string) {
  if (value === "RUNNING") return "Live";

  return formatEnum(value);
}

function getExperimentStatusDescription(experiment: ExperimentRow) {
  if (experiment.status === "DRAFT") {
    return "Draft experiment. Start it when the variants are ready to receive traffic.";
  }

  if (experiment.status === "RUNNING") {
    return "Live experiment. Shoppers are being assigned to variants.";
  }

  if (experiment.status === "PAUSED") {
    return "Paused experiment. Results remain visible, but variants are not receiving traffic.";
  }

  if (experiment.status === "COMPLETED") {
    if (!experiment.winnerVariantId) {
      return "Completed experiment. Results are retained for reference.";
    }

    return experiment.winnerAppliedAt
      ? "Completed experiment. The winning variant has been applied to the campaign."
      : "Completed experiment. The winning variant is declared and ready to apply.";
  }

  return "Saved experiment.";
}

function sortExperimentResultsByPrimaryMetric(experiment: ExperimentRow) {
  return [...experiment.results.variants].sort(
    (left, right) =>
      right.primaryMetricValue - left.primaryMetricValue ||
      right.conversionRate - left.conversionRate ||
      right.ctr - left.ctr ||
      right.orders - left.orders ||
      right.clicks - left.clicks ||
      right.impressions - left.impressions,
  );
}

function calculateExperimentTotals(variants: ExperimentVariantResultRow[]) {
  return variants.reduce(
    (total, variant) => ({
      impressions: total.impressions + variant.impressions,
      visitors: total.visitors + variant.visitors,
      orders: total.orders + variant.orders,
      revenue: total.revenue + variant.revenue,
    }),
    {
      impressions: 0,
      visitors: 0,
      orders: 0,
      revenue: 0,
    },
  );
}

function calculateMetricLift(winnerValue: number, runnerUpValue: number) {
  if (!Number.isFinite(winnerValue) || winnerValue <= 0) return "-";
  if (!Number.isFinite(runnerUpValue) || runnerUpValue <= 0) return "Leading";

  return `+${(((winnerValue - runnerUpValue) / runnerUpValue) * 100).toFixed(
    1,
  )}%`;
}

function getRecommendedVariantId(experiment: ExperimentRow) {
  if (experiment.winnerVariantId) return experiment.winnerVariantId;

  const [recommendedVariant] = sortExperimentResultsByPrimaryMetric(experiment);

  return recommendedVariant?.variantId ?? "";
}

function isRecommendedSampleReady(
  experiment: ExperimentRow,
  variantId: string,
) {
  if (!variantId) return false;
  if (experiment.winnerVariantId === variantId) return true;

  const minimumSampleSize = Math.max(
    1,
    Math.round(experiment.autoWinnerMinSampleSize || 0),
  );
  const requiredImpressions = Math.ceil(minimumSampleSize / 2);
  const variant = experiment.results.variants.find(
    (result) => result.variantId === variantId,
  );

  return (variant?.impressions ?? 0) >= requiredImpressions;
}

function formatVariantLetter(index: number) {
  const normalizedIndex = Number.isFinite(index) && index >= 0 ? index : 0;

  return String.fromCharCode(65 + (normalizedIndex % 26));
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";

  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode || "USD",
    style: "currency",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
