import { useState, type ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import {
  behaviorSegmentOptions,
  behaviorTargetingBounds,
  type BehaviorSegmentKey,
  type BehaviorTargetingRules,
} from "../types/behavior-targeting";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

export type BehaviorTargetingErrors = {
  form?: string;
  lookbackDays?: string;
  returningMinPriorSessions?: string;
  returningMinDaysSinceFirstSeen?: string;
  viewedProductMinViews?: string;
  viewedProductDelayMinutes?: string;
  addedToCartDelayMinutes?: string;
  checkoutStartedDelayMinutes?: string;
  inactiveCartMinutes?: string;
  highIntentMinEvents?: string;
  highIntentWindowMinutes?: string;
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
  const [selectedSegments, setSelectedSegments] = useState<
    Set<BehaviorSegmentKey>
  >(() => new Set(values.segments));
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

  const toggleSegment = (key: BehaviorSegmentKey, checked: boolean) => {
    setSelectedSegments((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }

      return next;
    });
  };

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
                    min={behaviorTargetingBounds.lookbackDays.min}
                    max={behaviorTargetingBounds.lookbackDays.max}
                    step="1"
                    defaultValue={values.lookbackDays}
                  />
                  <small className="counterpulse-field-hint">
                    Applies to every behavior segment in this campaign.
                  </small>
                </FormField>
              </div>
            </div>

            {behaviorGroups.map((group) => (
              <div className="counterpulse-config-card" key={group.title}>
                <PanelHeader
                  eyebrow="Segments"
                  title={group.title}
                  description="Choose one or more visitor conditions, then fine-tune each one."
                />
                <div className="counterpulse-choice-list">
                  {group.keys.map((key) => {
                    const option = behaviorSegmentOptions.find(
                      (item) => item.key === key,
                    );

                    if (!option) return null;

                    const inputId = `behavior-segment-${option.key}`;
                    const isChecked = selectedSegments.has(option.key);

                    return (
                      <div
                        className="counterpulse-choice-card counterpulse-choice-card--expandable"
                        key={key}
                      >
                        <input
                          id={inputId}
                          name="behaviorSegments"
                          type="checkbox"
                          value={option.key}
                          checked={isChecked}
                          onChange={(event) =>
                            toggleSegment(option.key, event.target.checked)
                          }
                        />
                        <label htmlFor={inputId}>
                          <strong>{option.label}</strong>
                          <small>
                            {behaviorSegmentDescriptions[option.key]}
                          </small>
                        </label>
                        {isChecked && (
                          <SegmentPanel
                            segment={option.key}
                            values={values}
                            errors={errors}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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

function SegmentPanel({
  segment,
  values,
  errors,
}: {
  segment: BehaviorSegmentKey;
  values: BehaviorTargetingRules;
  errors?: BehaviorTargetingErrors;
}) {
  const fields = renderSegmentFields(segment, values, errors);

  if (!fields) return null;

  return <div className="counterpulse-choice-card__panel">{fields}</div>;
}

function renderSegmentFields(
  segment: BehaviorSegmentKey,
  values: BehaviorTargetingRules,
  errors?: BehaviorTargetingErrors,
): ReactNode {
  switch (segment) {
    case "NEW_VISITOR":
      // A new visitor is defined purely by the absence of prior history, so
      // there is nothing further to configure.
      return null;
    case "RETURNING_VISITOR":
      return (
        <div className="counterpulse-subfield-grid">
          <NumberSubField
            name="behaviorReturningMinPriorSessions"
            label="Minimum prior sessions"
            bound={behaviorTargetingBounds.returningMinPriorSessions}
            value={values.returningMinPriorSessions}
            error={errors?.returningMinPriorSessions}
            hint="How many distinct earlier sessions qualify a visitor as returning."
            info={{
              title: "What counts as returning",
              intro:
                "A returning visitor must have at least this many sessions before the current one.",
              items: [
                ["1", "Seen in at least one earlier session (default)."],
                [
                  "Higher",
                  "Target loyal repeat visitors by requiring more prior sessions.",
                ],
              ],
            }}
          />
          <NumberSubField
            name="behaviorReturningMinDaysSinceFirstSeen"
            label="Minimum days since first seen"
            bound={behaviorTargetingBounds.returningMinDaysSinceFirstSeen}
            value={values.returningMinDaysSinceFirstSeen}
            error={errors?.returningMinDaysSinceFirstSeen}
            hint="0 = ignore. Otherwise the visitor must have first been seen at least this many days ago."
            info={{
              title: "Returning maturity",
              intro:
                "Use this to exclude visitors who only started browsing very recently.",
              items: [
                ["0", "No minimum age requirement."],
                ["7", "Only visitors first seen a week or more ago."],
              ],
            }}
          />
        </div>
      );
    case "VIEWED_PRODUCT_NO_ADD_TO_CART":
      return (
        <div className="counterpulse-subfield-grid">
          <NumberSubField
            name="behaviorViewedProductMinViews"
            label="Minimum product views"
            bound={behaviorTargetingBounds.viewedProductMinViews}
            value={values.viewedProductMinViews}
            error={errors?.viewedProductMinViews}
            hint="Require at least this many product views before targeting."
            info={{
              title: "Browsing depth",
              intro:
                "Higher values focus on shoppers who browsed several products without adding to cart.",
              items: [
                ["1", "Any product detail view (default)."],
                ["3+", "Engaged browsers comparing multiple products."],
              ],
            }}
          />
          <NumberSubField
            name="behaviorViewedProductDelayMinutes"
            label="Wait after last view (minutes)"
            bound={behaviorTargetingBounds.viewedProductDelayMinutes}
            value={values.viewedProductDelayMinutes}
            error={errors?.viewedProductDelayMinutes}
            hint="0 = immediately. Otherwise wait this long after the last product view."
            info={{
              title: "View delay",
              intro:
                "Delays the offer so it does not appear the instant a product is viewed.",
              items: [
                ["0", "Eligible as soon as the view condition is met."],
                ["10", "Give the shopper ten minutes before nudging them."],
              ],
            }}
          />
        </div>
      );
    case "ADDED_TO_CART_NO_CHECKOUT":
      return (
        <NumberSubField
          name="behaviorAddedToCartDelayMinutes"
          label="Wait after add to cart (minutes)"
          bound={behaviorTargetingBounds.addedToCartDelayMinutes}
          value={values.addedToCartDelayMinutes}
          error={errors?.addedToCartDelayMinutes}
          hint="0 = immediately. Otherwise wait this many minutes after the last add-to-cart before showing the offer."
          info={{
            title: "Add-to-cart delay",
            intro:
              "How long to wait after a shopper adds an item before treating them as needing a nudge to checkout.",
            items: [
              ["0", "Eligible right after adding to cart."],
              [
                "Example",
                "15 waits a quarter hour, so shoppers mid-flow are not interrupted.",
              ],
            ],
          }}
        />
      );
    case "CHECKOUT_STARTED":
      return (
        <div className="counterpulse-subfield-grid">
          <NumberSubField
            name="behaviorCheckoutStartedDelayMinutes"
            label="Wait after checkout start (minutes)"
            bound={behaviorTargetingBounds.checkoutStartedDelayMinutes}
            value={values.checkoutStartedDelayMinutes}
            error={errors?.checkoutStartedDelayMinutes}
            hint="0 = immediately. Otherwise wait this long after checkout started."
            info={{
              title: "Checkout delay",
              intro:
                "Delays eligibility so the offer appears only after the shopper has been in checkout for a while.",
              items: [
                ["0", "Eligible as soon as checkout starts."],
                ["20", "Target shoppers who stalled in checkout."],
              ],
            }}
          />
          <BooleanSubField
            name="behaviorCheckoutStartedExcludePurchasers"
            label="Exclude shoppers who already purchased"
            checked={values.checkoutStartedExcludePurchasers}
            hint="Skip visitors who placed an order after starting checkout."
          />
        </div>
      );
    case "INACTIVE_CART":
      return (
        <NumberSubField
          name="behaviorInactiveCartMinutes"
          label="Inactive cart minutes"
          bound={behaviorTargetingBounds.inactiveCartMinutes}
          value={values.inactiveCartMinutes}
          error={errors?.inactiveCartMinutes}
          hint="A cart with no progress for this many minutes is considered stale."
          info={{
            title: "Inactive cart window",
            intro:
              "Defines when a cart is considered stale enough to target.",
            items: [
              [
                "Example",
                "60 matches a visitor with cart activity and no recent progress after one hour.",
              ],
              [
                "Avoid pressure",
                "Use conservative windows so the campaign does not appear immediately after a normal cart action.",
              ],
            ],
          }}
        />
      );
    case "SAW_CAMPAIGN":
      return (
        <ListSubField
          name="behaviorSawCampaignIds"
          label="Campaign IDs the visitor saw"
          value={values.sawCampaignIds}
          hint="One campaign ID per line. Leave blank to match any previously seen campaign."
          info={{
            title: "Saw campaign X",
            intro:
              "Match visitors who saw an impression of one of these specific campaigns.",
            items: [
              ["Specific", "List the campaign IDs this offer should react to."],
              ["Blank", "Match a visitor who saw any campaign."],
            ],
          }}
        />
      );
    case "CLICKED_CAMPAIGN":
      return (
        <ListSubField
          name="behaviorClickedCampaignIds"
          label="Campaign IDs the visitor clicked"
          value={values.clickedCampaignIds}
          hint="One campaign ID per line. Leave blank to match any previously clicked campaign."
          info={{
            title: "Clicked campaign X",
            intro:
              "Match visitors who clicked one of these specific campaigns.",
            items: [
              ["Specific", "List the campaign IDs this offer should react to."],
              ["Blank", "Match a visitor who clicked any campaign."],
            ],
          }}
        />
      );
    case "USED_UNIQUE_CODE":
      return (
        <BooleanSubField
          name="behaviorUsedUniqueCodeIncludeAssigned"
          label="Also match assigned (not yet used) codes"
          checked={values.usedUniqueCodeIncludeAssigned}
          hint="By default only redeemed codes match. Enable to also include codes that were assigned but not used yet."
        />
      );
    case "HIGH_INTENT":
      return (
        <div className="counterpulse-subfield-grid">
          <NumberSubField
            name="behaviorHighIntentMinEvents"
            label="High intent event count"
            bound={behaviorTargetingBounds.highIntentMinEvents}
            value={values.highIntentMinEvents}
            error={errors?.highIntentMinEvents}
            hint="Minimum qualifying events inside the window below."
            info={{
              title: "High intent",
              intro:
                "Based on a minimum number of qualifying events inside the configured window.",
              items: [
                [
                  "Signals",
                  "Product views, campaign clicks, add-to-cart, and checkout events can contribute.",
                ],
                [
                  "Threshold",
                  "Higher values target fewer visitors but indicate stronger intent.",
                ],
              ],
            }}
          />
          <NumberSubField
            name="behaviorHighIntentWindowMinutes"
            label="High intent window (minutes)"
            bound={behaviorTargetingBounds.highIntentWindowMinutes}
            value={values.highIntentWindowMinutes}
            error={errors?.highIntentWindowMinutes}
            hint="Time window in which the event count must be reached."
            info={{
              title: "High intent window",
              intro:
                "The time window in which the high-intent event count must be reached.",
              items: [
                ["Short window", "Captures intense current-session behavior."],
                ["Long window", "Captures slower browsing patterns."],
              ],
            }}
          />
        </div>
      );
    default:
      return null;
  }
}

function NumberSubField({
  name,
  label,
  bound,
  value,
  error,
  hint,
  info,
}: {
  name: string;
  label: string;
  bound: { min: number; max: number };
  value: number;
  error?: string;
  hint?: string;
  info: { title: string; intro: string; items: Array<[string, string]> };
}) {
  return (
    <FormField
      label={label}
      error={error}
      info={
        <FieldInfoButton label={label} title={info.title}>
          <BehaviorInfoContent intro={info.intro} items={info.items} />
        </FieldInfoButton>
      }
    >
      <input
        name={name}
        type="number"
        min={bound.min}
        max={bound.max}
        step="1"
        defaultValue={value}
      />
      {hint && <small className="counterpulse-field-hint">{hint}</small>}
    </FormField>
  );
}

function BooleanSubField({
  name,
  label,
  checked,
  hint,
}: {
  name: string;
  label: string;
  checked: boolean;
  hint?: string;
}) {
  return (
    <div className="counterpulse-toggle counterpulse-toggle--inline">
      <label className="counterpulse-toggle-label">
        <input name={name} type="checkbox" defaultChecked={checked} />
        <span>{label}</span>
      </label>
      {hint && <small className="counterpulse-field-hint">{hint}</small>}
    </div>
  );
}

function ListSubField({
  name,
  label,
  value,
  hint,
  info,
}: {
  name: string;
  label: string;
  value: string[];
  hint?: string;
  info: { title: string; intro: string; items: Array<[string, string]> };
}) {
  return (
    <FormField
      label={label}
      info={
        <FieldInfoButton label={label} title={info.title}>
          <BehaviorInfoContent intro={info.intro} items={info.items} />
        </FieldInfoButton>
      }
    >
      <textarea
        name={name}
        rows={3}
        defaultValue={value.join("\n")}
        placeholder={"campaign-id-1\ncampaign-id-2"}
      />
      {hint && <small className="counterpulse-field-hint">{hint}</small>}
    </FormField>
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
