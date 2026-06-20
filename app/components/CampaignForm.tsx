import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppAlert, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import { CampaignPreview } from "./CampaignPreview";
import { TimezoneCombobox } from "./TimezoneCombobox";
import {
  campaignGoalOptions,
  campaignEditableStatusOptions,
  campaignStatusOptions,
  campaignTypeOptions,
  placementTypeOptions,
} from "../types/campaign-options";
import {
  defaultCampaignDesignValues,
  type CampaignDesignValues,
} from "../types/campaign-design";
import type {
  CampaignFormErrors,
  CampaignFormValues,
} from "../types/campaign-form";
import { buildCampaignViewModel } from "../utils/campaign-view-model";

type CampaignFormProps = {
  design?: CampaignDesignValues;
  values: CampaignFormValues;
  errors?: CampaignFormErrors;
  formId?: string;
  mode: "create" | "edit";
  showTopbar?: boolean;
};

type BuilderTabKey = "setup" | "message" | "placement" | "schedule" | "review";

type PreviewDevice = "desktop" | "mobile";

type PreviewPlacement =
  | "TOP_BAR"
  | "BOTTOM_BAR"
  | "PRODUCT_PAGE"
  | "CART_PAGE"
  | "CART_DRAWER"
  | "PRODUCT_BADGE";

const builderTabs: Array<{
  key: BuilderTabKey;
  label: string;
  title: string;
  pill: string;
  description: string;
}> = [
  {
    key: "setup",
    label: "Setup",
    title: "Campaign setup",
    pill: "Intent",
    description:
      "Define the campaign goal, status, and promotion type before editing copy or placements.",
  },
  {
    key: "message",
    label: "Message",
    title: "Copy and call to action",
    pill: "Copy",
    description:
      "Write the customer-facing message and CTA that will appear in the live preview.",
  },
  {
    key: "placement",
    label: "Placement",
    title: "Storefront placement",
    pill: "Surface",
    description:
      "Choose where the campaign should render. Keep placement aligned with the campaign goal.",
  },
  {
    key: "schedule",
    label: "Schedule",
    title: "Timing and timezone",
    pill: "Real time",
    description:
      "Set real start/end timing and the UTC offset representative used for timer calculations.",
  },
  {
    key: "review",
    label: "Review",
    title: "Review before saving",
    pill: "Checks",
    description:
      "Check the important settings before confirming changes that can affect the storefront.",
  },
];

const goalIconLabels: Record<CampaignFormValues["goal"], string> = {
  FLASH_SALE: "Flash sale",
  FREE_SHIPPING: "Free shipping",
  CART_RESCUE: "Cart rescue",
  DELIVERY_CUTOFF: "Delivery cutoff",
  LOW_STOCK_URGENCY: "Low stock urgency",
  PRODUCT_BADGE: "Product badge",
  ANNOUNCEMENT: "Announcement",
};

