import type { ReactNode } from "react";
import { AppAlert, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import type {
  LowStockSettingsErrors,
  LowStockSettingsValues,
} from "../types/low-stock";

type LowStockSettingsEditorProps = {
  enabled: boolean;
  errors?: LowStockSettingsErrors;
  values: LowStockSettingsValues;
};

export function LowStockSettingsEditor({
  enabled,
  errors,
  values,
}: LowStockSettingsEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Save low stock settings",
    title: "Save low stock settings?",
    children: (
      <p>
        This changes the threshold and fallback message used for real inventory
        urgency. Promo Pulse will not invent stock quantities.
      </p>
    ),
  });

  if (!enabled) return null;

  return (
    <s-section heading="Low Stock Message">
      <p className="counterpulse-section-description">
        Configure inventory-based urgency using real Shopify inventory data and
        a fallback message when exact quantity is unavailable.
      </p>

      {errors?.form && (
        <AppAlert tone="critical" title="Low stock settings could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      <Form
        method="post"
        className="counterpulse-form"
        onSubmit={confirmSubmit.onSubmit}
      >
        <input name="_action" type="hidden" value="saveLowStockSettings" />

        <div className="counterpulse-form-grid">
          <FormField label="Inventory threshold" error={errors?.threshold}>
            <input
              name="threshold"
              type="number"
              min="1"
              step="1"
              defaultValue={values.threshold}
            />
          </FormField>

          <label className="counterpulse-toggle">
            <input
              name="showExactQuantity"
              type="checkbox"
              defaultChecked={values.showExactQuantity}
            />
            <span>Show exact quantity when Shopify exposes inventory</span>
          </label>

          <FormField
            label="Fallback message"
            error={errors?.fallbackMessage}
            fullWidth
          >
            <textarea
              name="fallbackMessage"
              defaultValue={values.fallbackMessage}
              placeholder="Low stock"
              rows={2}
            />
          </FormField>
        </div>

        <div className="counterpulse-actions">
          <button className="counterpulse-button" type="submit">
            {isSubmitting ? "Saving..." : "Save low stock settings"}
          </button>
        </div>
      </Form>
      {confirmSubmit.modal}
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
