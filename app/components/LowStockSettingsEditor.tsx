import type { ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
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
          <FormField
            label="Inventory threshold"
            error={errors?.threshold}
            info={
              <FieldInfoButton
                label="Inventory threshold"
                title="Low stock threshold"
              >
                <LowStockInfoContent
                  intro="Inventory threshold is the real quantity where low-stock messaging becomes eligible."
                  items={[
                    [
                      "Real inventory",
                      "Promo Pulse should only show exact urgency when Shopify exposes actual inventory.",
                    ],
                    [
                      "Threshold",
                      "A value of 5 means the message can show when available quantity is 5 or lower.",
                    ],
                  ]}
                />
              </FieldInfoButton>
            }
          >
            <input
              name="threshold"
              type="number"
              min="1"
              step="1"
              defaultValue={values.threshold}
            />
          </FormField>

          <div className="counterpulse-toggle">
            <label className="counterpulse-toggle-label">
              <input
                name="showExactQuantity"
                type="checkbox"
                defaultChecked={values.showExactQuantity}
              />
              <span>Show exact quantity when Shopify exposes inventory</span>
            </label>
            <FieldInfoButton
              label="Show exact quantity"
              title="Exact inventory quantity"
            >
              <LowStockInfoContent
                intro="Exact quantity messaging can be useful, but it must only use real inventory values."
                items={[
                  [
                    "Enabled",
                    "Shows the quantity only when Shopify inventory data is available.",
                  ],
                  [
                    "Unavailable inventory",
                    "Promo Pulse falls back to the fallback message instead of inventing a number.",
                  ],
                ]}
              />
            </FieldInfoButton>
          </div>

          <FormField
            label="Fallback message"
            error={errors?.fallbackMessage}
            fullWidth
            info={
              <FieldInfoButton
                label="Low stock fallback message"
                title="Fallback low-stock copy"
              >
                <LowStockInfoContent
                  intro="Fallback copy appears when the campaign can show urgency but exact inventory is not available."
                  items={[
                    [
                      "Keep it factual",
                      "Use text such as Low stock instead of made-up quantities.",
                    ],
                    [
                      "Theme preview",
                      "Verify it fits in product-page and product-card placements.",
                    ],
                  ]}
                />
              </FieldInfoButton>
            }
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

function LowStockInfoContent({
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
