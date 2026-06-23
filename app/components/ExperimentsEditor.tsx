import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Form, useNavigation } from "react-router";

import { DesignControls } from "./DesignControls";
import { AppAlert, FieldInfoButton } from "./Notifications";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";
import {
  defaultCampaignDesignValues,
  findCampaignDesignTemplate,
  type CampaignDesignMediaOptions,
  type CampaignDesignValues,
} from "../types/campaign-design";
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
  placement: VariantPlacementDraft;
};

type DrawerTab = "copy" | "placement" | "design" | "settings";

const metricOptions = [
  { label: "CTR", value: "CLICK_RATE" },
  { label: "Add-to-cart rate", value: "ADD_TO_CART_RATE" },
  { label: "Checkout rate", value: "CHECKOUT_RATE" },
  { label: "Revenue per visitor", value: "REVENUE_PER_VISITOR" },
];

const variantStatuses = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "WINNER",
  "LOSER",
  "ARCHIVED",
];

const defaultVariantRows: ExperimentVariantRow[] = [
  {
    id: "",
    name: "Control",
    weight: 50,
    status: "DRAFT",
    designOverrideJson: "",
    textOverrideJson: "",
    discountOverrideJson: "",
    placementOverrideJson: "",
  },
  {
    id: "",
    name: "Variant B",
    weight: 50,
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
  return (
    <s-section heading="Experiments">
      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Experiments are locked"
        />
      )}

      {notice && (
        <AppAlert tone="info" title="Experiments updated">
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

          <ExperimentComposer
            baseDesign={baseDesign}
            baseViewModel={baseViewModel}
            designMediaOptions={designMediaOptions}
            isProPlan={isProPlan}
          />

          <div className="counterpulse-experiments-list">
            {experiments.length > 0 ? (
              experiments.map((experiment) => (
                <ExistingExperiment
                  baseDesign={baseDesign}
                  baseViewModel={baseViewModel}
                  designMediaOptions={designMediaOptions}
                  experiment={experiment}
                  isProPlan={isProPlan}
                  key={experiment.id}
                />
              ))
            ) : (
              <div className="counterpulse-experiment-empty">
                <h3>No experiments created yet.</h3>
                <p>
                  Create variants to compare copy, placement, and design while
                  keeping the campaign offer, targeting, and markets unchanged.
                </p>
              </div>
            )}
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
  designMediaOptions,
  experiment,
  isProPlan,
}: {
  baseDesign: CampaignDesignValues;
  baseViewModel: CampaignViewModel;
  designMediaOptions: CampaignDesignMediaOptions;
  experiment: ExperimentRow;
  isProPlan: boolean;
}) {
  return (
    <section className="counterpulse-experiment-shell">
      <ExperimentComposer
        baseDesign={baseDesign}
        baseViewModel={baseViewModel}
        designMediaOptions={designMediaOptions}
        experiment={experiment}
        isProPlan={isProPlan}
      />

      <ExperimentResultsTable experiment={experiment} />
      <ExperimentAutoWinnerForm experiment={experiment} />
      <ExperimentLifecycleActions experiment={experiment} />
    </section>
  );
}

function ExperimentComposer({
  baseDesign,
  baseViewModel,
  designMediaOptions,
  experiment,
  isProPlan,
}: {
  baseDesign: CampaignDesignValues;
  baseViewModel: CampaignViewModel;
  designMediaOptions: CampaignDesignMediaOptions;
  experiment?: ExperimentRow;
  isProPlan: boolean;
}) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const initialVariants = useMemo(
    () =>
      (experiment?.variants.length ? experiment.variants : defaultVariantRows)
        .filter((variant) => variant.status !== "ARCHIVED")
        .map((variant) => toVariantDraft(variant, baseDesign)),
    [baseDesign, experiment],
  );
  const [variants, setVariants] = useState<VariantDraft[]>(initialVariants);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("copy");
  const [name, setName] = useState(
    experiment?.name || `${baseViewModel.name} experiment`,
  );
  const [primaryMetric, setPrimaryMetric] = useState(
    experiment?.primaryMetric || "CLICK_RATE",
  );
  const activeVariant =
    variants[activeVariantIndex] ?? variants[variants.length - 1] ?? null;
  const totalWeight = variants.reduce(
    (total, variant) => total + Math.max(0, variant.weight),
    0,
  );

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

  const addVariant = () => {
    setVariants((currentVariants) => {
      const nextVariant = createVariantDraft(
        currentVariants.length,
        baseDesign,
      );
      const nextVariants = [...currentVariants, nextVariant];
      setActiveVariantIndex(nextVariants.length - 1);
      setDrawerTab("copy");

      return nextVariants;
    });
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
      <VariantHiddenInputs baseDesign={baseDesign} variants={variants} />

      <header className="counterpulse-experiment-header">
        <div>
          <p className="counterpulse-kicker">
            {experiment ? "Saved experiment" : "New experiment"}
          </p>
          <div className="counterpulse-experiment-title-row">
            <h3>{experiment?.name || "Create experiment"}</h3>
            {experiment && (
              <span className="counterpulse-experiment-status">
                {formatEnum(experiment.status)}
              </span>
            )}
          </div>
        </div>
        <div className="counterpulse-experiment-metrics">
          <MetricPill
            label="Primary metric"
            value={formatMetric(primaryMetric)}
          />
          <MetricPill label="Traffic split" value={`${totalWeight}% total`} />
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
            Compare variants side by side. Traffic weights are relative and are
            normalized automatically when the total is not 100%.
          </p>
        </div>
        <button
          className="counterpulse-button-secondary"
          type="button"
          onClick={addVariant}
        >
          Add variant
        </button>
      </div>

      <div className="counterpulse-experiment-board">
        <div className="counterpulse-variant-grid">
          {variants.map((variant, index) => (
            <VariantCard
              baseDesign={baseDesign}
              baseViewModel={baseViewModel}
              isActive={activeVariantIndex === index}
              index={index}
              key={`${variant.id || "new"}-${index}`}
              variant={variant}
              onEdit={() => {
                setActiveVariantIndex(index);
                setDrawerTab("copy");
              }}
              onWeightChange={(weight) =>
                updateVariant(index, (currentVariant) => ({
                  ...currentVariant,
                  weight,
                }))
              }
            />
          ))}
        </div>

        {activeVariant && (
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
          />
        )}
      </div>

      <div className="counterpulse-actions">
        <button className="counterpulse-button" type="submit">
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

function VariantCard({
  baseDesign,
  baseViewModel,
  index,
  isActive,
  variant,
  onEdit,
  onWeightChange,
}: {
  baseDesign: CampaignDesignValues;
  baseViewModel: CampaignViewModel;
  index: number;
  isActive: boolean;
  variant: VariantDraft;
  onEdit: () => void;
  onWeightChange: (weight: number) => void;
}) {
  const preview = buildVariantPreviewModel(baseViewModel, variant);
  const changes = describeVariantChanges(variant, baseDesign);

  return (
    <article
      className={
        isActive
          ? "counterpulse-variant-card is-active"
          : "counterpulse-variant-card"
      }
    >
      <header>
        <div>
          <span
            className={`counterpulse-variant-dot counterpulse-variant-dot--${index % 6}`}
            aria-hidden="true"
          />
          <h4>{variant.name || `Variant ${index + 1}`}</h4>
          {index === 0 && <span>Baseline</span>}
        </div>
        <button
          aria-label={`Edit ${variant.name || `Variant ${index + 1}`}`}
          className="counterpulse-icon-button"
          type="button"
          onClick={onEdit}
        >
          Edit
        </button>
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
        <div className="counterpulse-traffic-split__number">
          <input
            aria-label={`Variant ${index + 1} weight`}
            max={100}
            min={0}
            type="number"
            value={variant.weight}
            onChange={(event) => onWeightChange(Number(event.target.value))}
          />
          <span>%</span>
        </div>
        <div>
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="counterpulse-variant-changes">
        <strong>{index === 0 ? "What is shown" : "Changes vs. control"}</strong>
        <ul>
          {changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      </div>

      <VariantMiniPreview design={variant.design} viewModel={preview} />

      <button
        className="counterpulse-button-secondary"
        type="button"
        onClick={onEdit}
      >
        Edit variant
      </button>
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
}) {
  const preview = buildVariantPreviewModel(baseViewModel, variant);

  return (
    <aside className="counterpulse-variant-drawer" aria-label="Edit variant">
      <header className="counterpulse-variant-drawer__header">
        <div>
          <p className="counterpulse-kicker">Variant {index + 1}</p>
          <h3>Edit {variant.name || `Variant ${index + 1}`}</h3>
        </div>
        <button
          aria-label="Close variant editor"
          className="counterpulse-icon-button"
          type="button"
          onClick={onClose}
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
          <VariantDrawerField
            description="Choose where this variant renders. Leave as base campaign to inherit the current campaign placement."
            label="Placement"
          >
            <select
              value={variant.placement.placementType}
              onChange={(event) =>
                onChange({
                  ...variant,
                  placement: {
                    ...variant.placement,
                    placementType: event.target.value as
                      | PlacementTypeValue
                      | "",
                  },
                })
              }
            >
              <option value="">Base campaign placement</option>
              {placementTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </VariantDrawerField>

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
          <DesignControls
            errors={{}}
            hasTimer={Boolean(
              baseViewModel.timer || baseViewModel.deliveryCutoff,
            )}
            isProPlan={isProPlan}
            mediaOptions={designMediaOptions}
            values={variant.design}
            onChange={(design) =>
              onChange({
                ...variant,
                design,
              })
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
            description="Relative traffic weight for new visitor assignments."
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
                  onChange({ ...variant, weight: Number(event.target.value) })
                }
              />
              <input
                aria-label={`Variant ${index + 1} traffic split value`}
                max={100}
                min={0}
                type="number"
                value={variant.weight}
                onChange={(event) =>
                  onChange({ ...variant, weight: Number(event.target.value) })
                }
              />
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
            Offers, discount setup, targeting, markets, and schedule are always
            inherited from the base campaign for every variant.
          </div>
        </div>
      )}

      <div className="counterpulse-variant-drawer__preview">
        <div>
          <strong>Preview</strong>
          <span>
            {variant.placement.placementType
              ? formatCampaignOption(variant.placement.placementType)
              : formatBasePlacement(baseViewModel)}
          </span>
        </div>
        <VariantMiniPreview design={variant.design} viewModel={preview} />
      </div>
    </aside>
  );
}

function VariantHiddenInputs({
  baseDesign,
  variants,
}: {
  baseDesign: CampaignDesignValues;
  variants: VariantDraft[];
}) {
  return (
    <>
      {variants.map((variant, index) => (
        <div hidden key={`${variant.id || "new"}-${index}`}>
          <input name="variantId" readOnly value={variant.id} />
          <input name="variantName" readOnly value={variant.name} />
          <input name="variantWeight" readOnly value={variant.weight} />
          <input name="variantStatus" readOnly value={variant.status} />
          <textarea
            name="textOverride"
            readOnly
            value={jsonOverrideValue(buildTextOverride(variant.text))}
          />
          <textarea
            name="designOverride"
            readOnly
            value={jsonOverrideValue(buildDesignOverride(variant, baseDesign))}
          />
          <textarea
            name="placementOverride"
            readOnly
            value={jsonOverrideValue(buildPlacementOverride(variant.placement))}
          />
        </div>
      ))}
    </>
  );
}

function ExperimentResultsTable({ experiment }: { experiment: ExperimentRow }) {
  return (
    <section className="counterpulse-experiment-results">
      <div className="counterpulse-experiment-results__header">
        <h3>Experiment Results</h3>
        <span>{experiment.results.runtimeHours.toFixed(1)} runtime hours</span>
      </div>
      <table className="counterpulse-table">
        <thead>
          <tr>
            <th>Variant</th>
            <th>Impressions</th>
            <th>Clicks</th>
            <th>CTR</th>
            <th>Add-to-cart</th>
            <th>Orders</th>
            <th>Revenue</th>
            <th>RPV</th>
            <th>Conversion</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {experiment.results.variants.map((variant) => (
            <tr key={variant.variantId}>
              <td>
                {variant.variantName}
                {variant.variantId === experiment.winnerVariantId
                  ? " (winner)"
                  : ""}
              </td>
              <td>{variant.impressions}</td>
              <td>{variant.clicks}</td>
              <td>{formatPercent(variant.ctr)}</td>
              <td>{variant.addToCart}</td>
              <td>{variant.orders}</td>
              <td>
                {formatCurrency(
                  variant.revenue,
                  experiment.results.currencyCode,
                )}
              </td>
              <td>
                {formatCurrency(
                  variant.revenuePerVisitor,
                  experiment.results.currencyCode,
                )}
              </td>
              <td>{formatPercent(variant.conversionRate)}</td>
              <td>
                <Form method="post">
                  <input
                    name="experimentId"
                    type="hidden"
                    value={experiment.id}
                  />
                  <input
                    name="variantId"
                    type="hidden"
                    value={variant.variantId}
                  />
                  <button
                    className="counterpulse-button-secondary"
                    name="_action"
                    type="submit"
                    value="declareExperimentWinner"
                  >
                    Declare winner
                  </button>
                </Form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ExperimentAutoWinnerForm({
  experiment,
}: {
  experiment: ExperimentRow;
}) {
  return (
    <Form method="post" className="counterpulse-experiment-auto-winner">
      <input name="_action" type="hidden" value="saveExperimentAutoWinner" />
      <input name="experimentId" type="hidden" value={experiment.id} />
      <div className="counterpulse-toggle">
        <label className="counterpulse-toggle-label">
          <input
            defaultChecked={experiment.autoWinnerEnabled}
            name="autoWinnerEnabled"
            type="checkbox"
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
          defaultValue={experiment.autoWinnerMinSampleSize}
          min="1"
          name="autoWinnerMinSampleSize"
          step="1"
          type="number"
        />
      </FormField>
      <FormField label="Minimum runtime hours">
        <input
          defaultValue={experiment.autoWinnerMinRuntimeHours}
          min="0"
          name="autoWinnerMinRuntimeHours"
          step="1"
          type="number"
        />
      </FormField>
      <FormField label="Confidence threshold">
        <input
          defaultValue={experiment.autoWinnerConfidenceThreshold}
          max="0.99"
          min="0.5"
          name="autoWinnerConfidenceThreshold"
          step="0.01"
          type="number"
        />
      </FormField>
      <button className="counterpulse-button-secondary" type="submit">
        Save auto-winner
      </button>
    </Form>
  );
}

function ExperimentLifecycleActions({
  experiment,
}: {
  experiment: ExperimentRow;
}) {
  return (
    <Form method="post" className="counterpulse-actions">
      <input name="experimentId" type="hidden" value={experiment.id} />
      <button
        className="counterpulse-button-secondary"
        name="_action"
        type="submit"
        value="startExperiment"
      >
        Start
      </button>
      <button
        className="counterpulse-button-secondary"
        name="_action"
        type="submit"
        value="pauseExperiment"
      >
        Pause
      </button>
      <button
        className="counterpulse-button-secondary"
        name="_action"
        type="submit"
        value="stopExperiment"
      >
        Stop experiment
      </button>
      <button
        className="counterpulse-button-secondary"
        name="_action"
        type="submit"
        value="detectExperimentWinner"
      >
        Auto declare winner
      </button>
      <button
        className="counterpulse-button"
        disabled={!experiment.winnerVariantId}
        name="_action"
        type="submit"
        value="applyExperimentWinner"
      >
        Apply winner
      </button>
    </Form>
  );
}

function VariantMiniPreview({
  design,
  viewModel,
}: {
  design: CampaignDesignValues;
  viewModel: CampaignViewModel;
}) {
  const surfaceStyle = {
    "--cp-mini-bg": getSurfaceBackground(design),
    "--cp-mini-title": design.titleColor,
    "--cp-mini-subtitle": design.subheadingColor,
    "--cp-mini-button": design.buttonColor,
    "--cp-mini-button-text": design.buttonTextColor,
    "--cp-mini-timer": design.timerColor,
    "--cp-mini-border": design.borderColor,
    "--cp-mini-radius": `${Math.min(18, Math.max(0, design.borderRadius))}px`,
    "--cp-mini-align": getTextAlign(design.alignment),
  } as CSSProperties;

  return (
    <div
      className={`counterpulse-variant-preview counterpulse-variant-preview--${design.layout.toLowerCase()}`}
      style={surfaceStyle}
    >
      <div>
        <strong>{viewModel.headline}</strong>
        {viewModel.subheadline && <span>{viewModel.subheadline}</span>}
      </div>
      {viewModel.timer && (
        <div className="counterpulse-variant-preview__timer">
          <span>23</span>
          <span>59</span>
          <span>47</span>
        </div>
      )}
      {design.showButton && viewModel.ctaText && (
        <span className="counterpulse-variant-preview__button">
          {viewModel.ctaText}
        </span>
      )}
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
): VariantDraft {
  const textOverride = readJsonRecord(variant.textOverrideJson);
  const designOverride = readJsonRecord(variant.designOverrideJson);
  const placementOverride = readJsonRecord(variant.placementOverrideJson);

  return {
    id: variant.id,
    name: variant.name,
    weight: Number.isFinite(variant.weight) ? variant.weight : 0,
    status: variant.status || "DRAFT",
    text: toTextDraft(textOverride),
    design: normalizeDesign({
      ...baseDesign,
      ...designOverride,
    }),
    placement: {
      placementType: readPlacementOverride(placementOverride),
      customSelector:
        readString(placementOverride.customSelector) ||
        readString(placementOverride.placementSelector),
    },
  };
}

function createVariantDraft(
  variantCount: number,
  baseDesign: CampaignDesignValues,
): VariantDraft {
  const label =
    variantCount === 0
      ? "Control"
      : `Variant ${letterForVariant(variantCount)}`;

  return {
    id: "",
    name: label,
    weight: variantCount < 2 ? 50 : 34,
    status: "DRAFT",
    text: emptyTextDraft(),
    design: normalizeDesign(baseDesign),
    placement: {
      placementType: "",
      customSelector: "",
    },
  };
}

function letterForVariant(index: number) {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

function emptyTextDraft(): VariantTextDraft {
  return textFields.reduce((draft, field) => {
    draft[field.key] = "";
    return draft;
  }, {} as VariantTextDraft);
}

function toTextDraft(source: Record<string, unknown>): VariantTextDraft {
  const draft = emptyTextDraft();

  for (const field of textFields) {
    draft[field.key] = readString(source[field.key]);
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

function buildTextOverride(text: VariantTextDraft) {
  const override: Record<string, string> = {};

  for (const field of textFields) {
    const value = text[field.key].trim();

    if (value) {
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
  const textOverride = buildTextOverride(variant.text) ?? {};

  return {
    ...baseViewModel,
    ...textOverride,
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
) {
  const changes = [];
  const textOverride = buildTextOverride(variant.text);
  const designOverride = buildDesignOverride(variant, baseDesign);
  const placementOverride = buildPlacementOverride(variant.placement);

  if (textOverride) {
    const keys = Object.keys(textOverride).length;
    changes.push(`${keys} message ${keys === 1 ? "field" : "fields"}`);
  } else {
    changes.push("Original messages");
  }

  if (designOverride) {
    const template = findCampaignDesignTemplate(variant.design.templateKey);
    changes.push(`${template.label} design`);
  } else {
    changes.push("Original design");
  }

  if (placementOverride?.placementType) {
    changes.push(formatCampaignOption(placementOverride.placementType));
  } else {
    changes.push("Default placement");
  }

  changes.push("Same offers and targeting");

  return changes;
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

function getSurfaceBackground(design: CampaignDesignValues) {
  if (design.backgroundType === "IMAGE" && design.backgroundImageUrl) {
    return `linear-gradient(rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.16)), url("${escapeCssUrl(
      design.backgroundImageUrl,
    )}") center / cover no-repeat`;
  }

  if (design.backgroundType === "GRADIENT") {
    return `linear-gradient(${design.gradientAngle}deg, ${design.gradientStartColor}, ${design.gradientEndColor})`;
  }

  return design.backgroundColor;
}

function escapeCssUrl(value: string) {
  return value.replace(/["\\\n\r]/g, "");
}

function getTextAlign(alignment: CampaignDesignValues["alignment"]) {
  if (alignment === "LEFT") return "left";
  if (alignment === "RIGHT") return "right";
  return "center";
}

function formatBasePlacement(baseViewModel: CampaignViewModel) {
  const placement = baseViewModel.placements[0];

  return placement
    ? formatCampaignOption(placement)
    : "Base campaign placement";
}

function formatDrawerTab(tab: DrawerTab) {
  if (tab === "copy") return "Copy";
  if (tab === "placement") return "Placement";
  if (tab === "design") return "Design";
  return "Settings";
}

function formatMetric(value: string) {
  return value === "CLICK_RATE" ? "CTR" : formatEnum(value);
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
