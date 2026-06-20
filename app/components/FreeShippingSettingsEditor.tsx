import type { ReactNode } from "react";
import { AppAlert } from "./Notifications";
import { Form, useNavigation } from "react-router";

import {
  freeShippingProgressStyleOptions,
  type FreeShippingSettingsErrors,
  type FreeShippingSettingsValues,
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

  if (!enabled) return null;

  return (
    <s-section heading="Free Shipping Goal">
      {errors?.form && (
        <AppAlert
          tone="critical"
          title="Free shipping settings could not be saved"
        >
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      <Form method="post" className="counterpulse-form">
        <input name="_action" type="hidden" value="saveFreeShippingSettings" />

        <div className="counterpulse-form-grid">
          <FormField label="Threshold amount" error={errors?.thresholdAmount}>
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

          <FormField label="Progress style" error={errors?.progressStyle}>
            <select name="progressStyle" defaultValue={values.progressStyle}>
              {freeShippingProgressStyleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <label className="counterpulse-toggle">
            <input
              name="includeDiscountedSubtotal"
              type="checkbox"
              defaultChecked={values.includeDiscountedSubtotal}
            />
            <span>Use discounted subtotal when available</span>
          </label>

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
