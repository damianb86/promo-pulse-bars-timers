import type { ReactNode } from "react";
import { Form, useNavigation } from "react-router";

import {
  afterCutoffBehaviorOptions,
  type DeliveryCutoffSettingsErrors,
  type DeliveryCutoffSettingsValues,
} from "../types/delivery-cutoff";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

type DeliveryCutoffSettingsEditorProps = {
  enabled: boolean;
  errors?: DeliveryCutoffSettingsErrors;
  lockedReason?: string;
  values: DeliveryCutoffSettingsValues;
};

export function DeliveryCutoffSettingsEditor({
  enabled,
  errors,
  lockedReason,
  values,
}: DeliveryCutoffSettingsEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (!enabled) return null;

  return (
    <s-section heading="Delivery Cutoff Timer">
      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Delivery cutoff is locked"
        />
      )}

      {errors?.form && (
        <s-banner
          tone="critical"
          heading="Delivery cutoff settings could not be saved"
        >
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      {!lockedReason && (
        <Form method="post" className="counterpulse-form">
          <input
            name="_action"
            type="hidden"
            value="saveDeliveryCutoffSettings"
          />

          <div className="counterpulse-form-grid">
            <FormField label="Cutoff hour" error={errors?.cutoffHour}>
              <input
                name="cutoffHour"
                type="number"
                min="0"
                max="23"
                defaultValue={values.cutoffHour}
              />
            </FormField>

            <FormField label="Cutoff minute" error={errors?.cutoffMinute}>
              <input
                name="cutoffMinute"
                type="number"
                min="0"
                max="59"
                defaultValue={values.cutoffMinute}
              />
            </FormField>

            <FormField label="Timezone" error={errors?.timezone}>
              <input name="timezone" defaultValue={values.timezone} />
            </FormField>

            <FormField
              label="After cutoff behavior"
              error={errors?.afterCutoffBehavior}
            >
              <select
                name="afterCutoffBehavior"
                defaultValue={values.afterCutoffBehavior}
              >
                {afterCutoffBehaviorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Processing days" error={errors?.processingDays}>
              <input
                name="processingDays"
                type="number"
                min="0"
                defaultValue={values.processingDays}
              />
            </FormField>

            <FormField
              label="Minimum delivery days"
              error={errors?.minDeliveryDays}
            >
              <input
                name="minDeliveryDays"
                type="number"
                min="0"
                defaultValue={values.minDeliveryDays}
              />
            </FormField>

            <FormField
              label="Maximum delivery days"
              error={errors?.maxDeliveryDays}
            >
              <input
                name="maxDeliveryDays"
                type="number"
                min="0"
                defaultValue={values.maxDeliveryDays}
              />
            </FormField>

            <FormField
              label="Working days JSON"
              error={errors?.workingDaysJson}
              fullWidth
            >
              <textarea
                name="workingDaysJson"
                defaultValue={values.workingDaysJson}
                rows={3}
              />
            </FormField>

            <FormField
              label="Holidays JSON"
              error={errors?.holidaysJson}
              fullWidth
            >
              <textarea
                name="holidaysJson"
                defaultValue={values.holidaysJson}
                placeholder='["2026-12-25"]'
                rows={3}
              />
            </FormField>

            <FormField
              label="Country rules JSON"
              error={errors?.countryRulesJson}
              fullWidth
            >
              <textarea
                name="countryRulesJson"
                defaultValue={values.countryRulesJson}
                placeholder='{"countries":{"US":{"cutoffHour":14}}}'
                rows={4}
              />
            </FormField>
          </div>

          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Saving..." : "Save delivery cutoff settings"}
            </button>
          </div>
        </Form>
      )}
    </s-section>
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
