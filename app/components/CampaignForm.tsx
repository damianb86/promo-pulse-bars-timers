import type { ReactNode } from "react";
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

export function CampaignForm({ values, errors = {}, mode }: CampaignFormProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Form method="post" className="counterpulse-form">
      <input name="_action" type="hidden" value="saveBasics" />

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
            <input name="name" defaultValue={values.name} />
          </FormField>

          <FormField label="Status" error={errors.status}>
            <select name="status" defaultValue={values.status}>
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
          <button className="counterpulse-button" type="submit">
            {isSubmitting
              ? "Saving..."
              : mode === "create"
                ? "Save campaign"
                : "Update campaign"}
          </button>
          <s-button href="/app/campaigns" variant="secondary">
            Cancel
          </s-button>
        </div>
      </s-section>
    </Form>
  );
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <span className="counterpulse-form-error">{message}</span>;
}