export function CampaignForm({
  design = defaultCampaignDesignValues,
  values,
  errors = {},
  formId,
  mode,
  showTopbar = true,
}: CampaignFormProps) {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<BuilderTabKey>("setup");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [formValues, setFormValues] = useState(() => values);
  const [aiSuggestionJson, setAiSuggestionJson] = useState("");
  const isSubmitting = navigation.state === "submitting";
  const statusOptions =
    mode === "edit" ? campaignEditableStatusOptions : campaignStatusOptions;
  const statusLabel =
    statusOptions.find((option) => option.value === formValues.status)?.label ??
    "Draft";
  const submitLabel = mode === "create" ? "Save campaign" : "Update campaign";
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: submitLabel,
    title: mode === "create" ? "Save this campaign?" : "Update this campaign?",
    children: (
      <p>
        Confirming will save these campaign settings. If the campaign is active,
        the storefront may update as soon as the request completes.
      </p>
    ),
  });
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
  const previewPlacement = toPreviewPlacement(formValues.placementType);
  const previewViewModel = useMemo(
    () =>
      buildCampaignViewModel({
        name: formValues.name || "Campaign preview",
        type: formValues.type,
        endsAt: formValues.endsAt || null,
        timezone: formValues.timezone || "UTC",
        placements: [
          { placementType: formValues.placementType, enabled: true },
        ],
        translations: [
          {
            locale: "en",
            headline: formValues.headline || activeGoalLabel,
            subheadline: formValues.subheadline,
            ctaText: formValues.ctaText || "Shop now",
            ctaUrl: formValues.ctaUrl || "#",
            expiredText: "This offer has ended.",
          },
        ],
        design,
      }),
    [activeGoalLabel, design, formValues],
  );
  const summaryRows = useMemo(
    () => [
      ["Goal", activeGoalLabel],
      ["Type", activeTypeLabel],
      ["Placement", activePlacementLabel],
      ["Status", statusLabel],
      ["Starts", formatDateTimeLabel(formValues.startsAt, "Immediately")],
      ["Ends", formatDateTimeLabel(formValues.endsAt, "No fixed end")],
      ["Timezone", formValues.timezone || "UTC"],
    ],
    [
      activeGoalLabel,
      activePlacementLabel,
      activeTypeLabel,
      formValues.endsAt,
      formValues.startsAt,
      formValues.timezone,
      statusLabel,
    ],
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

  useEffect(() => {
    const handleReviewRequest = () => setActiveTab("review");
    const handleAiSuggestionJson = (event: Event) => {
      setAiSuggestionJson(
        event instanceof CustomEvent && typeof event.detail === "string"
          ? event.detail
          : "",
      );
    };

    window.addEventListener(
      "counterpulse:campaign-review",
      handleReviewRequest,
    );
    window.addEventListener(
      "counterpulse:ai-suggestion-json",
      handleAiSuggestionJson,
    );

    return () => {
      window.removeEventListener(
        "counterpulse:campaign-review",
        handleReviewRequest,
      );
      window.removeEventListener(
        "counterpulse:ai-suggestion-json",
        handleAiSuggestionJson,
      );
    };
  }, []);

  return (
    <>
      <Form
        data-campaign-form
        id={formId}
        method="post"
        className="counterpulse-create-form"
        onSubmit={confirmSubmit.onSubmit}
      >
        <input name="_action" type="hidden" value="saveBasics" />
        <input
          data-ai-suggestion-json
          name="aiSuggestionJson"
          readOnly
          type="hidden"
          value={aiSuggestionJson}
        />

        {errors.form && (
          <AppAlert tone="critical" title="Campaign could not be saved">
            <s-paragraph>{errors.form}</s-paragraph>
          </AppAlert>
        )}

        {showTopbar && (
          <div
            className="counterpulse-create-topbar"
            aria-label="Campaign status"
          >
            <div className="counterpulse-create-status">
              <span>{statusLabel}</span>
              <span>{activeGoalLabel}</span>
              <span>{activePlacementLabel}</span>
            </div>
            <div className="counterpulse-create-actions">
              <button
                className="counterpulse-button-secondary"
                type="button"
                onClick={() => setActiveTab("review")}
              >
                Review
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
        )}

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
          <section className="counterpulse-create-panel">
            <div className="counterpulse-panel-heading">
              <div>
                <p className="counterpulse-kicker">{activeTabMeta.label}</p>
                <h2 id="campaign-builder-heading">{activeTabMeta.title}</h2>
                <p className="counterpulse-panel-description">
                  {activeTabMeta.description}
                </p>
              </div>
              <span className="counterpulse-pill">{activeTabMeta.pill}</span>
            </div>

            <BuilderPanel activeTab={activeTab} tabKey="setup">
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

                <FormField label="Status" error={errors.status}>
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

                <FormGroup label="Goal" error={errors.goal} fullWidth>
                  <div className="counterpulse-goal-list" role="radiogroup">
                    {campaignGoalOptions.map((option) => (
                      <button
                        aria-checked={formValues.goal === option.value}
                        className="counterpulse-goal-card"
                        key={option.value}
                        role="radio"
                        type="button"
                        onClick={() => selectGoal(option.value)}
                      >
                        <input
                          checked={formValues.goal === option.value}
                          type="radio"
                          name="goal"
                          value={option.value}
                          onChange={() => selectGoal(option.value)}
                        />
                        <span
                          className="counterpulse-goal-card__icon"
                          aria-hidden="true"
                        >
                          <GoalIcon goal={option.value} />
                        </span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </FormGroup>
              </div>
            </BuilderPanel>

            <BuilderPanel activeTab={activeTab} tabKey="message">
              <div className="counterpulse-form-grid counterpulse-form-grid--wide">
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
                    rows={4}
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
              <div className="counterpulse-placement-grid">
                {placementTypeOptions.map((option) => (
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
              <FormField
                label="Primary placement"
                error={errors.placementType}
                fullWidth
              >
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
            </BuilderPanel>

            <BuilderPanel activeTab={activeTab} tabKey="schedule">
              <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                <FormField label="Start date/time" error={errors.startsAt}>
                  <input
                    type="datetime-local"
                    name="startsAt"
                    value={formValues.startsAt}
                    onChange={updateField("startsAt")}
                  />
                  <small className="counterpulse-field-hint">
                    Leave blank to start as soon as the campaign is active.
                  </small>
                </FormField>

                <FormField label="End date/time" error={errors.endsAt}>
                  <input
                    type="datetime-local"
                    name="endsAt"
                    value={formValues.endsAt}
                    onChange={updateField("endsAt")}
                  />
                </FormField>

                <div className="counterpulse-form-field--full">
                  <TimezoneCombobox
                    error={errors.timezone}
                    label="Timezone"
                    name="timezone"
                    value={formValues.timezone}
                    onChange={(timezone) =>
                      setFormValues((currentValues) => ({
                        ...currentValues,
                        timezone,
                      }))
                    }
                  />
                </div>
              </div>
            </BuilderPanel>

            <BuilderPanel activeTab={activeTab} tabKey="review">
              <TabSummaryGrid rows={summaryRows} />
              <div className="counterpulse-validation-strip">
                {[
                  ["No fake scarcity", "Copy must match real offer data."],
                  ["Discount synced", "Use real discount rules after save."],
                  ["Timer matches offer", "Countdown should mirror schedule."],
                  ["Consent-safe tracking", "No PII in visitor tracking."],
                ].map(([title, description]) => (
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

          <aside
            className="counterpulse-create-side-panel"
            aria-label="Live campaign preview"
          >
            <div className="counterpulse-preview-panel">
              <div className="counterpulse-preview-toolbar">
                <button
                  aria-pressed={previewDevice === "desktop"}
                  className={previewDevice === "desktop" ? "is-active" : ""}
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                >
                  Desktop
                </button>
                <button
                  aria-pressed={previewDevice === "mobile"}
                  className={previewDevice === "mobile" ? "is-active" : ""}
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                >
                  Mobile
                </button>
              </div>
              <CampaignPreview
                design={design}
                device={previewDevice}
                placement={previewPlacement}
                viewModel={previewViewModel}
              />
              <dl className="counterpulse-preview-meta">
                <div>
                  <dt>Goal</dt>
                  <dd>{activeGoalLabel}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{activeTypeLabel}</dd>
                </div>
                <div>
                  <dt>Placement</dt>
                  <dd>{activePlacementLabel}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </Form>
      {confirmSubmit.modal}
    </>
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

function GoalIcon({ goal }: { goal: CampaignFormValues["goal"] }) {
  const title = goalIconLabels[goal];

  return (
    <svg
      aria-label={title}
      fill="none"
      height="22"
      role="img"
      viewBox="0 0 24 24"
      width="22"
    >
      {goal === "FLASH_SALE" && (
        <path
          d="M13 2 5 13h6l-1 9 9-13h-6l1-7Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {goal === "FREE_SHIPPING" && (
        <>
          <path
            d="M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      )}
      {goal === "CART_RESCUE" && (
        <path
          d="M5 5h2l2 10h8l2-7H8m3 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm6 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM4 12l-2 2 2 2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {goal === "DELIVERY_CUTOFF" && (
        <>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 7v5l3 2"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {goal === "LOW_STOCK_URGENCY" && (
        <path
          d="M12 3 3 20h18L12 3Zm0 6v5m0 3h.01"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {goal === "PRODUCT_BADGE" && (
        <path
          d="M4 7V4h3m10 0h3v3M4 17v3h3m10 0h3v-3M8 8h8v8H8V8Zm2.5 4h3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {goal === "ANNOUNCEMENT" && (
        <path
          d="M4 10v4h4l8 4V6l-8 4H4Zm12 0 4-2v8l-4-2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
    </svg>
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

function toPreviewPlacement(
  placementType: CampaignFormValues["placementType"],
): PreviewPlacement {
  if (placementType === "BOTTOM_BAR") return "BOTTOM_BAR";
  if (placementType === "PRODUCT_PAGE") return "PRODUCT_PAGE";
  if (placementType === "CART_PAGE") return "CART_PAGE";
  if (placementType === "CART_DRAWER") return "CART_DRAWER";
  if (placementType === "COLLECTION_CARD") return "PRODUCT_BADGE";

  return "TOP_BAR";
}

function formatDateTimeLabel(value: string, fallback: string) {
  return value ? value.replace("T", " ") : fallback;
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
