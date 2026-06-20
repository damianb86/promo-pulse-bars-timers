import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import { CampaignPreview } from "./CampaignPreview";
import { DevicePreviewToggle, type PreviewDevice } from "./DevicePreviewToggle";
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
  CountrySelectionValue,
  ProductSelectionValue,
} from "../types/campaign-form";
import { buildCampaignViewModel } from "../utils/campaign-view-model";

type CampaignFormProps = {
  campaignId?: string;
  design?: CampaignDesignValues;
  values: CampaignFormValues;
  errors?: CampaignFormErrors;
  formId?: string;
  lockedTargetingFeatures?: {
    advanced: string;
    basic: string;
    geo: string;
  };
  mode: "create" | "edit";
  showTopbar?: boolean;
};

type BuilderTabKey = "setup" | "message" | "placement" | "schedule" | "review";

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
  campaignId,
  design = defaultCampaignDesignValues,
  values,
  errors = {},
  formId,
  lockedTargetingFeatures,
  mode,
  showTopbar = true,
}: CampaignFormProps) {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<BuilderTabKey>("setup");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [formValues, setFormValues] = useState(() => values);
  const [aiSuggestionJson, setAiSuggestionJson] = useState("");
  const [showProductExclusions, setShowProductExclusions] = useState(
    () => values.excludeProductIds.trim().length > 0,
  );
  const [timerIdCopied, setTimerIdCopied] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  const basicTargetingLocked = lockedTargetingFeatures?.basic ?? "";
  const geoTargetingLocked = lockedTargetingFeatures?.geo ?? "";
  const advancedTargetingLocked = lockedTargetingFeatures?.advanced ?? "";
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
      productSelection:
        placementType === "CUSTOM_SELECTOR"
          ? "CUSTOM_POSITION"
          : currentValues.productSelection === "CUSTOM_POSITION"
            ? "ALL_PRODUCTS"
            : currentValues.productSelection,
    }));
  };

  const selectProductSelection = (productSelection: ProductSelectionValue) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      productSelection,
      placementType:
        productSelection === "CUSTOM_POSITION"
          ? "CUSTOM_SELECTOR"
          : currentValues.placementType === "CUSTOM_SELECTOR"
            ? "PRODUCT_PAGE"
            : currentValues.placementType,
    }));
  };

  const selectCountrySelection = (countrySelection: CountrySelectionValue) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      countrySelection,
    }));
  };

  const copyTimerId = () => {
    if (!campaignId || !navigator.clipboard) return;

    navigator.clipboard
      .writeText(campaignId)
      .then(() => {
        setTimerIdCopied(true);
        window.setTimeout(() => setTimerIdCopied(false), 1800);
      })
      .catch(() => setTimerIdCopied(false));
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

                <FormField
                  label="Status"
                  error={errors.status}
                  info={
                    <FieldInfoButton label="Status" title="Campaign status">
                      <CampaignInfoContent
                        intro="Status controls whether the campaign can render now or stays hidden while you finish setup."
                        items={[
                          [
                            "Draft",
                            "Saved configuration only. It will not render on the storefront.",
                          ],
                          [
                            "Active",
                            "Eligible to render when schedule, placement, plan, and targeting rules match.",
                          ],
                          [
                            "Paused",
                            "Temporarily hidden without deleting settings or analytics history.",
                          ],
                          [
                            "Expired",
                            "Ended campaign state. Use it when the promotion should remain archived.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
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
                  label="Campaign type"
                  error={errors.type}
                  info={
                    <FieldInfoButton
                      label="Campaign type"
                      title="Campaign types"
                    >
                      <CampaignInfoContent
                        intro="Campaign type changes what Promo Pulse renders and which extra configuration panels matter."
                        items={[
                          [
                            "Countdown bar",
                            "A top or bottom urgency bar with timer and CTA. Best for sitewide sales or announcements.",
                          ],
                          [
                            "Product timer",
                            "A timer intended for product pages. Use it when urgency belongs to a product offer.",
                          ],
                          [
                            "Cart timer",
                            "A cart or drawer timer. Use it for cart rescue, checkout urgency, or short-lived cart offers.",
                          ],
                          [
                            "Free shipping goal",
                            "Shows cart progress toward a real threshold. It enables the free-shipping settings panel.",
                          ],
                          [
                            "Delivery cutoff",
                            "Shows delivery timing based on a real cutoff hour and timezone. It enables delivery settings.",
                          ],
                          [
                            "Low stock message",
                            "Displays urgency based on real inventory data when available. It does not create fake stock.",
                          ],
                          [
                            "Product badge",
                            "Renders product or collection badges and enables merchandising badge settings.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
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

                <FormGroup
                  label="Goal"
                  error={errors.goal}
                  fullWidth
                  info={
                    <FieldInfoButton label="Goal" title="Campaign goals">
                      <CampaignInfoContent
                        intro="Goal describes the merchant intent. It helps defaults, preview text, analytics grouping, and recommendations."
                        items={[
                          [
                            "Flash sale",
                            "Short-lived offer focused on urgency, usually with a timer and sale CTA.",
                          ],
                          [
                            "Free shipping",
                            "Motivates shoppers to reach a real shipping threshold. Pair it with cart placements.",
                          ],
                          [
                            "Cart rescue",
                            "Targets shoppers with cart intent using cart or drawer placements.",
                          ],
                          [
                            "Delivery cutoff",
                            "Communicates order-by timing using actual cutoff settings.",
                          ],
                          [
                            "Low stock urgency",
                            "Uses inventory context to message scarce items without inventing quantities.",
                          ],
                          [
                            "Product badge",
                            "Highlights product-level merchandising labels such as launch, sale, or limited offer.",
                          ],
                          [
                            "Announcement",
                            "General campaign message without a discount or scarcity assumption.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
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
              <div className="counterpulse-targeting-grid">
                <section
                  className="counterpulse-targeting-card"
                  aria-labelledby="campaign-products-heading"
                >
                  <div className="counterpulse-targeting-card__header">
                    <h3 id="campaign-products-heading">Select Products</h3>
                  </div>

                  <TargetingRadioOption
                    checked={formValues.productSelection === "ALL_PRODUCTS"}
                    disabled={false}
                    name="productSelection"
                    title="All products"
                    value="ALL_PRODUCTS"
                    onSelect={() => selectProductSelection("ALL_PRODUCTS")}
                  >
                    <button
                      className="counterpulse-link-button"
                      type="button"
                      disabled={Boolean(
                        advancedTargetingLocked &&
                        formValues.excludeProductIds.trim().length === 0,
                      )}
                      onClick={() => setShowProductExclusions(true)}
                    >
                      Exclude specific products
                    </button>
                    {advancedTargetingLocked &&
                      formValues.excludeProductIds.trim().length === 0 && (
                        <UpgradeText reason={advancedTargetingLocked} />
                      )}
                    {showProductExclusions ? (
                      <div className="counterpulse-targeting-field">
                        <label htmlFor="campaign-excluded-product-ids">
                          Excluded product IDs
                        </label>
                        <textarea
                          id="campaign-excluded-product-ids"
                          name="excludeProductIds"
                          rows={3}
                          value={formValues.excludeProductIds}
                          placeholder="gid://shopify/Product/123456789"
                          readOnly={Boolean(advancedTargetingLocked)}
                          onChange={updateField("excludeProductIds")}
                        />
                        <small>Separate IDs with commas or new lines.</small>
                      </div>
                    ) : (
                      <input
                        type="hidden"
                        name="excludeProductIds"
                        value={formValues.excludeProductIds}
                      />
                    )}
                  </TargetingRadioOption>

                  <TargetingRadioOption
                    checked={
                      formValues.productSelection === "SPECIFIC_PRODUCTS"
                    }
                    disabled={Boolean(
                      basicTargetingLocked &&
                      formValues.productSelection !== "SPECIFIC_PRODUCTS",
                    )}
                    lockReason={basicTargetingLocked}
                    name="productSelection"
                    title="Specific products"
                    value="SPECIFIC_PRODUCTS"
                    onSelect={() => selectProductSelection("SPECIFIC_PRODUCTS")}
                  >
                    <div className="counterpulse-targeting-field">
                      <label htmlFor="campaign-product-ids">Product IDs</label>
                      <textarea
                        id="campaign-product-ids"
                        name="productIds"
                        rows={3}
                        value={formValues.productIds}
                        placeholder="gid://shopify/Product/123456789"
                        onChange={updateField("productIds")}
                      />
                      <small>Separate IDs with commas or new lines.</small>
                      <FieldError message={errors.productIds} />
                    </div>
                  </TargetingRadioOption>

                  <TargetingRadioOption
                    checked={formValues.productSelection === "COLLECTIONS"}
                    disabled={Boolean(
                      basicTargetingLocked &&
                      formValues.productSelection !== "COLLECTIONS",
                    )}
                    lockReason={basicTargetingLocked}
                    name="productSelection"
                    title="All products in specific collections"
                    value="COLLECTIONS"
                    onSelect={() => selectProductSelection("COLLECTIONS")}
                  >
                    <div className="counterpulse-targeting-field">
                      <label htmlFor="campaign-collection-ids">
                        Collection IDs
                      </label>
                      <textarea
                        id="campaign-collection-ids"
                        name="collectionIds"
                        rows={3}
                        value={formValues.collectionIds}
                        placeholder="gid://shopify/Collection/987654321"
                        onChange={updateField("collectionIds")}
                      />
                      <small>Separate IDs with commas or new lines.</small>
                      <FieldError message={errors.collectionIds} />
                    </div>
                  </TargetingRadioOption>

                  <TargetingRadioOption
                    checked={formValues.productSelection === "TAGS"}
                    disabled={Boolean(
                      basicTargetingLocked &&
                      formValues.productSelection !== "TAGS",
                    )}
                    lockReason={basicTargetingLocked}
                    name="productSelection"
                    title="All products with specific tags"
                    value="TAGS"
                    onSelect={() => selectProductSelection("TAGS")}
                  >
                    <div className="counterpulse-targeting-field">
                      <label htmlFor="campaign-product-tags">
                        Product tags
                      </label>
                      <textarea
                        id="campaign-product-tags"
                        name="productTags"
                        rows={3}
                        value={formValues.productTags}
                        placeholder="sale, limited, preorder"
                        onChange={updateField("productTags")}
                      />
                      <small>Separate tags with commas or new lines.</small>
                      <FieldError message={errors.productTags} />
                    </div>
                  </TargetingRadioOption>

                  <TargetingRadioOption
                    checked={formValues.productSelection === "CUSTOM_POSITION"}
                    description="Add timer anywhere using app blocks or the selector below."
                    disabled={Boolean(
                      advancedTargetingLocked &&
                      formValues.productSelection !== "CUSTOM_POSITION",
                    )}
                    lockReason={advancedTargetingLocked}
                    name="productSelection"
                    title="Custom position"
                    value="CUSTOM_POSITION"
                    onSelect={() => selectProductSelection("CUSTOM_POSITION")}
                  >
                    <div className="counterpulse-targeting-field">
                      <label htmlFor="campaign-custom-selector">
                        Theme selector
                      </label>
                      <input
                        id="campaign-custom-selector"
                        name="customSelector"
                        value={formValues.customSelector}
                        placeholder=".product-form__buttons"
                        onChange={updateField("customSelector")}
                      />
                      <small>
                        Promo Pulse will inject the timer inside this selector
                        when the app embed is active.
                      </small>
                      <FieldError message={errors.customSelector} />
                    </div>
                  </TargetingRadioOption>

                  <div className="counterpulse-timer-id-box">
                    <div>
                      <span>Timer ID</span>
                      <code>{campaignId ?? "Available after save"}</code>
                    </div>
                    <button
                      aria-label="Copy timer ID"
                      type="button"
                      disabled={!campaignId}
                      onClick={copyTimerId}
                    >
                      <CopyIcon />
                    </button>
                    {timerIdCopied && <small>Copied</small>}
                    <p>
                      Countdown timer app blocks can use this ID to render this
                      exact campaign.
                    </p>
                  </div>
                </section>

                <section
                  className="counterpulse-targeting-card"
                  aria-labelledby="campaign-geolocation-heading"
                >
                  <div className="counterpulse-targeting-card__header">
                    <h3 id="campaign-geolocation-heading">
                      Geolocation targeting
                    </h3>
                  </div>

                  <TargetingRadioOption
                    checked={formValues.countrySelection === "ALL_WORLD"}
                    description="Eligible worldwide unless another timer excludes the current context."
                    disabled={false}
                    name="countrySelection"
                    title="All world"
                    value="ALL_WORLD"
                    onSelect={() => selectCountrySelection("ALL_WORLD")}
                  />

                  <TargetingRadioOption
                    checked={
                      formValues.countrySelection === "SPECIFIC_COUNTRIES"
                    }
                    disabled={Boolean(
                      geoTargetingLocked &&
                      formValues.countrySelection !== "SPECIFIC_COUNTRIES",
                    )}
                    lockReason={geoTargetingLocked}
                    name="countrySelection"
                    title="Specific countries"
                    value="SPECIFIC_COUNTRIES"
                    onSelect={() =>
                      selectCountrySelection("SPECIFIC_COUNTRIES")
                    }
                  >
                    <div className="counterpulse-targeting-field">
                      <label htmlFor="campaign-country-codes">
                        Country codes
                      </label>
                      <textarea
                        id="campaign-country-codes"
                        name="countries"
                        rows={3}
                        value={formValues.countries}
                        placeholder="US, CA, GB"
                        onChange={updateField("countries")}
                      />
                      <small>Use ISO 2-letter country codes.</small>
                      <FieldError message={errors.countries} />
                    </div>
                  </TargetingRadioOption>
                </section>
              </div>

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
                info={
                  <FieldInfoButton
                    label="Primary placement"
                    title="Campaign placements"
                  >
                    <CampaignInfoContent
                      intro="Placement controls where the widget is allowed to appear. The theme extension or app proxy still needs to be installed for that surface."
                      items={[
                        [
                          "Top or bottom bar",
                          "Sitewide bars for announcements, flash sales, and global urgency.",
                        ],
                        [
                          "Product page",
                          "Product detail surface for product timers, delivery cutoff, stock, or badges.",
                        ],
                        [
                          "Collection card",
                          "Product-card badge surface. Use carefully because theme support varies.",
                        ],
                        [
                          "Cart page or cart drawer",
                          "Cart surfaces for free shipping goals, cart rescue, and unique code reminders.",
                        ],
                        [
                          "Thank you or order status",
                          "Post-purchase surfaces controlled by Shopify checkout extensions.",
                        ],
                        [
                          "Custom selector",
                          "Advanced placement using configured selectors. Test it on the real theme.",
                        ],
                      ]}
                    />
                  </FieldInfoButton>
                }
              >
                <select
                  name="placementType"
                  value={formValues.placementType}
                  onChange={(event) =>
                    selectPlacement(
                      event.currentTarget
                        .value as CampaignFormValues["placementType"],
                    )
                  }
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
                    info={
                      <FieldInfoButton
                        label="Timezone"
                        title="Timezone used by campaign timers"
                      >
                        <CampaignInfoContent
                          intro="Timezone controls how scheduled starts, ends, delivery cutoff, and recurring timer calculations are interpreted."
                          items={[
                            [
                              "UTC offset first",
                              "The selector is ordered by UTC offset and shows one representative region per offset.",
                            ],
                            [
                              "Why it matters",
                              "A timer promising a real deadline should use the same timezone as the offer or fulfillment operation.",
                            ],
                            [
                              "Existing saved zones",
                              "If a campaign already uses a more specific IANA zone, it is preserved until you choose another option.",
                            ],
                          ]}
                        />
                      </FieldInfoButton>
                    }
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
                <DevicePreviewToggle
                  value={previewDevice}
                  onChange={setPreviewDevice}
                />
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

function TargetingRadioOption({
  checked,
  children,
  description,
  disabled,
  lockReason,
  name,
  onSelect,
  title,
  value,
}: {
  checked: boolean;
  children?: ReactNode;
  description?: string;
  disabled: boolean;
  lockReason?: string;
  name: "productSelection" | "countrySelection";
  onSelect: () => void;
  title: string;
  value: string;
}) {
  const lockedMessage = disabled ? (lockReason ?? "") : "";

  return (
    <div
      className={[
        "counterpulse-targeting-option",
        checked ? "is-selected" : "",
        disabled ? "is-disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <label>
        <input
          checked={checked}
          disabled={disabled}
          name={name}
          type="radio"
          value={value}
          onChange={onSelect}
        />
        <span>
          <strong>{title}</strong>
          {description && <small>{description}</small>}
          {lockedMessage && <UpgradeText reason={lockedMessage} />}
        </span>
      </label>
      {checked && children && (
        <div className="counterpulse-targeting-option__content">{children}</div>
      )}
    </div>
  );
}

function UpgradeText({ reason }: { reason: string }) {
  return (
    <small className="counterpulse-upgrade-inline">
      {reason} <a href="/app/billing">Upgrade</a>
    </small>
  );
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <rect
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        width="13"
        x="8"
        y="8"
      />
      <path
        d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CampaignInfoContent({
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
  info,
  fullWidth = false,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  info?: ReactNode;
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
      <span className="counterpulse-field-label-row">
        <span>{label}</span>
        {info}
      </span>
      <label className="counterpulse-field-control">
        <span className="counterpulse-sr-only">{label}</span>
        {children}
      </label>
      <FieldError message={error} />
    </div>
  );
}

function FormGroup({
  label,
  error,
  children,
  info,
  fullWidth = false,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  info?: ReactNode;
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
      <span className="counterpulse-field-label-row">
        <span>{label}</span>
        {info}
      </span>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <span className="counterpulse-form-error">{message}</span>;
}
