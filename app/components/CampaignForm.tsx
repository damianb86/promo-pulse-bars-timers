import type { ReactNode } from "react";
import { Form, Link, useNavigation } from "react-router";

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

export function CampaignForm({ values, errors = {}, mode }: CampaignFormProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (mode === "edit") {
    return <LegacyCampaignForm values={values} errors={errors} mode={mode} />;
  }

  const activeGoalLabel =
    campaignGoalOptions.find((option) => option.value === values.goal)?.label ??
    "Flash sale";
  const activeTypeLabel =
    campaignTypeOptions.find((option) => option.value === values.type)?.label ??
    "Countdown bar";
  const activePlacementLabel =
    placementTypeOptions.find((option) => option.value === values.placementType)
      ?.label ?? "Top bar";

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
          <span>Draft</span>
          <span>Premium features available</span>
          <span>Autosave off</span>
        </div>
        <div className="counterpulse-create-actions">
          <button className="counterpulse-button-secondary" type="button">
            Preview
          </button>
          <button
            className="counterpulse-button"
            data-testid="campaign-save-button"
            type="submit"
          >
            {isSubmitting ? "Saving..." : "Save campaign"}
          </button>
        </div>
      </div>

      <nav className="counterpulse-builder-tabs" aria-label="Campaign builder">
        {[
          "Basics",
          "Placement",
          "Timer",
          "Discount",
          "Targeting",
          "Design",
          "Markets",
          "Experiments",
          "AI",
          "Review",
        ].map((tab, index) => (
          <button
            aria-current={index === 0 ? "page" : undefined}
            className={index === 0 ? "is-active" : undefined}
            key={tab}
            type="button"
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="counterpulse-create-builder-grid">
        <section
          className="counterpulse-create-panel"
          aria-labelledby="campaign-basics-heading"
        >
          <div className="counterpulse-panel-heading">
            <div>
              <p className="counterpulse-kicker">Basics</p>
              <h2 id="campaign-basics-heading">Campaign setup</h2>
            </div>
            <span className="counterpulse-pill">Core fields</span>
          </div>

          <div className="counterpulse-form-grid counterpulse-form-grid--wide">
            <FormField label="Campaign name" error={errors.name} fullWidth>
              <input
                data-testid="campaign-name-input"
                name="name"
                defaultValue={values.name}
                placeholder="Spring sale - free shipping countdown"
              />
            </FormField>

            <FormField label="Campaign type" error={errors.type}>
              <select name="type" defaultValue={values.type}>
                {campaignTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Primary placement" error={errors.placementType}>
              <select name="placementType" defaultValue={values.placementType}>
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
                      type="radio"
                      name="goal"
                      value={option.value}
                      defaultChecked={values.goal === option.value}
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
                defaultValue={values.status}
              >
                {campaignStatusOptions.map((option) => (
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
                defaultValue={values.startsAt}
              />
            </FormField>

            <FormField label="End date/time" error={errors.endsAt} fullWidth>
              <input
                type="datetime-local"
                name="endsAt"
                defaultValue={values.endsAt}
              />
            </FormField>

            <FormField label="Timezone" error={errors.timezone} fullWidth>
              <input
                name="timezone"
                defaultValue={values.timezone}
                placeholder="UTC"
              />
            </FormField>

            <FormField label="Headline" error={errors.headline} fullWidth>
              <input
                name="headline"
                defaultValue={values.headline}
                placeholder="Free shipping on orders over $75"
              />
            </FormField>

            <FormField label="Subheadline" error={errors.subheadline} fullWidth>
              <textarea
                name="subheadline"
                defaultValue={values.subheadline}
                rows={3}
                placeholder="Limited time only. Do not miss out."
              />
            </FormField>

            <FormField label="CTA text" error={errors.ctaText}>
              <input
                name="ctaText"
                defaultValue={values.ctaText}
                placeholder="Shop now"
              />
            </FormField>

            <FormField label="CTA URL" error={errors.ctaUrl}>
              <input
                name="ctaUrl"
                defaultValue={values.ctaUrl}
                placeholder="/collections/sale"
              />
            </FormField>
          </div>

          <div className="counterpulse-placement-matrix">
            <div className="counterpulse-panel-heading counterpulse-panel-heading--compact">
              <div>
                <p className="counterpulse-kicker">Placement</p>
                <h3>Surface coverage</h3>
              </div>
              <span className="counterpulse-pill">{activePlacementLabel}</span>
            </div>
            <div className="counterpulse-placement-grid">
              {placementTypeOptions.slice(0, 8).map((option) => (
                <div
                  className={
                    option.value === values.placementType
                      ? "counterpulse-placement-tile is-selected"
                      : "counterpulse-placement-tile"
                  }
                  key={option.value}
                >
                  <span aria-hidden="true">
                    {placementInitial(option.label)}
                  </span>
                  <strong>{option.label}</strong>
                </div>
              ))}
            </div>
          </div>

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
        </section>

        <aside
          className="counterpulse-feature-panel"
          aria-label="Premium features"
        >
          <div className="counterpulse-panel-heading counterpulse-panel-heading--compact">
            <div>
              <p className="counterpulse-kicker">Features</p>
              <h3>Premium controls</h3>
            </div>
          </div>
          {[
            ["Unique discount codes", "Generate and track visitor codes."],
            ["A/B testing", "Test text, design, discount, and placement."],
            ["Auto-winner", "Select a winning variant conservatively."],
            ["Market overrides", "Localize thresholds and copy."],
            ["Behavior targeting", "Target recent visitor intent."],
            ["AI suggestions", "Draft safe copy and variants."],
          ].map(([title, description], index) => (
            <div className="counterpulse-feature-toggle" key={title}>
              <input type="checkbox" defaultChecked={index < 2} disabled />
              <span aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <small>{description}</small>
              </div>
            </div>
          ))}
        </aside>

        <CampaignCreationPreview
          headline={values.headline}
          subheadline={values.subheadline}
          ctaText={values.ctaText}
          typeLabel={activeTypeLabel}
          goalLabel={activeGoalLabel}
          placementLabel={activePlacementLabel}
        />
      </div>
    </Form>
  );
}

function LegacyCampaignForm({ values, errors = {}, mode }: CampaignFormProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Form data-campaign-form method="post" className="counterpulse-form">
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

      <s-section heading="Step 1: Campaign goal">
        <FieldError message={errors.goal} />
        <div className="counterpulse-option-grid">
          {campaignGoalOptions.map((option) => (
            <label className="counterpulse-choice" key={option.value}>
              <input
                type="radio"
                name="goal"
                value={option.value}
                defaultChecked={values.goal === option.value}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </s-section>

      <s-section heading="Step 2: Campaign type">
        <FormField label="Campaign type" error={errors.type}>
          <select name="type" defaultValue={values.type}>
            {campaignTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Primary placement" error={errors.placementType}>
          <select name="placementType" defaultValue={values.placementType}>
            {placementTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
      </s-section>

      <s-section heading="Step 3: Name + schedule">
        <div className="counterpulse-form-grid">
          <FormField label="Campaign name" error={errors.name}>
            <input
              data-testid="campaign-name-input"
              name="name"
              defaultValue={values.name}
            />
          </FormField>

          <FormField label="Status" error={errors.status}>
            <select
              data-testid="campaign-status-select"
              name="status"
              defaultValue={values.status}
            >
              {(mode === "edit"
                ? campaignEditableStatusOptions
                : campaignStatusOptions
              ).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Start date/time" error={errors.startsAt}>
            <input
              type="datetime-local"
              name="startsAt"
              defaultValue={values.startsAt}
            />
          </FormField>

          <FormField label="End date/time" error={errors.endsAt}>
            <input
              type="datetime-local"
              name="endsAt"
              defaultValue={values.endsAt}
            />
          </FormField>

          <FormField label="Timezone" error={errors.timezone}>
            <input name="timezone" defaultValue={values.timezone} />
          </FormField>
        </div>
      </s-section>

      <s-section heading="Step 4: Basic message">
        <div className="counterpulse-form-grid">
          <FormField label="Headline" error={errors.headline}>
            <input name="headline" defaultValue={values.headline} />
          </FormField>

          <FormField label="CTA text" error={errors.ctaText}>
            <input name="ctaText" defaultValue={values.ctaText} />
          </FormField>

          <FormField label="CTA URL" error={errors.ctaUrl}>
            <input
              name="ctaUrl"
              defaultValue={values.ctaUrl}
              placeholder="/collections/sale"
            />
          </FormField>

          <FormField label="Subheadline" error={errors.subheadline} fullWidth>
            <textarea
              name="subheadline"
              defaultValue={values.subheadline}
              rows={3}
            />
          </FormField>
        </div>
      </s-section>

      <s-section heading="Step 5: Save campaign">
        <div className="counterpulse-actions">
          <button
            className="counterpulse-button"
            data-testid="campaign-save-button"
            type="submit"
          >
            {isSubmitting
              ? "Saving..."
              : mode === "create"
                ? "Save campaign"
                : "Update campaign"}
          </button>
          <Link className="counterpulse-button-secondary" to="/app/campaigns">
            Cancel
          </Link>
        </div>
      </s-section>
    </Form>
  );
}

function CampaignCreationPreview({
  headline,
  subheadline,
  ctaText,
  typeLabel,
  goalLabel,
  placementLabel,
}: {
  headline: string;
  subheadline: string;
  ctaText: string;
  typeLabel: string;
  goalLabel: string;
  placementLabel: string;
}) {
  const previewHeadline = headline || "Free shipping on orders over $75";
  const previewSubheadline =
    subheadline || "Limited time only. Do not miss out.";
  const previewCta = ctaText || "Shop now";

  return (
    <aside className="counterpulse-preview-panel" aria-label="Campaign preview">
      <div className="counterpulse-preview-toolbar">
        <button className="is-active" type="button">
          Desktop
        </button>
        <button type="button">Mobile</button>
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
