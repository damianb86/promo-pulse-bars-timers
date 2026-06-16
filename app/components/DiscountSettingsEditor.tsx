import type { ReactNode } from "react";
import { Form, useNavigation } from "react-router";

import {
  discountModeOptions,
  discountValueTypeOptions,
  type DiscountOption,
  type DiscountSettingsErrors,
  type DiscountSettingsValues,
} from "../types/discount";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

type DiscountSettingsEditorProps = {
  apiError?: string;
  discountOptions: DiscountOption[];
  errors?: DiscountSettingsErrors;
  lockedReason?: string;
  notice?: string;
  values: DiscountSettingsValues;
};

export function DiscountSettingsEditor({
  apiError,
  discountOptions,
  errors,
  lockedReason,
  notice,
  values,
}: DiscountSettingsEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-section heading="Discount">
      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Discount sync is locked"
        />
      )}

      {apiError && (
        <s-banner tone="warning" heading="Discount API access unavailable">
          <s-paragraph>{apiError}</s-paragraph>
        </s-banner>
      )}

      {notice && (
        <s-banner tone="info" heading="Discount saved">
          <s-paragraph>{notice}</s-paragraph>
        </s-banner>
      )}

      {errors?.form && (
        <s-banner tone="critical" heading="Discount could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      {!lockedReason && (
        <Form method="post" className="counterpulse-form">
          <input name="_action" type="hidden" value="saveDiscount" />

          <div className="counterpulse-form-grid">
            <FormField label="Discount mode" error={errors?.mode}>
              <select name="mode" defaultValue={values.mode}>
                {discountModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Existing discount code or ID"
              error={errors?.existingCodeOrId}
            >
              <input
                name="existingCodeOrId"
                defaultValue={values.existingCodeOrId}
                list="counterpulse-discounts"
                placeholder="FLASH20"
              />
              <datalist id="counterpulse-discounts">
                {discountOptions.map((discount) => (
                  <option
                    key={discount.id}
                    value={discount.code || discount.id}
                    label={`${discount.title} (${discount.status})`}
                  />
                ))}
              </datalist>
            </FormField>

            <FormField label="New discount code" error={errors?.discountCode}>
              <input
                name="discountCode"
                defaultValue={values.discountCode}
                placeholder="FLASH20"
              />
            </FormField>

            <FormField label="New discount title" error={errors?.title}>
              <input
                name="title"
                defaultValue={values.title}
                placeholder="Promo Pulse campaign discount"
              />
            </FormField>

            <FormField label="Discount type" error={errors?.valueType}>
              <select name="valueType" defaultValue={values.valueType}>
                {discountValueTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Discount value" error={errors?.value}>
              <input
                name="value"
                type="number"
                min="0"
                step="0.01"
                defaultValue={values.value}
              />
            </FormField>

            <FormField label="Start date/time" error={errors?.startsAt}>
              <input
                name="startsAt"
                type="datetime-local"
                defaultValue={values.startsAt}
              />
            </FormField>

            <FormField label="End date/time" error={errors?.endsAt}>
              <input
                name="endsAt"
                type="datetime-local"
                defaultValue={values.endsAt}
              />
            </FormField>

            <FormField
              label="Free shipping minimum subtotal"
              error={errors?.minimumSubtotal}
            >
              <input
                name="minimumSubtotal"
                type="number"
                min="0"
                step="0.01"
                defaultValue={values.minimumSubtotal}
              />
            </FormField>

            <label className="counterpulse-toggle">
              <input
                name="syncStartEnd"
                type="checkbox"
                defaultChecked={values.syncStartEnd}
              />
              <span>
                Copy Shopify discount start/end dates into this campaign
              </span>
            </label>

            <label className="counterpulse-toggle">
              <input
                name="appliesOncePerCustomer"
                type="checkbox"
                defaultChecked={values.appliesOncePerCustomer}
              />
              <span>Limit created discount to one use per customer</span>
            </label>
          </div>

          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Saving..." : "Save discount"}
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
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="counterpulse-form-field">
      <span>{label}</span>
      {children}
      {error && <span className="counterpulse-form-error">{error}</span>}
    </label>
  );
}
