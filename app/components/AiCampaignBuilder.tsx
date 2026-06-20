import { useState, type ReactNode } from "react";
import { AppAlert, AppToast } from "./Notifications";
import { Form, useNavigation } from "react-router";

import {
  campaignAiToneOptions,
  type CampaignAiFormErrors,
  type CampaignAiInput,
  type CampaignSuggestion,
} from "../types/ai-campaign";
import { campaignGoalOptions } from "../types/campaign-options";
import { storefrontLocales } from "../types/localization";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

type AiCampaignBuilderProps = {
  errors?: CampaignAiFormErrors;
  lockedReason?: string;
  suggestion?: CampaignSuggestion | null;
  templateSourceName?: string;
  values: CampaignAiInput;
};

export function AiCampaignBuilder({
  errors = {},
  lockedReason,
  suggestion,
  templateSourceName,
  values,
}: AiCampaignBuilderProps) {
  const navigation = useNavigation();
  const [applied, setApplied] = useState(false);
  const isGenerating =
    navigation.state === "submitting" &&
    navigation.formData?.get("_action") === "generateAiCampaignSuggestion";

  return (
    <s-section heading="Generate with AI">
      {lockedReason ? (
        <PlanUpgradeCallout
          message={lockedReason}
          title="AI Campaign Builder is locked"
        />
      ) : (
        <>
          {errors.form && (
            <AppAlert tone="critical" title="Suggestion could not be created">
              <s-paragraph>{errors.form}</s-paragraph>
            </AppAlert>
          )}

          {templateSourceName && (
            <AppAlert tone="info" title="Template context loaded">
              <s-paragraph>
                Generate variants from {templateSourceName}, then review before
                applying or saving.
              </s-paragraph>
            </AppAlert>
          )}

          <Form method="post" className="counterpulse-form">
            <input
              name="_action"
              type="hidden"
              value="generateAiCampaignSuggestion"
            />
            <div className="counterpulse-form-grid">
              <FormField label="AI objective" error={errors.objective}>
                <select name="objective" defaultValue={values.objective}>
                  {campaignGoalOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Product or category"
                error={errors.productContext}
              >
                <input
                  name="productContext"
                  defaultValue={values.productContext}
                  required
                />
              </FormField>

              <FormField label="Event or season" error={errors.eventName}>
                <input name="eventName" defaultValue={values.eventName} />
              </FormField>

              <FormField label="Country" error={errors.countryCode}>
                <input
                  name="countryCode"
                  defaultValue={values.countryCode}
                  maxLength={2}
                />
              </FormField>

              <FormField label="Language" error={errors.locale}>
                <select name="locale" defaultValue={values.locale}>
                  {storefrontLocales.map((locale) => (
                    <option key={locale.locale} value={locale.locale}>
                      {locale.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Brand tone" error={errors.brandTone}>
                <select name="brandTone" defaultValue={values.brandTone}>
                  {campaignAiToneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Real offer or discount"
                error={errors.knownOffer}
                fullWidth
              >
                <textarea
                  name="knownOffer"
                  defaultValue={values.knownOffer}
                  rows={2}
                />
              </FormField>

              <FormField label="Target URL" error={errors.ctaUrl}>
                <input name="ctaUrl" defaultValue={values.ctaUrl} />
              </FormField>
            </div>

            <div className="counterpulse-actions">
              <button className="counterpulse-button" type="submit">
                {isGenerating
                  ? "Generating..."
                  : templateSourceName
                    ? "Generate variants from template"
                    : "Generate with AI"}
              </button>
            </div>
          </Form>

          {suggestion && (
            <s-box paddingBlockStart="base">
              <div className="counterpulse-card">
                <h3 className="counterpulse-section-heading">
                  AI suggestion preview
                </h3>

                {suggestion.safety.warnings.length > 0 && (
                  <AppAlert tone="warning" title="Review generated copy">
                    {suggestion.safety.warnings.map((warning) => (
                      <s-paragraph key={warning}>{warning}</s-paragraph>
                    ))}
                  </AppAlert>
                )}

                <div className="counterpulse-form-grid">
                  <PreviewItem label="Name" value={suggestion.campaign.name} />
                  <PreviewItem
                    label="Headline"
                    value={suggestion.campaign.headline}
                  />
                  <PreviewItem
                    label="Subheadline"
                    value={suggestion.campaign.subheadline}
                  />
                  <PreviewItem
                    label="CTA"
                    value={suggestion.campaign.ctaText}
                  />
                  <PreviewItem
                    label="Type"
                    value={formatEnum(suggestion.campaign.type)}
                  />
                  <PreviewItem
                    label="Placement"
                    value={formatEnum(suggestion.campaign.placementType)}
                  />
                </div>

                <s-box paddingBlockStart="base">
                  <table className="counterpulse-table">
                    <thead>
                      <tr>
                        <th>Variant</th>
                        <th>Headline</th>
                        <th>Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suggestion.variants.map((variant) => (
                        <tr key={variant.name}>
                          <td>{variant.name}</td>
                          <td>{variant.headline}</td>
                          <td>{variant.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </s-box>

                <div className="counterpulse-actions">
                  <button
                    className="counterpulse-button"
                    onClick={() => {
                      applySuggestionToCampaignForm(suggestion);
                      setApplied(true);
                    }}
                    type="button"
                  >
                    Apply suggestion
                  </button>
                </div>

                {applied && (
                  <AppToast tone="success" title="Suggestion applied">
                    <s-paragraph>
                      Review the campaign fields before saving.
                    </s-paragraph>
                  </AppToast>
                )}
              </div>
            </s-box>
          )}
        </>
      )}
    </s-section>
  );
}

function applySuggestionToCampaignForm(suggestion: CampaignSuggestion) {
  const payload = JSON.stringify(suggestion);

  setRadioValue("goal", suggestion.campaign.goal);
  setFieldValue("type", suggestion.campaign.type);
  setFieldValue("placementType", suggestion.campaign.placementType);
  setFieldValue("name", suggestion.campaign.name);
  setFieldValue("status", "DRAFT");
  setFieldValue("headline", suggestion.campaign.headline);
  setFieldValue("subheadline", suggestion.campaign.subheadline);
  setFieldValue("ctaText", suggestion.campaign.ctaText);
  setFieldValue("ctaUrl", suggestion.campaign.ctaUrl);
  setFieldValue("aiSuggestionJson", payload);
  window.dispatchEvent(
    new CustomEvent("counterpulse:ai-suggestion-json", { detail: payload }),
  );
  window.requestAnimationFrame(() => {
    setFieldValue("aiSuggestionJson", payload);
    window.dispatchEvent(
      new CustomEvent("counterpulse:ai-suggestion-json", { detail: payload }),
    );
  });
}

function setFieldValue(name: string, value: string) {
  const campaignForm = document.querySelector("[data-campaign-form]");
  const element = campaignForm?.querySelector<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >(`[name="${name}"]`);

  if (!element) return;

  setNativeValue(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setRadioValue(name: string, value: string) {
  const campaignForm = document.querySelector("[data-campaign-form]");
  const radios = campaignForm?.querySelectorAll<HTMLInputElement>(
    `input[type="radio"][name="${name}"]`,
  );
  const selectedRadio = Array.from(radios ?? []).find(
    (radio) => radio.value === value,
  );

  if (!selectedRadio) return;

  if (selectedRadio.checked) {
    selectedRadio.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  selectedRadio.click();
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  const prototype = Object.getPrototypeOf(element) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (valueSetter) {
    valueSetter.call(element, value);
    return;
  }

  element.value = value;
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="counterpulse-empty-state__title">{label}</div>
      <div>{value || "-"}</div>
    </div>
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
      {error && <span className="counterpulse-form-error">{error}</span>}
    </label>
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
