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

          <label className="counterpulse-toggle">
            <input
              name="behaviorEnabled"
              type="checkbox"
              defaultChecked={values.enabled}
            />
            <span>Enable behavior targeting</span>
          </label>

          <div className="counterpulse-option-grid">
            {behaviorSegmentOptions.map((option) => (
              <label className="counterpulse-choice" key={option.key}>
                <input
                  name="behaviorSegments"
                  type="checkbox"
                  value={option.key}
                  defaultChecked={selectedSegments.has(option.key)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <div className="counterpulse-form-grid">
            <FormField label="Campaign IDs for X rules">
              <textarea
                name="behaviorCampaignIds"
                rows={3}
                defaultValue={values.campaignIds.join("\n")}
                placeholder={"campaign-id-1\ncampaign-id-2"}
              />
            </FormField>

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
