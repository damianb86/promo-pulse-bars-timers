import type { ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import type {
  FreeShippingSettingsErrors,
  FreeShippingSettingsValues,
} from "../types/free-shipping";

type FreeShippingSettingsEditorProps = {
  enabled: boolean;
  errors?: FreeShippingSettingsErrors;
  values: FreeShippingSettingsValues;
};

export function FreeShippingSettingsEditor({
  enabled,
  errors,
  values,
}: FreeShippingSettingsEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Save free shipping settings",
    title: "Save free shipping settings?",
    children: (
      <p>
        This changes the cart threshold and progress copy shown to eligible
        shoppers for this campaign.
      </p>
    ),
  });

  if (!enabled) return null;

  return (
    <s-section heading="Free Shipping Goal">
      <p className="counterpulse-section-description">
        Configure the real free-shipping threshold, currency, and fallback
        messages used by cart placements. Progress presentation is controlled in
        Campaign Setup and Design.
      </p>

      {errors?.form && (
        <AppAlert
          tone="critical"
          title="Free shipping settings could not be saved"
        >
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      <Form
        method="post"
        className="counterpulse-form"
        onSubmit={confirmSubmit.onSubmit}
      >
        <input name="_action" type="hidden" value="saveFreeShippingSettings" />

        <div className="counterpulse-form-grid">
          <FormField
            label="Threshold amount"
            error={errors?.thresholdAmount}
            info={
              <FieldInfoButton
                label="Free shipping threshold amount"
                title="Free shipping threshold"
              >
                <FreeShippingInfoContent
                  intro="Threshold amount is the real cart subtotal shoppers must reach before the campaign says free shipping is unlocked."
                  items={[
                    [
                      "Real offer",
                      "Only use a value that matches the merchant's actual shipping rules.",
                    ],
                    [
                      "Market overrides",
                      "Use market rules when the threshold differs by country or currency.",
                    ],
                  ]}
                />
              </FieldInfoButton>
            }
          >
            <input
              name="thresholdAmount"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={values.thresholdAmount}
            />
          </FormField>

          <FormField label="Currency code" error={errors?.currencyCode}>
            <input
              name="currencyCode"
              defaultValue={values.currencyCode}
              maxLength={3}
            />
          </FormField>
          <input
            name="progressStyle"
            type="hidden"
            defaultValue={values.progressStyle}
          />

          <div className="counterpulse-toggle">
            <label className="counterpulse-toggle-label">
              <input
                name="includeDiscountedSubtotal"
                type="checkbox"
                defaultChecked={values.includeDiscountedSubtotal}
              />
              <span>Use discounted subtotal when available</span>
            </label>
            <FieldInfoButton
              label="Use discounted subtotal"
              title="Discounted subtotal"
            >
              <FreeShippingInfoContent
                intro="This controls whether progress should use the subtotal after discounts when that value is available."
                items={[
                  [
                    "Enabled",
                    "The free-shipping goal is stricter and reflects the effective cart subtotal.",
                  ],
                  [
                    "Disabled",
                    "The goal uses the pre-discount subtotal, which may unlock sooner.",
                  ],
                ]}
              />
            </FieldInfoButton>
          </div>

          <FormField
            label="Empty cart fallback message"
            error={errors?.emptyCartMessage}
            fullWidth
          >
            <textarea
              name="emptyCartMessage"
              defaultValue={values.emptyCartMessage}
              rows={2}
            />
          </FormField>

          <FormField
            label="Success fallback message"
            error={errors?.successMessage}
            fullWidth
          >
            <textarea
              name="successMessage"
              defaultValue={values.successMessage}
              rows={2}
            />
          </FormField>

          <FormField
            label="Country/market threshold JSON"
            error={errors?.thresholdRulesJson}
            fullWidth
            info={
              <FieldInfoButton
                label="Country/market threshold JSON"
                title="Country and market thresholds"
              >
                <FreeShippingInfoContent
                  intro="Use this advanced field only when thresholds differ by country or market and the Markets panel is not enough."
                  items={[
                    [
                      "Country format",
                      '{"countries":{"US":75,"CA":100}} maps country codes to threshold amounts.',
                    ],
                    [
                      "Market format",
                      '{"markets":{"EU":80}} maps market identifiers to threshold amounts.',
                    ],
                    [
                      "Fallback",
                      "If no rule matches, Promo Pulse uses the global threshold amount.",
                    ],
                  ]}
                />
              </FieldInfoButton>
            }
          >
            <textarea
              name="thresholdRulesJson"
              defaultValue={values.thresholdRulesJson}
              placeholder='{"countries":{"US":75,"CA":100},"markets":{"EU":80}}'
              rows={4}
            />
          </FormField>
        </div>

        <div className="counterpulse-actions">
          <button className="counterpulse-button" type="submit">
            {isSubmitting ? "Saving..." : "Save free shipping settings"}
          </button>
        </div>
      </Form>
      {confirmSubmit.modal}
    </s-section>
  );
}

function FreeShippingInfoContent({
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
