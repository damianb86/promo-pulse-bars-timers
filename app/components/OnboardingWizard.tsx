import { useMemo, useState } from "react";
import { Form } from "react-router";

import { campaignDesignTemplates } from "../types/campaign-design";
import type {
  OnboardingChecklistStatus,
  OnboardingGoalValue,
  OnboardingLocationValue,
} from "../types/onboarding";
import {
  onboardingGoalOptions,
  onboardingLocationOptions,
} from "../types/onboarding";
import { getStarterCampaignDefaults } from "../utils/onboarding";
import { OnboardingChecklist } from "./OnboardingChecklist";

export type OnboardingWizardActionData = {
  success?: boolean;
  notice?: string;
  error?: string;
  campaignId?: string;
  campaignName?: string;
  campaignEditUrl?: string;
  themeEditorUrl?: string;
  placementType?: string;
  instructions?: string[];
  checklist?: OnboardingChecklistStatus;
  values?: {
    goal: OnboardingGoalValue;
    location: OnboardingLocationValue;
    templateKey: string;
    headline: string;
    subheadline: string;
    ctaText: string;
    ctaUrl: string;
  };
};

type OnboardingWizardProps = {
  hasCampaigns: boolean;
  shopifyDomain: string;
  currentPlan: string;
  checklist: OnboardingChecklistStatus;
  goalLockReasons: Record<OnboardingGoalValue, string>;
  themeEditorUrl: string;
  actionData?: OnboardingWizardActionData;
};

const steps = ["Goal", "Template", "Text", "Location", "Activate"];

