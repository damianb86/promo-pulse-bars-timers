import type { ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import {
  afterCutoffBehaviorOptions,
  type DeliveryCutoffSettingsErrors,
  type DeliveryCutoffSettingsValues,
} from "../types/delivery-cutoff";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";
import { TimezoneCombobox } from "./TimezoneCombobox";

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
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Save delivery cutoff settings",
    title: "Save delivery cutoff settings?",
    children: (
      <p>
        This can change checkout and storefront delivery timing messages. Make
        sure the cutoff and timezone match your fulfillment promise.
      </p>
    ),
  });

  if (!enabled) return null;

  return (
    <s-section heading="Delivery Cutoff Timer">
      <p className="counterpulse-section-description">
        Configure the real cutoff time used for delivery urgency messages and
        post-cutoff behavior.
      </p>

      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Delivery cutoff is locked"
        />
      )}

      {errors?.form && (
        <AppAlert
          tone="critical"
          title="Delivery cutoff settings could not be saved"
        >
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {!lockedReason && (
        <Form
          method="post"
          className="counterpulse-form"
          onSubmit={confirmSubmit.onSubmit}
        >
          <input
            name="_action"
            type="hidden"
            value="saveDeliveryCutoffSettings"
          />

          <div className="counterpulse-form-grid">
            <FormField
              label="Cutoff hour"
              error={errors?.cutoffHour}
              info={
                <FieldInfoButton
                  label="Delivery cutoff hour"
                  title="Delivery cutoff time"
                >
                  <DeliveryInfoContent
                    intro="Cutoff hour and minute define the real order-by time shown to shoppers."
                    items={[
                      [
                        "Hour format",
                        "Use 0 through 23 based on the selected timezone.",
                      ],
                      [
                        "Real promise",
                        "Only use a cutoff that matches fulfillment operations.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
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

            <TimezoneCombobox
              defaultValue={values.timezone}
              error={errors?.timezone}
              info={
                <FieldInfoButton
                  label="Delivery timezone"
                  title="Delivery timezone"
                >
                  <DeliveryInfoContent
                    intro="Timezone determines when the cutoff is considered reached."
                    items={[
                      [
                        "Fulfillment timezone",
                        "Choose the timezone used by the warehouse or delivery promise.",
                      ],
                      [
                        "Markets",
                        "Use market rules if cutoffs differ by country or currency context.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
              label="Timezone"
              name="timezone"
            />

            <FormField
              label="After cutoff behavior"
              error={errors?.afterCutoffBehavior}
              info={
                <FieldInfoButton
                  label="After cutoff behavior"
                  title="After cutoff behavior"
                >
                  <DeliveryInfoContent
                    intro="This controls what shoppers see after the order-by deadline has passed."
                    items={[
                      [
                        "Hide",
                        "Use when the message should disappear after the promise is no longer true.",
                      ],
                      [
                        "Show after-cutoff message",
                        "Use when you have accurate next-day or next-window copy.",
                      ],
                      [
                        "Roll forward",
                        "Use only when the next cutoff can be computed accurately.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
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
              info={
                <FieldInfoButton label="Working days JSON" title="Working days">
                  <DeliveryInfoContent
                    intro="Working days define which weekdays count when delivery promises are calculated."
                    items={[
                      [
                        "Format",
                        "[1,2,3,4,5] represents Monday through Friday.",
                      ],
                      [
                        "Weekend operations",
                        "Include 6 or 0 only if Saturday or Sunday fulfillment is real.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
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
              info={
                <FieldInfoButton label="Holidays JSON" title="Holidays">
                  <DeliveryInfoContent
                    intro="Holidays remove specific calendar dates from delivery promise calculations."
                    items={[
                      [
                        "Format",
                        'Use an array of ISO dates such as ["2026-12-25"].',
                      ],
                      [
                        "Market differences",
                        "If holidays differ by country, use country rules or market overrides.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
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
              info={
                <FieldInfoButton
                  label="Country rules JSON"
                  title="Country delivery rules"
                >
                  <DeliveryInfoContent
                    intro="Country rules override delivery cutoff settings for specific countries."
                    items={[
                      [
                        "Format",
                        '{"countries":{"US":{"cutoffHour":14}}} changes the cutoff for US traffic.',
                      ],
                      [
                        "Fallback",
                        "Countries without a rule use the global cutoff settings.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
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
      {confirmSubmit.modal}
    </s-section>
  );
}

function DeliveryInfoContent({
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
  label,
  error,
  children,
  info,
  fullWidth = false,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  info?: ReactNode;
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
      <span className="counterpulse-field-label-row">
        <span>{label}</span>
        {info}
      </span>
      <label className="counterpulse-field-control">
        <span className="counterpulse-sr-only">{label}</span>
        {children}
      </label>
      {error && <span className="counterpulse-form-error">{error}</span>}
    </div>
  );
}
