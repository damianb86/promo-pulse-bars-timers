import { type ChangeEvent, type ReactNode, useMemo, useState } from "react";
import { Form, useNavigation } from "react-router";

import {
  campaignGoalOptions,
  campaignEditableStatusOptions,
  campaignStatusOptions,
  campaignTypeOptions,
  placementTypeOptions,
} from "../types/campaign-options";
import type {
  CampaignFormErrors,
  CampaignFormValues,
} from "../types/campaign-form";

type CampaignFormProps = {
  values: CampaignFormValues;
  errors?: CampaignFormErrors;
  mode: "create" | "edit";
};

type BuilderTabKey =
  | "basics"
  | "placement"
  | "timer"
  | "discount"
  | "targeting"
  | "design"
  | "markets"
  | "experiments"
  | "ai"
  | "review";

type PreviewDevice = "desktop" | "mobile";

type PremiumControlKey =
  | "uniqueCodes"
  | "abTesting"
  | "autoWinner"
  | "marketOverrides"
  | "behaviorTargeting"
  | "aiSuggestions";

const builderTabs: Array<{
  key: BuilderTabKey;
  label: string;
  title: string;
  pill: string;
}> = [
  {
    key: "basics",
    label: "Basics",
    title: "Campaign setup",
    pill: "Core fields",
  },
  {
    key: "placement",
    label: "Placement",
    title: "Surface coverage",
    pill: "Storefront",
  },
  {
    key: "timer",
    label: "Timer",
    title: "Schedule and urgency",
    pill: "Real dates",
  },
  {
    key: "discount",
    label: "Discount",
    title: "Offer controls",
    pill: "Discounts",
  },
  {
    key: "targeting",
    label: "Targeting",
    title: "Audience rules",
    pill: "Eligibility",
  },
  {
    key: "design",
    label: "Design",
    title: "Message and CTA",
    pill: "Creative",
  },
  {
    key: "markets",
    label: "Markets",
    title: "Market overrides",
    pill: "Localization",
  },
  {
    key: "experiments",
    label: "Experiments",
    title: "A/B testing",
    pill: "Variants",
  },
  {
    key: "ai",
    label: "AI",
    title: "AI draft assistant",
    pill: "Review first",
  },
  {
    key: "review",
    label: "Review",
    title: "Launch review",
    pill: "Compliance",
  },
];

const premiumControls: Array<{
  key: PremiumControlKey;
  title: string;
  description: string;
  tab: BuilderTabKey;
}> = [
  {
    key: "uniqueCodes",
    title: "Unique discount codes",
    description: "Generate and track visitor codes.",
    tab: "discount",
  },
  {
    key: "abTesting",
    title: "A/B testing",
    description: "Test text, design, discount, and placement.",
    tab: "experiments",
  },
  {
    key: "autoWinner",
    title: "Auto-winner",
    description: "Select a winning variant conservatively.",
    tab: "experiments",
  },
  {
    key: "marketOverrides",
    title: "Market overrides",
    description: "Localize thresholds and copy.",
    tab: "markets",
  },
  {
    key: "behaviorTargeting",
    title: "Behavior targeting",
    description: "Target recent visitor intent.",
    tab: "targeting",
  },
  {
    key: "aiSuggestions",
    title: "AI suggestions",
    description: "Draft safe copy and variants.",
    tab: "ai",
  },
];

const initialPremiumControlState: Record<PremiumControlKey, boolean> = {
  uniqueCodes: false,
  abTesting: false,
  autoWinner: false,
  marketOverrides: false,
  behaviorTargeting: false,
  aiSuggestions: false,
};