export function OnboardingWizard({
  hasCampaigns,
  shopifyDomain,
  currentPlan,
  checklist,
  goalLockReasons,
  themeEditorUrl,
  actionData,
}: OnboardingWizardProps) {
  const firstAvailableGoal = useMemo(
    () =>
      onboardingGoalOptions.find((goal) => !goalLockReasons[goal.value])
        ?.value ?? "FLASH_SALE",
    [goalLockReasons],
  );
  const initialLocation = actionData?.values?.location ?? "TOP_BAR";
  const initialGoal = actionData?.values?.goal ?? firstAvailableGoal;
  const initialDefaults = getStarterCampaignDefaults(
    initialGoal,
    initialLocation,
  );
  const [step, setStep] = useState(hasCampaigns ? 1 : 0);
  const [goal, setGoal] = useState<OnboardingGoalValue>(initialGoal);
  const [location, setLocation] =
    useState<OnboardingLocationValue>(initialLocation);
  const [templateKey, setTemplateKey] = useState(
    actionData?.values?.templateKey ?? initialDefaults.templateKey,
  );
  const [headline, setHeadline] = useState(
    actionData?.values?.headline ?? initialDefaults.headline,
  );
  const [subheadline, setSubheadline] = useState(
    actionData?.values?.subheadline ?? initialDefaults.subheadline,
  );
  const [ctaText, setCtaText] = useState(
    actionData?.values?.ctaText ?? initialDefaults.ctaText,
  );
  const [ctaUrl, setCtaUrl] = useState(
    actionData?.values?.ctaUrl ?? initialDefaults.ctaUrl,
  );
  const defaults = getStarterCampaignDefaults(goal, location);
  const selectedTemplate =
    campaignDesignTemplates.find(
      (template) => template.templateKey === templateKey,
    ) ?? campaignDesignTemplates[0];
  const activeChecklist = actionData?.checklist ?? checklist;

  if (actionData?.success) {
    return (
      <div className="counterpulse-onboarding">
        <s-section>
          <div className="counterpulse-onboarding-success">
            <div>
              <s-heading>Campaign activated</s-heading>
              <s-paragraph>
                {actionData.campaignName} is active for {shopifyDomain}.
              </s-paragraph>
            </div>
            <div className="counterpulse-actions">
              {actionData.campaignEditUrl && (
                <s-button href={actionData.campaignEditUrl}>
                  Edit campaign
                </s-button>
              )}
              {(actionData.themeEditorUrl || themeEditorUrl) && (
                <s-button
                  href={actionData.themeEditorUrl || themeEditorUrl}
                  target="_blank"
                >
                  Open theme editor
                </s-button>
              )}
            </div>
          </div>
        </s-section>

        <s-section heading="Next steps">
          <div className="counterpulse-instruction-list">
            {(actionData.instructions ?? []).map((instruction) => (
              <div className="counterpulse-instruction" key={instruction}>
                {instruction}
              </div>
            ))}
          </div>
        </s-section>

        <OnboardingChecklist
          actionPath="/app/onboarding"
          items={buildChecklistItems(activeChecklist)}
        />
      </div>
    );
  }

  return (
    <Form
      className="counterpulse-onboarding"
      method="post"
      onKeyDown={(event) => {
        if (event.key === "Enter" && step < 5) {
          event.preventDefault();
        }
      }}
    >
      <input name="intent" type="hidden" value="createStarterCampaign" />
      <input name="goal" type="hidden" value={goal} />
      <input name="templateKey" type="hidden" value={templateKey} />
      <input name="location" type="hidden" value={location} />
      <input name="headline" type="hidden" value={headline} />
      <input name="subheadline" type="hidden" value={subheadline} />
      <input name="ctaText" type="hidden" value={ctaText} />
      <input name="ctaUrl" type="hidden" value={ctaUrl} />

      {actionData?.notice && (
        <s-banner tone="success" heading="Checklist updated">
          <s-paragraph>{actionData.notice}</s-paragraph>
        </s-banner>
      )}

      {actionData?.error && (
        <s-banner tone="critical" heading="Setup could not continue">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-banner>
      )}

      {step === 0 ? (
        <s-section>
          <div className="counterpulse-welcome">
            <div>
              <s-heading>Welcome to Promo Pulse</s-heading>
              <s-paragraph>
                Create your first promotion, activate it, and finish the theme
                setup from one guided flow.
              </s-paragraph>
              <div className="counterpulse-muted">
                Current plan: {formatPlan(currentPlan)}
              </div>
            </div>
            <button
              className="counterpulse-button"
              onClick={() => setStep(1)}
              type="button"
            >
              Start setup
            </button>
          </div>
        </s-section>
      ) : (
        <>
          <s-section>
            <div className="counterpulse-onboarding-progress">
              {steps.map((label, index) => (
                <div
                  className={
                    index + 1 === step
                      ? "counterpulse-onboarding-progress__step is-active"
                      : "counterpulse-onboarding-progress__step"
                  }
                  key={label}
                >
                  <span>{index + 1}</span>
                  {label}
                </div>
              ))}
            </div>
          </s-section>

          {step === 1 && (
            <s-section heading="Choose a goal">
              <div className="counterpulse-option-grid">
                {onboardingGoalOptions.map((option) => {
                  const lockedReason = goalLockReasons[option.value];
                  const isSelected = option.value === goal;

                  return (
                    <button
                      className={
                        isSelected
                          ? "counterpulse-choice is-selected"
                          : "counterpulse-choice"
                      }
                      disabled={Boolean(lockedReason)}
                      key={option.value}
                      onClick={() => selectGoal(option.value)}
                      type="button"
                    >
                      <span>
                        <strong>{option.label}</strong>
                        <small>{lockedReason || option.description}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </s-section>
          )}

          {step === 2 && (
            <s-section heading="Choose a template">
              <div className="counterpulse-template-picker">
                {campaignDesignTemplates.map((template) => (
                  <button
                    className={
                      template.templateKey === templateKey
                        ? "counterpulse-template is-active"
                        : "counterpulse-template"
                    }
                    key={template.templateKey}
                    onClick={() => setTemplateKey(template.templateKey)}
                    type="button"
                  >
                    <span
                      className="counterpulse-template__swatch"
                      style={{
                        background: template.backgroundColor,
                        borderColor: template.accentColor,
                        color: template.textColor,
                      }}
                    >
                      Aa
                    </span>
                    {template.label}
                  </button>
                ))}
              </div>
            </s-section>
          )}

          {step === 3 && (
            <s-section heading="Edit basic text">
              <div className="counterpulse-form-grid">
                <label className="counterpulse-form-field">
                  Headline
                  <input
                    onChange={(event) => setHeadline(event.currentTarget.value)}
                    value={headline}
                  />
                </label>
                <label className="counterpulse-form-field">
                  CTA text
                  <input
                    onChange={(event) => setCtaText(event.currentTarget.value)}
                    value={ctaText}
                  />
                </label>
                <label className="counterpulse-form-field counterpulse-form-field--full">
                  Subheadline
                  <input
                    onChange={(event) =>
                      setSubheadline(event.currentTarget.value)
                    }
                    value={subheadline}
                  />
                </label>
                <label className="counterpulse-form-field counterpulse-form-field--full">
                  CTA URL
                  <input
                    onChange={(event) => setCtaUrl(event.currentTarget.value)}
                    value={ctaUrl}
                  />
                </label>
              </div>
            </s-section>
          )}

          {step === 4 && (
            <s-section heading="Choose location">
              <div className="counterpulse-option-grid">
                {onboardingLocationOptions.map((option) => (
                  <button
                    className={
                      option.value === location
                        ? "counterpulse-choice is-selected"
                        : "counterpulse-choice"
                    }
                    key={option.value}
                    onClick={() => setLocation(option.value)}
                    type="button"
                  >
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </s-section>
          )}

          {step === 5 && (
            <s-section heading="Review and activate">
              <div className="counterpulse-review">
                <div>
                  <span>Goal</span>
                  <strong>{formatEnum(defaults.goal)}</strong>
                </div>
                <div>
                  <span>Type</span>
                  <strong>{formatEnum(defaults.type)}</strong>
                </div>
                <div>
                  <span>Placement</span>
                  <strong>{formatEnum(defaults.placementType)}</strong>
                </div>
                <div>
                  <span>Template</span>
                  <strong>{selectedTemplate.label}</strong>
                </div>
              </div>
              <div className="counterpulse-preview-promo counterpulse-onboarding-preview">
                <div className="counterpulse-preview-message">
                  <strong>{headline}</strong>
                  <span>{subheadline}</span>
                </div>
                <span className="counterpulse-preview-countdown">02:14:30</span>
                <span className="counterpulse-preview-cta">{ctaText}</span>
              </div>
            </s-section>
          )}

          <s-section>
            <div className="counterpulse-actions">
              <button
                className="counterpulse-button-secondary"
                disabled={step <= 1}
                onClick={() => setStep((currentStep) => currentStep - 1)}
                type="button"
              >
                Back
              </button>
              {step < 5 ? (
                <button
                  className="counterpulse-button"
                  disabled={step === 1 && Boolean(goalLockReasons[goal])}
                  onClick={() => setStep((currentStep) => currentStep + 1)}
                  type="button"
                >
                  Continue
                </button>
              ) : (
                <button className="counterpulse-button" type="submit">
                  Activate campaign
                </button>
              )}
            </div>
          </s-section>
        </>
      )}
    </Form>
  );

  function selectGoal(nextGoal: OnboardingGoalValue) {
    const nextDefaults = getStarterCampaignDefaults(nextGoal, location);
    setGoal(nextGoal);
    setTemplateKey(nextDefaults.templateKey);
    setHeadline(nextDefaults.headline);
    setSubheadline(nextDefaults.subheadline);
    setCtaText(nextDefaults.ctaText);
    setCtaUrl(nextDefaults.ctaUrl);
  }
}

function buildChecklistItems(checklist: OnboardingChecklistStatus) {
  return [
    {
      label: "Create first campaign",
      completed: checklist.firstCampaignCreated,
      description: "Create and activate a starter promotion.",
    },
    {
      label: "Enable theme app embed",
      completed: checklist.appEmbedEnabled,
      description: "Turn on the Promo Pulse app embed in Theme Editor.",
      manualField: "appEmbedEnabled" as const,
    },
    {
      label: "Add product block",
      completed: checklist.productBlockAdded,
      description: "Add the Promo Pulse block to a product template.",
      manualField: "productBlockAdded" as const,
    },
    {
      label: "Add cart block",
      completed: checklist.cartBlockAdded,
      description: "Add the Promo Pulse block to the cart template.",
      manualField: "cartBlockAdded" as const,
    },
    {
      label: "Receive first impression",
      completed: checklist.firstImpressionReceived,
      description: "Auto detected when a campaign renders on storefront.",
    },
  ];
}

function formatPlan(plan: string) {
  return `${formatEnum(plan)} plan`;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
