import type { ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
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
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Save discount",
    title: "Save discount settings?",
    children: (
      <p>
        This can create or link a real Shopify discount and can change how
        visitors redeem the campaign offer.
      </p>
    ),
  });

  return (
    <s-section heading="Discount">
      <p className="counterpulse-section-description">
        Choose whether this campaign links to an existing discount, creates a
        Shopify discount, or prepares unique visitor codes.
      </p>

      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Discount sync is locked"
        />
      )}

      {apiError && (
        <AppAlert tone="warning" title="Discount API access unavailable">
          <s-paragraph>{apiError}</s-paragraph>
        </AppAlert>
      )}

      {notice && (
        <AppAlert tone="info" title="Discount saved">
          <s-paragraph>{notice}</s-paragraph>
        </AppAlert>
      )}

      {errors?.form && (
        <AppAlert tone="critical" title="Discount could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {!lockedReason && (
        <Form
          method="post"
          className="counterpulse-form"
          onSubmit={confirmSubmit.onSubmit}
        >
          <input name="_action" type="hidden" value="saveDiscount" />

          <div className="counterpulse-form-grid">
            <FormField
              label="Discount mode"
              error={errors?.mode}
              info={
                <FieldInfoButton label="Discount mode" title="Discount modes">
                  <DiscountInfoContent
                    intro="Discount mode decides whether Promo Pulse only displays a discount, links to an existing Shopify code, creates a new code, or prepares unique visitor codes."
                    items={[
                      [
                        "No discount",
                        "The campaign shows copy, timer, or merchandising only. No code is promised.",
                      ],
                      [
                        "Link existing discount",
                        "Use a discount code or ID that already exists in Shopify. Promo Pulse references it but does not create a new one.",
                      ],
                      [
                        "Create new discount",
                        "Promo Pulse creates a basic Shopify code discount when the app has discount scopes.",
                      ],
                      [
                        "Unique code per visitor",
                        "Each visitor receives a visitor-scoped code from a generated pool. Requires premium gating and code pool setup.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
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
              info={
                <FieldInfoButton
                  label="Existing discount code or ID"
                  title="Existing Shopify discount"
                >
                  <DiscountInfoContent
                    intro="Use this when the merchant already created the discount in Shopify."
                    items={[
                      [
                        "Code",
                        "Enter a public code such as FLASH20 when shoppers need to copy or apply it.",
                      ],
                      [
                        "Shopify ID",
                        "Use a discount ID when syncing metadata from Shopify Admin API.",
                      ],
                      [
                        "No fake discount",
                        "If this value does not match a real discount, Promo Pulse should not imply the offer is active.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
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

            <FormField
              label="New discount code"
              error={errors?.discountCode}
              info={
                <FieldInfoButton
                  label="New discount code"
                  title="New Shopify discount code"
                >
                  <DiscountInfoContent
                    intro="Use this when Promo Pulse should create or prepare a new Shopify discount code."
                    items={[
                      [
                        "Public code",
                        "This is what shoppers copy or apply, such as FLASH20.",
                      ],
                      [
                        "Uniqueness",
                        "Shopify requires active discount codes to be unique enough for the shop.",
                      ],
                      [
                        "Unique codes",
                        "Leave this blank when using a generated unique-code pool instead.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
              <input
                name="discountCode"
                defaultValue={values.discountCode}
                placeholder="FLASH20"
              />
            </FormField>

            <FormField
              label="Unique code prefix"
              error={errors?.uniqueCodePrefix}
              info={
                <FieldInfoButton
                  label="Unique code prefix"
                  title="Unique code prefix"
                >
                  <DiscountInfoContent
                    intro="Prefix identifies visitor-specific codes generated for this campaign."
                    items={[
                      ["Example", "VIP generates codes like VIP-A1B2C3D4E5."],
                      [
                        "Privacy",
                        "Do not include names, emails, or personal data in prefixes.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
              <input
                name="uniqueCodePrefix"
                defaultValue={values.uniqueCodePrefix}
                placeholder="VIP"
              />
            </FormField>

            <FormField label="New discount title" error={errors?.title}>
              <input
                name="title"
                defaultValue={values.title}
                placeholder="Promo Pulse campaign discount"
              />
            </FormField>

            <FormField
              label="Discount type"
              error={errors?.valueType}
              info={
                <FieldInfoButton label="Discount type" title="Discount type">
                  <DiscountInfoContent
                    intro="Discount type changes how the value field is interpreted when Promo Pulse creates or generates codes."
                    items={[
                      [
                        "Percentage",
                        "Value is a percentage off, for example 15 means 15% off.",
                      ],
                      [
                        "Fixed amount",
                        "Value is a currency amount off. Make sure currency and Shopify discount setup match.",
                      ],
                      [
                        "Free shipping",
                        "Creates or represents a shipping discount. Value may be ignored depending on Shopify capability.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
              <select name="valueType" defaultValue={values.valueType}>
                {discountValueTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Discount value"
              error={errors?.value}
              info={
                <FieldInfoButton label="Discount value" title="Discount value">
                  <DiscountInfoContent
                    intro="Discount value is interpreted according to the selected discount type."
                    items={[
                      ["Percentage", "15 means 15% off."],
                      [
                        "Fixed amount",
                        "15 means 15 units of the configured currency off.",
                      ],
                      [
                        "Free shipping",
                        "The value can be ignored depending on Shopify discount support.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
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
              info={
                <FieldInfoButton
                  label="Free shipping minimum subtotal"
                  title="Free shipping minimum"
                >
                  <DiscountInfoContent
                    intro="This is the minimum cart subtotal required by a created free-shipping discount."
                    items={[
                      [
                        "Real threshold",
                        "Use the same threshold shown by the campaign if the widget promises free shipping.",
                      ],
                      [
                        "Blank state",
                        "Leave blank when the discount should not require a minimum subtotal.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
              <input
                name="minimumSubtotal"
                type="number"
                min="0"
                step="0.01"
                defaultValue={values.minimumSubtotal}
              />
            </FormField>

            <FormField
              label="Unique code expiration minutes"
              error={errors?.uniqueCodeExpiresMinutes}
              info={
                <FieldInfoButton
                  label="Unique code expiration minutes"
                  title="Unique code expiration"
                >
                  <DiscountInfoContent
                    intro="This controls how long an assigned visitor code remains valid in Promo Pulse."
                    items={[
                      [
                        "Real expiration",
                        "Expired codes stop being shown and are not reassigned by the app.",
                      ],
                      [
                        "Shopify enforcement",
                        "If Shopify-side code expiration is available, reconciliation can revoke or expire remote codes too.",
                      ],
                      [
                        "Recommended use",
                        "Shorter windows work for urgency. Longer windows work for email or returning visitor campaigns.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
              <input
                name="uniqueCodeExpiresMinutes"
                type="number"
                min="5"
                max="43200"
                step="1"
                defaultValue={values.uniqueCodeExpiresMinutes}
              />
            </FormField>

            <div className="counterpulse-toggle">
              <label className="counterpulse-toggle-label">
                <input
                  name="syncStartEnd"
                  type="checkbox"
                  defaultChecked={values.syncStartEnd}
                />
                <span>
                  Copy Shopify discount start/end dates into this campaign
                </span>
              </label>
              <FieldInfoButton
                label="Copy Shopify discount dates"
                title="Discount date sync"
              >
                <DiscountInfoContent
                  intro="Date sync keeps campaign timers aligned with the real Shopify discount schedule."
                  items={[
                    [
                      "Recommended",
                      "Use it when the campaign countdown promises the discount deadline.",
                    ],
                    [
                      "Manual control",
                      "Disable it when the campaign schedule intentionally differs from the discount availability.",
                    ],
                  ]}
                />
              </FieldInfoButton>
            </div>

            <div className="counterpulse-toggle">
              <label className="counterpulse-toggle-label">
                <input
                  name="appliesOncePerCustomer"
                  type="checkbox"
                  defaultChecked={values.appliesOncePerCustomer}
                />
                <span>Limit created discount to one use per customer</span>
              </label>
              <FieldInfoButton
                label="Limit discount to one use per customer"
                title="One use per customer"
              >
                <DiscountInfoContent
                  intro="This asks Shopify to restrict a created discount to one use per customer when supported."
                  items={[
                    [
                      "Shared codes",
                      "Useful for public codes where repeat use should be limited.",
                    ],
                    [
                      "Unique codes",
                      "Unique visitor codes are already assigned per visitor in Promo Pulse, but Shopify customer limits can still be useful.",
                    ],
                  ]}
                />
              </FieldInfoButton>
            </div>

            <div className="counterpulse-toggle">
              <label className="counterpulse-toggle-label">
                <input
                  name="uniqueCodeAutoApply"
                  type="checkbox"
                  defaultChecked={values.uniqueCodeAutoApply}
                />
                <span>Auto-apply unique visitor codes</span>
              </label>
              <FieldInfoButton
                label="Auto-apply unique visitor codes"
                title="Auto-apply unique codes"
              >
                <DiscountInfoContent
                  intro="Auto-apply uses Shopify discount URLs when it is safe to do so."
                  items={[
                    [
                      "How it works",
                      "The storefront link can route shoppers through /discount/CODE with a redirect target.",
                    ],
                    [
                      "Limitation",
                      "Shopify controls the final cart or checkout behavior, so Promo Pulse does not force an unsafe apply action.",
                    ],
                  ]}
                />
              </FieldInfoButton>
            </div>
          </div>

          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Saving..." : "Save discount"}
            </button>
          </div>
        </Form>
      )}
      {confirmSubmit.modal}
    </s-section>
  );
}

function DiscountInfoContent({
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
}: {
  label: string;
  error?: string;
  children: ReactNode;
  info?: ReactNode;
}) {
  return (
    <div className="counterpulse-form-field">
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