export function CampaignForm({ values, errors = {}, mode }: CampaignFormProps) {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<BuilderTabKey>("basics");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [formValues, setFormValues] = useState(() => values);
  const [enabledPremiumControls, setEnabledPremiumControls] = useState(
    initialPremiumControlState,
  );
  const isSubmitting = navigation.state === "submitting";

  const statusOptions =
    mode === "edit" ? campaignEditableStatusOptions : campaignStatusOptions;
  const statusLabel =
    statusOptions.find((option) => option.value === formValues.status)?.label ??
    "Draft";
  const submitLabel = mode === "create" ? "Save campaign" : "Update campaign";
  const activeGoalLabel =
    campaignGoalOptions.find((option) => option.value === formValues.goal)
      ?.label ?? "Flash sale";
  const activeTypeLabel =
    campaignTypeOptions.find((option) => option.value === formValues.type)
      ?.label ?? "Countdown bar";
  const activePlacementLabel =
    placementTypeOptions.find(
      (option) => option.value === formValues.placementType,
    )?.label ?? "Top bar";
  const activeTabMeta =
    builderTabs.find((tab) => tab.key === activeTab) ?? builderTabs[0];
  const summaryRows = useMemo(
    () => [
      ["Goal", activeGoalLabel],
      ["Type", activeTypeLabel],
      ["Placement", activePlacementLabel],
      ["Status", statusLabel],
    ],
    [activeGoalLabel, activePlacementLabel, activeTypeLabel, statusLabel],
  );
  const validationItems = useMemo(
    () => [
      ["No fake scarcity", "Copy must match real offer data."],
      ["Discount synced", "Use real discount rules after save."],
      ["Timer matches offer", "Countdown should mirror schedule."],
      ["Consent-safe tracking", "No PII in visitor tracking."],
    ],
    [],
  );

  const updateField =
    <Key extends keyof CampaignFormValues>(field: Key) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const value = event.currentTarget.value as CampaignFormValues[Key];

      setFormValues((currentValues) => ({
        ...currentValues,
        [field]: value,
      }));
    };

  const activatePremiumControl = (
    control: (typeof premiumControls)[number],
  ) => {
    setEnabledPremiumControls((currentControls) => ({
      ...currentControls,
      [control.key]: !currentControls[control.key],
    }));
    setActiveTab(control.tab);
  };

  const selectPlacement = (
    placementType: CampaignFormValues["placementType"],
  ) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      placementType,
    }));
  };

  const selectGoal = (goal: CampaignFormValues["goal"]) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      goal,
    }));
  };

  const previewHeadline =
    formValues.headline || "Free shipping on orders over $75";
  const previewSubheadline =
    formValues.subheadline || "Limited time only. Do not miss out.";
  const previewCta = formValues.ctaText || "Shop now";
  const timerSummary = formValues.endsAt
    ? `Ends ${formValues.endsAt.replace("T", " ")} ${formValues.timezone}`
    : "No end date configured";
  const discountSummary =
    mode === "edit"
      ? "Use the discount sections below to sync real offers and unique codes."
      : "Save the campaign first to configure synced discounts.";
  const aiSummary =
    mode === "create"
      ? "Use the AI assistant drawer to generate safe copy, design, and variants."
      : "AI suggestions can be applied as drafts and reviewed before publishing.";

  return (
    <Form data-campaign-form method="post" className="counterpulse-create-form">
      <input name="_action" type="hidden" value="saveBasics" />
      <input
        data-ai-suggestion-json
        defaultValue=""
        name="aiSuggestionJson"
        type="hidden"
      />

      {errors.form && (
        <s-banner tone="critical" heading="Campaign could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      <div className="counterpulse-create-topbar" aria-label="Campaign status">
        <div className="counterpulse-create-status">
          <span>{statusLabel}</span>
          <span>Premium features available</span>
          <span>Autosave off</span>
        </div>
        <div className="counterpulse-create-actions">
          <button
            className="counterpulse-button-secondary"
            type="button"
            onClick={() => setActiveTab("review")}
          >
            Preview
          </button>
          <button
            className="counterpulse-button"
            data-testid="campaign-save-button"
            type="submit"
          >
            {isSubmitting ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>

      <div
        className="counterpulse-builder-tabs"
        aria-label="Campaign builder"
        role="tablist"
      >
        {builderTabs.map((tab) => (
          <button
            aria-controls={`campaign-builder-panel-${tab.key}`}
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? "is-active" : undefined}
            id={`campaign-builder-tab-${tab.key}`}
            key={tab.key}
            role="tab"
            type="button"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="counterpulse-create-builder-grid">
        <section
          className="counterpulse-create-panel"
          aria-labelledby="campaign-builder-heading"
        >
          <div className="counterpulse-panel-heading">
            <div>
              <p className="counterpulse-kicker">{activeTabMeta.label}</p>
              <h2 id="campaign-builder-heading">{activeTabMeta.title}</h2>
            </div>
            <span className="counterpulse-pill">{activeTabMeta.pill}</span>
          </div>

          <BuilderPanel activeTab={activeTab} tabKey="basics">
            <div className="counterpulse-form-grid counterpulse-form-grid--wide">
              <FormField label="Campaign name" error={errors.name} fullWidth>
                <input
                  data-testid="campaign-name-input"
                  name="name"
                  value={formValues.name}
                  placeholder="Spring sale - free shipping countdown"
                  onChange={updateField("name")}
                />
              </FormField>

              <FormField label="Campaign type" error={errors.type}>
                <select
                  name="type"
                  value={formValues.type}
                  onChange={updateField("type")}
                >
                  {campaignTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Primary placement" error={errors.placementType}>
                <select
                  name="placementType"
                  value={formValues.placementType}
                  onChange={updateField("placementType")}
                >
                  {placementTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormGroup label="Goal" error={errors.goal} fullWidth>
                <div className="counterpulse-goal-list" role="radiogroup">
                  {campaignGoalOptions.map((option) => (
                    <label className="counterpulse-choice" key={option.value}>
                      <input
                        checked={formValues.goal === option.value}
                        type="radio"
                        name="goal"
                        value={option.value}
                        onChange={() => selectGoal(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </FormGroup>

              <FormField label="Status" error={errors.status} fullWidth>
                <select
                  data-testid="campaign-status-select"
                  name="status"
                  value={formValues.status}
                  onChange={updateField("status")}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Start date/time"
                error={errors.startsAt}
                fullWidth
              >
                <input
                  type="datetime-local"
                  name="startsAt"
                  value={formValues.startsAt}
                  onChange={updateField("startsAt")}
                />
              </FormField>

              <FormField label="End date/time" error={errors.endsAt} fullWidth>
                <input
                  type="datetime-local"
                  name="endsAt"
                  value={formValues.endsAt}
                  onChange={updateField("endsAt")}
                />
              </FormField>

              <FormField label="Timezone" error={errors.timezone} fullWidth>
                <input
                  name="timezone"
                  value={formValues.timezone}
                  placeholder="UTC"
                  onChange={updateField("timezone")}
                />
              </FormField>

              <FormField label="Headline" error={errors.headline} fullWidth>
                <input
                  name="headline"
                  value={formValues.headline}
                  placeholder="Free shipping on orders over $75"
                  onChange={updateField("headline")}
                />
              </FormField>

              <FormField
                label="Subheadline"
                error={errors.subheadline}
                fullWidth
              >
                <textarea
                  name="subheadline"
                  value={formValues.subheadline}
                  rows={3}
                  placeholder="Limited time only. Do not miss out."
                  onChange={updateField("subheadline")}
                />
              </FormField>

              <FormField label="CTA text" error={errors.ctaText}>
                <input
                  name="ctaText"
                  value={formValues.ctaText}
                  placeholder="Shop now"
                  onChange={updateField("ctaText")}
                />
              </FormField>

              <FormField label="CTA URL" error={errors.ctaUrl}>
                <input
                  name="ctaUrl"
                  value={formValues.ctaUrl}
                  placeholder="/collections/sale"
                  onChange={updateField("ctaUrl")}
                />
              </FormField>
            </div>
          </BuilderPanel>

          <BuilderPanel activeTab={activeTab} tabKey="placement">
            <div className="counterpulse-placement-matrix counterpulse-placement-matrix--flat">
              <div className="counterpulse-placement-grid">
                {placementTypeOptions.slice(0, 8).map((option) => (
                  <button
                    aria-pressed={option.value === formValues.placementType}
                    className={
                      option.value === formValues.placementType
                        ? "counterpulse-placement-tile is-selected"
                        : "counterpulse-placement-tile"
                    }
                    key={option.value}
                    type="button"
                    onClick={() => selectPlacement(option.value)}
                  >
                    <span aria-hidden="true">
                      {placementInitial(option.label)}
                    </span>
                    <strong>{option.label}</strong>
                  </button>
                ))}
              </div>
            </div>
          </BuilderPanel>

          <BuilderPanel activeTab={activeTab} tabKey="timer">
            <TabSummaryGrid
              rows={[
                ["Schedule", timerSummary],
                ["Start", formValues.startsAt || "Starts when activated"],
                ["Timezone", formValues.timezone || "UTC"],
                [
                  "Timer policy",
                  "Only show urgency tied to real campaign dates.",
                ],
              ]}
            />
          </BuilderPanel>

          <BuilderPanel activeTab={activeTab} tabKey="discount">
            <TabSummaryGrid
              rows={[
                ["Discount setup", discountSummary],
                [
                  "Unique codes",
                  enabledPremiumControls.uniqueCodes ? "Selected" : "Off",
                ],
                ["CTA", previewCta],
                [
                  "Apply behavior",
                  "Use real Shopify discount links when configured.",
                ],
              ]}
            />
          </BuilderPanel>

          <BuilderPanel activeTab={activeTab} tabKey="targeting">
            <TabSummaryGrid
              rows={[
                ["Placement", activePlacementLabel],
                [
                  "Behavior targeting",
                  enabledPremiumControls.behaviorTargeting ? "Selected" : "Off",
                ],
                [
                  "Consent",
                  "No behavior rules when tracking consent is unavailable.",
                ],
                [
                  "Fallback",
                  "Campaign remains eligible through basic targeting.",
                ],
              ]}
            />
          </BuilderPanel>

          <BuilderPanel activeTab={activeTab} tabKey="design">
            <TabSummaryGrid
              rows={[
                ["Headline", previewHeadline],
                ["Subheadline", previewSubheadline],
                ["CTA", previewCta],
                ["Creative", "Use the Design & Preview editor after saving."],
              ]}
            />
          </BuilderPanel>

          <BuilderPanel activeTab={activeTab} tabKey="markets">
            <TabSummaryGrid
              rows={[
                [
                  "Market overrides",
                  enabledPremiumControls.marketOverrides ? "Selected" : "Off",
                ],
                [
                  "Locale",
                  "Global fallback applies when no market rule matches.",
                ],
                ["Currency", "Resolved from storefront market context."],
                ["Thresholds", "Market thresholds override global settings."],
              ]}
            />
          </BuilderPanel>

          <BuilderPanel activeTab={activeTab} tabKey="experiments">
            <TabSummaryGrid
              rows={[
                [
                  "A/B testing",
                  enabledPremiumControls.abTesting ? "Selected" : "Off",
                ],
                [
                  "Auto-winner",
                  enabledPremiumControls.autoWinner ? "Selected" : "Off",
                ],
                ["Primary metric", "CTR, add-to-cart, checkout, or revenue."],
                [
                  "Assignment",
                  "Stable by visitor when an experiment is running.",
                ],
              ]}
            />
          </BuilderPanel>

          <BuilderPanel activeTab={activeTab} tabKey="ai">
            <TabSummaryGrid
              rows={[
                [
                  "AI suggestions",
                  enabledPremiumControls.aiSuggestions ? "Selected" : "Off",
                ],
                ["Mode", aiSummary],
                [
                  "Safety",
                  "No fake stock, fake discounts, or auto-publishing.",
                ],
                [
                  "Review",
                  "Merchant confirmation is required before applying.",
                ],
              ]}
            />
          </BuilderPanel>

          <BuilderPanel activeTab={activeTab} tabKey="review">
            <TabSummaryGrid rows={summaryRows} />
            <div className="counterpulse-validation-strip">
              {validationItems.map(([title, description]) => (
                <div className="counterpulse-validation-item" key={title}>
                  <span>OK</span>
                  <div>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </div>
                </div>
              ))}
            </div>
          </BuilderPanel>
        </section>

        <div className="counterpulse-create-side-panel">
          <CampaignCreationPreview
            ctaText={formValues.ctaText}
            device={previewDevice}
            goalLabel={activeGoalLabel}
            headline={formValues.headline}
            placementLabel={activePlacementLabel}
            subheadline={formValues.subheadline}
            typeLabel={activeTypeLabel}
            onDeviceChange={setPreviewDevice}
          />

          <PremiumFeatureControls
            activeStates={enabledPremiumControls}
            controls={premiumControls}
            onToggle={activatePremiumControl}
          />
        </div>
      </div>
    </Form>
  );
}

function BuilderPanel({
  activeTab,
  children,
  tabKey,
}: {
  activeTab: BuilderTabKey;
  children: ReactNode;
  tabKey: BuilderTabKey;
}) {
  return (
    <div
      aria-labelledby={`campaign-builder-tab-${tabKey}`}
      className="counterpulse-builder-panel"
      hidden={activeTab !== tabKey}
      id={`campaign-builder-panel-${tabKey}`}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

function PremiumFeatureControls({
  activeStates,
  controls,
  onToggle,
}: {
  activeStates: Record<PremiumControlKey, boolean>;
  controls: typeof premiumControls;
  onToggle: (control: (typeof premiumControls)[number]) => void;
}) {
  return (
    <aside className="counterpulse-feature-panel" aria-label="Premium features">
      <div className="counterpulse-panel-heading counterpulse-panel-heading--compact">
        <div>
          <p className="counterpulse-kicker">Features</p>
          <h3>Premium controls</h3>
        </div>
      </div>
      {controls.map((control) => (
        <button
          aria-checked={activeStates[control.key]}
          className="counterpulse-feature-toggle"
          key={control.key}
          role="switch"
          type="button"
          onClick={() => onToggle(control)}
        >
          <span aria-hidden="true" />
          <div>
            <strong>{control.title}</strong>
            <small>{control.description}</small>
          </div>
        </button>
      ))}
    </aside>
  );
}

function TabSummaryGrid({ rows }: { rows: string[][] }) {
  return (
    <dl className="counterpulse-tab-summary">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CampaignCreationPreview({
  headline,
  subheadline,
  ctaText,
  device,
  typeLabel,
  goalLabel,
  placementLabel,
  onDeviceChange,
}: {
  headline: string;
  subheadline: string;
  ctaText: string;
  device: PreviewDevice;
  typeLabel: string;
  goalLabel: string;
  placementLabel: string;
  onDeviceChange: (device: PreviewDevice) => void;
}) {
  const previewHeadline = headline || "Free shipping on orders over $75";
  const previewSubheadline =
    subheadline || "Limited time only. Do not miss out.";
  const previewCta = ctaText || "Shop now";

  return (
    <aside
      className={
        device === "mobile"
          ? "counterpulse-preview-panel counterpulse-preview-panel--mobile"
          : "counterpulse-preview-panel"
      }
      aria-label="Campaign preview"
    >
      <div className="counterpulse-preview-toolbar">
        <button
          aria-pressed={device === "desktop"}
          className={device === "desktop" ? "is-active" : undefined}
          type="button"
          onClick={() => onDeviceChange("desktop")}
        >
          Desktop
        </button>
        <button
          aria-pressed={device === "mobile"}
          className={device === "mobile" ? "is-active" : undefined}
          type="button"
          onClick={() => onDeviceChange("mobile")}
        >
          Mobile
        </button>
      </div>

      <div className="counterpulse-storefront-preview">
        <div className="counterpulse-storefront-bar">
          <strong>{previewHeadline}</strong>
          <span>02:14:37</span>
        </div>
        <div className="counterpulse-storefront-header">
          <span>Menu</span>
          <strong>PULSE</strong>
          <span>Cart</span>
        </div>
        <div className="counterpulse-product-preview">
          <div className="counterpulse-product-image" />
          <div>
            <h3>Ceramic Vase</h3>
            <p>$48.00</p>
            <p className="counterpulse-muted">{previewSubheadline}</p>
            <button type="button">{previewCta}</button>
          </div>
        </div>
      </div>

      <div className="counterpulse-cart-preview">
        <div className="counterpulse-cart-preview__header">
          <strong>Your cart</strong>
          <span>2 items</span>
        </div>
        <div className="counterpulse-cart-meter">
          <span />
        </div>
        <p>You are $51.00 away from free shipping.</p>
      </div>

      <div className="counterpulse-checkout-preview">
        <strong>Secure checkout</strong>
        <p>Estimated delivery: May 24 - May 27</p>
      </div>

      <dl className="counterpulse-preview-meta">
        <div>
          <dt>Goal</dt>
          <dd>{goalLabel}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{typeLabel}</dd>
        </div>
        <div>
          <dt>Placement</dt>
          <dd>{placementLabel}</dd>
        </div>
      </dl>
    </aside>
  );
}

function placementInitial(label: string) {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function FormField({
  label,
  error,
  children,
  fullWidth = false,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <label
      className={
        fullWidth
          ? "counterpulse-form-field counterpulse-form-field--full"
          : "counterpulse-form-field"
      }
    >
      <span>{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

function FormGroup({
  label,
  error,
  children,
  fullWidth = false,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={
        fullWidth
          ? "counterpulse-form-field counterpulse-form-field--full"
          : "counterpulse-form-field"
      }
    >
      <span>{label}</span>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <span className="counterpulse-form-error">{message}</span>;
}
