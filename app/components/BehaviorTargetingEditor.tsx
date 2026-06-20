import type { ReactNode } from "react";
import { AppAlert } from "./Notifications";
import { Form, useNavigation } from "react-router";

import {
  behaviorSegmentOptions,
  type BehaviorSegmentKey,
  type BehaviorTargetingRules,
} from "../types/behavior-targeting";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

export type BehaviorTargetingErrors = {
  form?: string;
  inactiveCartMinutes?: string;
  highIntentMinEvents?: string;
  highIntentWindowMinutes?: string;
  lookbackDays?: string;
};

type BehaviorTargetingEditorProps = {
  errors?: BehaviorTargetingErrors;
  lockedReason?: string;
  notice?: string;
  values: BehaviorTargetingRules;
};

const behaviorSegmentDescriptions: Record<BehaviorSegmentKey, string> = {
  ADDED_TO_CART_NO_CHECKOUT:
    "Visitor added an item but has not started checkout.",
  CHECKOUT_STARTED:
    "Visitor reached checkout in the current attribution window.",
  CLICKED_CAMPAIGN: "Visitor clicked one of the selected campaign IDs.",
  HIGH_INTENT: "Visitor crossed the configured event count in a short window.",
  INACTIVE_CART: "Visitor has cart activity but no recent progress.",
  NEW_VISITOR: "No previous Promo Pulse touch is known for this visitor.",
  RETURNING_VISITOR: "Visitor has been seen before without using PII.",
  SAW_CAMPAIGN: "Visitor saw one of the selected campaign IDs.",
  USED_UNIQUE_CODE: "Visitor was assigned or used a unique discount code.",
  VIEWED_PRODUCT_NO_ADD_TO_CART:
    "Visitor viewed product detail pages but has not added to cart.",
};

const behaviorGroups = [
  {
    keys: ["NEW_VISITOR", "RETURNING_VISITOR"] satisfies BehaviorSegmentKey[],
    title: "Visitor state",
  },
  {
    keys: [
      "VIEWED_PRODUCT_NO_ADD_TO_CART",
      "ADDED_TO_CART_NO_CHECKOUT",
      "CHECKOUT_STARTED",
      "INACTIVE_CART",
    ] satisfies BehaviorSegmentKey[],
    title: "Shopping journey",
  },
  {
    keys: [
      "SAW_CAMPAIGN",
      "CLICKED_CAMPAIGN",
      "USED_UNIQUE_CODE",
      "HIGH_INTENT",
    ] satisfies BehaviorSegmentKey[],
    title: "Campaign and intent signals",
  },
];

export function BehaviorTargetingEditor({
  errors,
  lockedReason,
  notice,
  values,
}: BehaviorTargetingEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const selectedSegments = new Set(values.segments);

  return (
    <s-section heading="Behavior targeting">
      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Behavior targeting is locked"
        />
      )}

      {notice && (
        <AppAlert tone="info" title="Behavior targeting updated">
          <s-paragraph>{notice}</s-paragraph>
        </AppAlert>
      )}

      {errors?.form && (
        <AppAlert tone="critical" title="Behavior targeting could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {!lockedReason && (
        <Form method="post" className="counterpulse-form">
          <input name="_action" type="hidden" value="saveBehaviorTargeting" />

          <div className="counterpulse-panel-grid">
            <div className="counterpulse-config-card counterpulse-config-card--wide">
              <PanelHeader
                eyebrow="Privacy-safe"
                title="Behavior eligibility"
                description="Behavior targeting only uses Promo Pulse event history and respects consent settings."
              />
              <label className="counterpulse-toggle counterpulse-toggle--card">
                <input
                  name="behaviorEnabled"
                  type="checkbox"
                  defaultChecked={values.enabled}
                />
                <span>Enable behavior targeting</span>
              </label>
            </div>

            {behaviorGroups.map((group) => (
              <div className="counterpulse-config-card" key={group.title}>
                <PanelHeader
                  eyebrow="Segments"
                  title={group.title}
                  description="Choose one or more visitor conditions for this campaign."
                />
                <div className="counterpulse-choice-list">
                  {group.keys.map((key) => {
                    const option = behaviorSegmentOptions.find(
                      (item) => item.key === key,
                    );

                    if (!option) return null;

                    const inputId = `behavior-segment-${option.key}`;

                    return (
                      <div className="counterpulse-choice-card" key={key}>
                        <input
                          id={inputId}
                          name="behaviorSegments"
                          type="checkbox"
                          value={option.key}
                          defaultChecked={selectedSegments.has(option.key)}
                        />
                        <label htmlFor={inputId}>
                          <strong>{option.label}</strong>
                          <small>
                            {behaviorSegmentDescriptions[option.key]}
                          </small>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="counterpulse-config-card">
              <PanelHeader
                eyebrow="References"
                title="Campaign-specific rules"
                description="Used only by saw/clicked campaign segments."
              />
              <FormField label="Campaign IDs for X rules">
                <textarea
                  name="behaviorCampaignIds"
                  rows={4}
                  defaultValue={values.campaignIds.join("\n")}
                  placeholder={"campaign-id-1\ncampaign-id-2"}
                />
                <small className="counterpulse-field-hint">
                  One campaign ID per line. Leave blank for segments that do not
                  reference campaign X.
                </small>
              </FormField>
            </div>

            <div className="counterpulse-config-card">
              <PanelHeader
                eyebrow="Windows"
                title="Timing thresholds"
                description="Keep these windows conservative so targeting remains predictable."
              />
              <div className="counterpulse-form-grid">
                <FormField label="Lookback days" error={errors?.lookbackDays}>
                  <input
                    name="behaviorLookbackDays"
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    defaultValue={values.lookbackDays}
                  />
                </FormField>

                <FormField
                  label="Inactive cart minutes"
                  error={errors?.inactiveCartMinutes}
                >
                  <input
                    name="behaviorInactiveCartMinutes"
                    type="number"
                    min="15"
                    max="10080"
                    step="1"
                    defaultValue={values.inactiveCartMinutes}
                  />
                </FormField>

                <FormField
                  label="High intent event count"
                  error={errors?.highIntentMinEvents}
                >
                  <input
                    name="behaviorHighIntentMinEvents"
                    type="number"
                    min="2"
                    max="20"
                    step="1"
                    defaultValue={values.highIntentMinEvents}
                  />
                </FormField>

                <FormField
                  label="High intent window minutes"
                  error={errors?.highIntentWindowMinutes}
                >
                  <input
                    name="behaviorHighIntentWindowMinutes"
                    type="number"
                    min="5"
                    max="1440"
                    step="1"
                    defaultValue={values.highIntentWindowMinutes}
                  />
                </FormField>
              </div>
            </div>
          </div>

          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Saving..." : "Save behavior targeting"}
            </button>
          </div>
        </Form>
      )}
    </s-section>
  );
}

function PanelHeader({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="counterpulse-panel-heading counterpulse-panel-heading--compact">
      <div>
        <p className="counterpulse-kicker">{eyebrow}</p>
        <h3>{title}</h3>
        <p className="counterpulse-panel-description">{description}</p>
      </div>
    </div>
  );
}

function FormField({
  children,
  error,
  label,
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="counterpulse-field">
      <span>{label}</span>
      {children}
      {error && <small className="counterpulse-field-error">{error}</small>}
    </label>
  );
}

export type { BehaviorSegmentKey, BehaviorTargetingRules };
