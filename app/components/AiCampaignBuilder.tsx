import { useEffect, useState, type ReactNode } from "react";
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

const aiCampaignShapeOptions = [
  {
    key: "sitewide",
    label: "Sitewide sale",
    description: "A visible bar for broad announcements.",
  },
  {
    key: "product",
    label: "Product urgency",
    description: "A focused timer or message near products.",
  },
  {
    key: "cart",
    label: "Cart rescue",
    description: "A cart timer or checkout-driving offer.",
  },
  {
    key: "merchandising",
    label: "Merchandising",
    description: "Badges, low stock, or delivery promise.",
  },
];

const aiOfferQuickStarts = [
  "Limited-time sale",
  "Free shipping threshold",
  "Low stock urgency",
  "New product launch",
  "Cart recovery incentive",
  "Delivery cutoff reminder",
];

const aiGoalDescriptions: Record<CampaignAiInput["objective"], string> = {
  FLASH_SALE: "Create urgency around a short sale window.",
  FREE_SHIPPING: "Move shoppers toward a shipping threshold.",
  CART_RESCUE: "Push cart visitors to complete checkout.",
  DELIVERY_CUTOFF: "Highlight order timing and delivery promise.",
  LOW_STOCK_URGENCY: "Use scarcity messaging for product demand.",
  PRODUCT_BADGE: "Mark products with merchandising labels.",
  ANNOUNCEMENT: "Promote a general message or launch.",
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
  const [formValues, setFormValues] = useState(values);
  const [campaignNameHint, setCampaignNameHint] = useState("");
  const [selectedShape, setSelectedShape] = useState("sitewide");
  const isGenerating =
    navigation.state === "submitting" &&
    navigation.formData?.get("_action") === "generateAiCampaignSuggestion";
  const updateValue = <Key extends keyof CampaignAiInput>(
    key: Key,
    value: CampaignAiInput[Key],
  ) => {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
  };
  const applyOfferQuickStart = (offer: string) => {
    setFormValues((current) => ({
      ...current,
      knownOffer: current.knownOffer.trim() ? current.knownOffer : offer,
    }));
  };

  useEffect(() => {
    setFormValues(values);
  }, [values]);

  return (
    <div className="counterpulse-ai-builder">
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

          <div className="counterpulse-ai-builder__intro">
            <span className="counterpulse-ai-builder__icon" aria-hidden="true">
              <AiSparkIcon />
            </span>
            <div>
              <strong>Start with intent, not copywriting</strong>
              <p>
                Pick the campaign direction and add only the details the AI
                cannot infer. Names and customer-facing text can be generated
                automatically.
              </p>
            </div>
          </div>

          <Form method="post" className="counterpulse-form">
            <input
              name="_action"
              type="hidden"
              value="generateAiCampaignSuggestion"
            />
            <input
              name="objective"
              type="hidden"
              value={formValues.objective}
            />
            <input
              name="brandTone"
              type="hidden"
              value={formValues.brandTone}
            />

            <div className="counterpulse-ai-step">
              <div>
                <p className="counterpulse-kicker">Goal</p>
                <h3>What should this campaign accomplish?</h3>
              </div>
              <div className="counterpulse-ai-option-grid">
                {campaignGoalOptions.map((option) => (
                  <button
                    aria-pressed={formValues.objective === option.value}
                    className="counterpulse-ai-option-card"
                    key={option.value}
                    type="button"
                    onClick={() => updateValue("objective", option.value)}
                  >
                    <span className="counterpulse-ai-option-card__icon">
                      <AiGoalIcon />
                    </span>
                    <strong>{option.label}</strong>
                    <small>{aiGoalDescriptions[option.value]}</small>
                  </button>
                ))}
              </div>
              {errors.objective && (
                <span className="counterpulse-form-error">
                  {errors.objective}
                </span>
              )}
            </div>

            <div className="counterpulse-ai-step">
              <div>
                <p className="counterpulse-kicker">Shape</p>
                <h3>What kind of campaign should it feel like?</h3>
              </div>
              <div className="counterpulse-ai-shape-grid">
                {aiCampaignShapeOptions.map((option) => (
                  <button
                    aria-pressed={selectedShape === option.key}
                    className="counterpulse-ai-shape-card"
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedShape(option.key)}
                  >
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="counterpulse-ai-step">
              <div>
                <p className="counterpulse-kicker">Tone</p>
                <h3>How should the campaign sound?</h3>
              </div>
              <div className="counterpulse-ai-chip-grid">
                {campaignAiToneOptions.map((option) => (
                  <button
                    aria-pressed={formValues.brandTone === option.value}
                    className="counterpulse-ai-chip"
                    key={option.value}
                    type="button"
                    onClick={() => updateValue("brandTone", option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {errors.brandTone && (
                <span className="counterpulse-form-error">
                  {errors.brandTone}
                </span>
              )}
            </div>

            <div className="counterpulse-ai-step">
              <div>
                <p className="counterpulse-kicker">Offer</p>
                <h3>Pick a starting point</h3>
              </div>
              <div className="counterpulse-ai-chip-grid">
                {aiOfferQuickStarts.map((offer) => (
                  <button
                    className="counterpulse-ai-chip"
                    key={offer}
                    type="button"
                    onClick={() => applyOfferQuickStart(offer)}
                  >
                    {offer}
                  </button>
                ))}
              </div>
            </div>

            <div className="counterpulse-ai-step">
              <div>
                <p className="counterpulse-kicker">Details</p>
                <h3>Only write what the AI cannot know</h3>
              </div>
              <div className="counterpulse-form-grid">
                <FormField label="Campaign name hint">
                  <input
                    value={campaignNameHint}
                    placeholder="Optional. Leave blank to generate a name."
                    onChange={(event) =>
                      setCampaignNameHint(event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Language" error={errors.locale}>
                  <select
                    name="locale"
                    value={formValues.locale}
                    onChange={(event) =>
                      updateValue(
                        "locale",
                        event.currentTarget.value as CampaignAiInput["locale"],
                      )
                    }
                  >
                    {storefrontLocales.map((locale) => (
                      <option key={locale.locale} value={locale.locale}>
                        {locale.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  label="Product, collection, or audience"
                  error={errors.productContext}
                  fullWidth
                >
                  <textarea
                    name="productContext"
                    value={formValues.productContext}
                    rows={3}
                    placeholder="Example: premium skincare bundles, summer dresses, returning customers, first-time buyers."
                    required
                    onChange={(event) =>
                      updateValue("productContext", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField
                  label="Offer details"
                  error={errors.knownOffer}
                  fullWidth
                >
                  <textarea
                    name="knownOffer"
                    value={formValues.knownOffer}
                    rows={3}
                    placeholder="Optional. Example: 20% off, free shipping over $75, sale ends Sunday, only 12 units left."
                    onChange={(event) =>
                      updateValue("knownOffer", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Event or season" error={errors.eventName}>
                  <input
                    name="eventName"
                    value={formValues.eventName}
                    placeholder="Optional. Black Friday, launch week..."
                    onChange={(event) =>
                      updateValue("eventName", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Country" error={errors.countryCode}>
                  <input
                    name="countryCode"
                    value={formValues.countryCode}
                    maxLength={2}
                    placeholder="US"
                    onChange={(event) =>
                      updateValue(
                        "countryCode",
                        event.currentTarget.value.toUpperCase(),
                      )
                    }
                  />
                </FormField>

                <FormField label="Target URL" error={errors.ctaUrl} fullWidth>
                  <input
                    name="ctaUrl"
                    value={formValues.ctaUrl}
                    placeholder="/collections/sale"
                    onChange={(event) =>
                      updateValue("ctaUrl", event.currentTarget.value)
                    }
                  />
                </FormField>
              </div>
            </div>

            <details className="counterpulse-ai-advanced">
              <summary>Use the original compact fields</summary>
              <div className="counterpulse-form-grid">
                <FormField label="AI objective" error={errors.objective}>
                  <select
                    value={formValues.objective}
                    onChange={(event) =>
                      updateValue(
                        "objective",
                        event.currentTarget
                          .value as CampaignAiInput["objective"],
                      )
                    }
                  >
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
                    value={formValues.productContext}
                    required
                    onChange={(event) =>
                      updateValue("productContext", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Event or season" error={errors.eventName}>
                  <input
                    value={formValues.eventName}
                    onChange={(event) =>
                      updateValue("eventName", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Country" error={errors.countryCode}>
                  <input
                    value={formValues.countryCode}
                    maxLength={2}
                    onChange={(event) =>
                      updateValue(
                        "countryCode",
                        event.currentTarget.value.toUpperCase(),
                      )
                    }
                  />
                </FormField>

                <FormField label="Language" error={errors.locale}>
                  <select
                    value={formValues.locale}
                    onChange={(event) =>
                      updateValue(
                        "locale",
                        event.currentTarget.value as CampaignAiInput["locale"],
                      )
                    }
                  >
                    {storefrontLocales.map((locale) => (
                      <option key={locale.locale} value={locale.locale}>
                        {locale.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Brand tone" error={errors.brandTone}>
                  <select
                    value={formValues.brandTone}
                    onChange={(event) =>
                      updateValue(
                        "brandTone",
                        event.currentTarget
                          .value as CampaignAiInput["brandTone"],
                      )
                    }
                  >
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
                    value={formValues.knownOffer}
                    rows={2}
                    onChange={(event) =>
                      updateValue("knownOffer", event.currentTarget.value)
                    }
                  />
                </FormField>

                <FormField label="Target URL" error={errors.ctaUrl}>
                  <input
                    value={formValues.ctaUrl}
                    onChange={(event) =>
                      updateValue("ctaUrl", event.currentTarget.value)
                    }
                  />
                </FormField>
              </div>
            </details>

            <div className="counterpulse-actions">
              <button className="counterpulse-ai-submit" type="submit">
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
    </div>
  );
}

function AiSparkIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 2.5 13.6 8l5.6 1.6-5.6 1.6L12 16.7l-1.6-5.5-5.6-1.6L10.4 8 12 2.5Z" />
      <path d="M18.5 14.2 19.4 17l2.9.9-2.9.9-.9 2.8-.9-2.8-2.8-.9 2.8-.9.9-2.8Z" />
    </svg>
  );
}

function AiGoalIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 3.2a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Zm0 3.2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z" />
    </svg>
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
    new CustomEvent("promo-pulse:ai-suggestion-json", { detail: payload }),
  );
  window.requestAnimationFrame(() => {
    setFieldValue("aiSuggestionJson", payload);
    window.dispatchEvent(
      new CustomEvent("promo-pulse:ai-suggestion-json", { detail: payload }),
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
