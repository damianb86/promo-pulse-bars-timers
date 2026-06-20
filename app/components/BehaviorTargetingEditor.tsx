import type { ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
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
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Save behavior targeting",
    title: "Save behavior targeting?",
    children: (
      <p>
        This can change which visitors are eligible for the campaign. Targeting
        only uses consent-safe Promo Pulse events.
      </p>
    ),
  });

  return (
    <s-section heading="Behavior targeting">
      <p className="counterpulse-section-description">
        Restrict campaign eligibility based on recent, non-PII visitor behavior
        such as cart activity, campaign clicks, or purchase intent.
      </p>

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
        <Form
          method="post"
          className="counterpulse-form"
          onSubmit={confirmSubmit.onSubmit}
        >
          <input name="_action" type="hidden" value="saveBehaviorTargeting" />

          <div className="counterpulse-panel-grid">
            <div className="counterpulse-config-card counterpulse-config-card--wide">
              <PanelHeader
                eyebrow="Privacy-safe"
                title="Behavior eligibility"
                description="Behavior targeting only uses Promo Pulse event history and respects consent settings."
              />
              <div className="counterpulse-toggle counterpulse-toggle--card">
                <label className="counterpulse-toggle-label">
                  <input
                    name="behaviorEnabled"
                    type="checkbox"
                    defaultChecked={values.enabled}
                  />
                  <span>Enable behavior targeting</span>
                </label>
                <FieldInfoButton
                  label="Enable behavior targeting"
                  title="Behavior targeting"
                >
                  <BehaviorInfoContent
                    intro="Behavior targeting limits campaign eligibility using recent Promo Pulse events from the same visitor ID."
                    items={[
                      [
                        "No PII",
                        "The profile uses visitor/session IDs and campaign events, not names, email addresses, or customer records.",
                      ],
                      [
                        "Consent-aware",
                        "When analytics or consent settings disallow tracking, behavior targeting should not make a visitor eligible.",
                      ],
                      [
                        "Fallback",
                        "If the browser blocks storage or events are missing, the campaign falls back to basic targeting.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              </div>
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
              <FormField
                label="Campaign IDs for X rules"
                info={
                  <FieldInfoButton
                    label="Campaign IDs for X rules"
                    title="Campaign-specific behavior"
                  >
                    <BehaviorInfoContent
                      intro="These IDs are used only by the saw campaign X and clicked campaign X segments."
                      items={[
                        [
                          "Specific campaigns",
                          "List campaign IDs when this campaign should react to a known previous campaign.",
                        ],
                        [
                          "Blank state",
                          "Leave blank for general segments such as new visitor, returning visitor, or high intent.",
                        ],
                        ["Format", "Use one campaign ID per line."],
                      ]}
                    />
                  </FieldInfoButton>
                }
              >
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
                <FormField
                  label="Lookback days"
                  error={errors?.lookbackDays}
                  info={
                    <FieldInfoButton label="Lookback days" title="Lookback">
                      <BehaviorInfoContent
                        intro="Lookback days controls how far back Promo Pulse reads behavior events for this campaign."
                        items={[
                          [
                            "Short windows",
                            "More relevant for urgency and cart rescue campaigns.",
                          ],
                          [
                            "Long windows",
                            "Useful for returning visitor or repeat-intent campaigns, but less precise.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
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
                  info={
                    <FieldInfoButton
                      label="Inactive cart minutes"
                      title="Inactive cart window"
                    >
                      <BehaviorInfoContent
                        intro="Inactive cart minutes defines when a cart is considered stale enough to target."
                        items={[
                          [
                            "Example",
                            "60 means a visitor with cart activity and no recent progress can match after one hour.",
                          ],
                          [
                            "Avoid pressure",
                            "Use conservative windows so the campaign does not appear immediately after a normal cart action.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
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
                  info={
                    <FieldInfoButton
                      label="High intent event count"
                      title="High intent"
                    >
                      <BehaviorInfoContent
                        intro="High intent is based on a minimum number of qualifying events inside the configured window."
                        items={[
                          [
                            "Signals",
                            "Product views, campaign clicks, add-to-cart, and checkout events can contribute depending on tracking availability.",
                          ],
                          [
                            "Threshold",
                            "Higher values target fewer visitors but usually indicate stronger intent.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
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
                  info={
                    <FieldInfoButton
                      label="High intent window minutes"
                      title="High intent window"
                    >
                      <BehaviorInfoContent
                        intro="This is the time window in which the high-intent event count must be reached."
                        items={[
                          [
                            "Short window",
                            "Captures intense current-session behavior.",
                          ],
                          [
                            "Long window",
                            "Captures slower browsing patterns but may be less urgent.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
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
      {confirmSubmit.modal}
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

function BehaviorInfoContent({
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
  children,
  error,
  info,
  label,
}: {
  children: ReactNode;
  error?: string;
  info?: ReactNode;
  label: string;
}) {
  return (
    <div className="counterpulse-field">
      <span className="counterpulse-field-label-row">
        <span>{label}</span>
        {info}
      </span>
      <label className="counterpulse-field-control">
        <span className="counterpulse-sr-only">{label}</span>
        {children}
      </label>
      {error && <small className="counterpulse-field-error">{error}</small>}
    </div>
  );
}

export type { BehaviorSegmentKey, BehaviorTargetingRules };
