import type { ReactNode } from "react";
import { AppAlert } from "./Notifications";
import { Form, useNavigation } from "react-router";

import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

export type AdvancedDiscountRuleRow = {
  id: string;
  title: string;
  ruleType: string;
  status: string;
  thresholdsJson: string;
  productIds: string;
  collectionIds: string;
  discountValue: string;
  shippingDiscountValue: string;
  startsAt: string;
  endsAt: string;
  shopifyDiscountId: string;
};

export type AdvancedDiscountRuleErrors = {
  form?: string;
  thresholdsJson?: string;
  discountValue?: string;
  shippingDiscountValue?: string;
};

type AdvancedDiscountRulesEditorProps = {
  errors?: AdvancedDiscountRuleErrors;
  lockedReason?: string;
  notice?: string;
  rules: AdvancedDiscountRuleRow[];
};

const ruleTypeOptions = [
  { label: "Spend X get Y", value: "SPEND_X_GET_Y" },
  { label: "Tiered discount", value: "TIERED_DISCOUNT" },
  { label: "Free gift", value: "FREE_GIFT" },
  { label: "Product + shipping combo", value: "PRODUCT_SHIPPING_COMBO" },
  { label: "Cart contents", value: "CART_CONTENTS" },
];

const statusOptions = [
  { label: "Draft", value: "DRAFT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Paused", value: "PAUSED" },
];

const defaultThresholdsJson = JSON.stringify(
  [{ minimumSubtotal: 100, discountValue: 15 }],
  null,
  2,
);

export function AdvancedDiscountRulesEditor({
  errors,
  lockedReason,
  notice,
  rules,
}: AdvancedDiscountRulesEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-section heading="Advanced Discount Rules">
      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Advanced discounts are locked"
        />
      )}

      {notice && (
        <AppAlert tone="info" title="Advanced discount updated">
          <s-paragraph>{notice}</s-paragraph>
        </AppAlert>
      )}

      {errors?.form && (
        <AppAlert tone="critical" title="Advanced discount could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {!lockedReason && (
        <Form method="post" className="counterpulse-form">
          <input
            name="_action"
            type="hidden"
            value="saveAdvancedDiscountRule"
          />

          <div className="counterpulse-form-grid">
            <FormField label="Rule title">
              <input
                name="title"
                defaultValue="Promo Pulse advanced discount"
                required
              />
            </FormField>

            <FormField label="Rule type">
              <select name="ruleType" defaultValue="TIERED_DISCOUNT">
                {ruleTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Status">
              <select name="ruleStatus" defaultValue="DRAFT">
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Discount value (%)" error={errors?.discountValue}>
              <input
                name="discountValue"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue="10"
              />
            </FormField>

            <FormField
              label="Shipping discount (%)"
              error={errors?.shippingDiscountValue}
            >
              <input
                name="shippingDiscountValue"
                type="number"
                min="0"
                max="100"
                step="0.01"
              />
            </FormField>

            <FormField label="Start date/time">
              <input name="startsAt" type="datetime-local" />
            </FormField>

            <FormField label="End date/time">
              <input name="endsAt" type="datetime-local" />
            </FormField>
          </div>

          <div className="counterpulse-form-grid">
            <FormField label="Product or variant IDs">
              <textarea
                name="productIds"
                rows={4}
                placeholder="gid://shopify/Product/123"
              />
            </FormField>

            <FormField label="Collection IDs">
              <textarea
                name="collectionIds"
                rows={4}
                placeholder="gid://shopify/Collection/123"
              />
            </FormField>

            <FormField label="Thresholds JSON" error={errors?.thresholdsJson}>
              <textarea
                name="thresholdsJson"
                rows={4}
                defaultValue={defaultThresholdsJson}
              />
            </FormField>
          </div>

          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Saving..." : "Save advanced rule"}
            </button>
          </div>
        </Form>
      )}

      <s-box paddingBlockStart="base">
        <table className="counterpulse-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Discount</th>
              <th>Shipping</th>
              <th>Remote discount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.length > 0 ? (
              rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.title}</td>
                  <td>{formatEnum(rule.ruleType)}</td>
                  <td>{formatEnum(rule.status)}</td>
                  <td>{rule.discountValue || "-"}</td>
                  <td>{rule.shippingDiscountValue || "-"}</td>
                  <td>{rule.shopifyDiscountId || "-"}</td>
                  <td>
                    {!lockedReason && (
                      <Form method="post">
                        <input
                          name="_action"
                          type="hidden"
                          value="deleteAdvancedDiscountRule"
                        />
                        <input name="ruleId" type="hidden" value={rule.id} />
                        <button className="counterpulse-button" type="submit">
                          Delete
                        </button>
                      </Form>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>No advanced discount rules created yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </s-box>
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

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
