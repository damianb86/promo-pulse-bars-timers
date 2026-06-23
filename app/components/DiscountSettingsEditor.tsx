import { useState, type ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import {
  discountModeOptions,
  discountValueTypeOptions,
  type DiscountOption,
  type DiscountModeValue,
  type DiscountSettingsErrors,
  type DiscountSettingsValues,
  type DiscountValueTypeValue,
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

type BasicDiscountModeValue = Exclude<DiscountModeValue, "UNIQUE_CODES">;

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
  const [mode, setMode] = useState<BasicDiscountModeValue>(
    values.mode === "UNIQUE_CODES" ? "NONE" : values.mode,
  );
  const [valueType, setValueType] = useState(values.valueType);
  const basicDiscountModeOptions = discountModeOptions.filter(
    (option) => option.value !== "UNIQUE_CODES",
  );
  const isNoDiscount = mode === "NONE";
  const isLinkExisting = mode === "LINK_EXISTING";
  const isCreateNew = mode === "CREATE_NEW";
  const isFreeShipping = valueType === "FREE_SHIPPING";
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
      <div className="counterpulse-offer-strategy-panel">
        <section className="counterpulse-offer-hero">
          <div className="counterpulse-offer-hero__content">
            <span className="counterpulse-offer-hero__icon" aria-hidden="true">
              BD
            </span>
            <div>
              <h2>Basic discount</h2>
              <p>
                Link an existing Shopify discount or create one shared code for
                the campaign.
              </p>
            </div>
          </div>
          <div className="counterpulse-offer-hero__meta">
            <span className="counterpulse-offer-status-pill">
              {getBasicDiscountModeLabel(mode)}
            </span>
          </div>
        </section>

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

        {values.mode === "UNIQUE_CODES" && (
          <AppAlert tone="warning" title="Unique codes are active">
            <p>
              Unique-code settings were moved to the Unique codes sub-tab. This
              Basic discount form is only for switching the campaign back to no
              discount, an existing Shopify discount, or a shared code.
            </p>
          </AppAlert>
        )}

        {!lockedReason && (
          <Form
            method="post"
            className="counterpulse-form counterpulse-offer-form"
            onSubmit={confirmSubmit.onSubmit}
          >
            <input name="_action" type="hidden" value="saveDiscount" />

            <div className="counterpulse-offer-card-grid">
              <article className="counterpulse-offer-card counterpulse-offer-card--wide">
                <OfferCardHeader
                  icon="01"
                  title="Offer strategy"
                  description="Choose how the campaign connects to Shopify discount behavior."
                />
                <FormField
                  label="Discount mode"
                  error={errors?.mode}
                  info={
                    <FieldInfoButton
                      label="Discount mode"
                      title="Discount modes"
                    >
                      <DiscountInfoContent
                        intro="Discount mode decides whether this Basic discount strategy does nothing, links to an existing Shopify code, or creates one shared code."
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
                            "Unique codes",
                            "Visitor-specific codes now live in the Unique codes sub-tab so they do not mix with shared-code settings.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
                  <select
                    name="mode"
                    value={mode}
                    onChange={(event) =>
                      setMode(
                        event.currentTarget.value as BasicDiscountModeValue,
                      )
                    }
                  >
                    {basicDiscountModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                {isNoDiscount && (
                  <AppAlert
                    tone="info"
                    title="Discount fields are hidden for this mode"
                  >
                    <p>
                      This campaign will not promise or apply a discount. Use
                      this when the offer is only copy, urgency, merchandising,
                      or an email timer.
                    </p>
                  </AppAlert>
                )}
              </article>

              {isLinkExisting && (
                <article className="counterpulse-offer-card counterpulse-offer-card--wide">
                  <OfferCardHeader
                    icon="02"
                    title="Existing Shopify discount"
                    description="Reference a real code or discount ID that already exists."
                  />
                  <div className="counterpulse-form-grid">
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
                    <DiscountDateSyncToggle values={values} />
                  </div>
                </article>
              )}

              {isCreateNew && (
                <>
                  <article className="counterpulse-offer-card">
                    <OfferCardHeader
                      icon="02"
                      title="Code setup"
                      description="Name the discount and define the public code."
                    />
                    <FormField label="New discount title" error={errors?.title}>
                      <input
                        name="title"
                        defaultValue={values.title}
                        placeholder="Promo Pulse campaign discount"
                      />
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
                  </article>

                  <article className="counterpulse-offer-card">
                    <OfferCardHeader
                      icon="03"
                      title="Discount value"
                      description="Set the benefit Shopify should create."
                    />
                    <FormField
                      label="Discount type"
                      error={errors?.valueType}
                      info={
                        <FieldInfoButton
                          label="Discount type"
                          title="Discount type"
                        >
                          <DiscountInfoContent
                            intro="Discount type changes how the value field is interpreted when Promo Pulse creates the code."
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
                                "Creates a shipping discount. The discount value field is hidden because the benefit is shipping.",
                              ],
                            ]}
                          />
                        </FieldInfoButton>
                      }
                    >
                      <select
                        name="valueType"
                        value={valueType}
                        onChange={(event) =>
                          setValueType(
                            event.currentTarget.value as DiscountValueTypeValue,
                          )
                        }
                      >
                        {discountValueTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    {!isFreeShipping && (
                      <FormField
                        label="Discount value"
                        error={errors?.value}
                        info={
                          <FieldInfoButton
                            label="Discount value"
                            title="Discount value"
                          >
                            <DiscountInfoContent
                              intro="Discount value is interpreted according to the selected discount type."
                              items={[
                                ["Percentage", "15 means 15% off."],
                                [
                                  "Fixed amount",
                                  "15 means 15 units of the configured currency off.",
                                ],
                              ]}
                            />
                          </FieldInfoButton>
                        }
                      >
                        <div className="counterpulse-input-with-suffix">
                          <input
                            name="value"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={values.value}
                          />
                          <span>
                            {valueType === "PERCENTAGE" ? "%" : "off"}
                          </span>
                        </div>
                      </FormField>
                    )}

                    {isFreeShipping && (
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
                    )}

                    {isFreeShipping && (
                      <AppAlert
                        tone="info"
                        title="Discount value is hidden for free shipping"
                      >
                        <p>
                          Free shipping discounts use eligibility and subtotal
                          settings instead of a percentage or fixed discount
                          amount.
                        </p>
                      </AppAlert>
                    )}
                  </article>

                  <article className="counterpulse-offer-card">
                    <OfferCardHeader
                      icon="04"
                      title="Schedule and limits"
                      description="Keep discount availability aligned with the campaign."
                    />
                    <div className="counterpulse-form-grid">
                      <FormField
                        label="Start date/time"
                        error={errors?.startsAt}
                      >
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
                    </div>

                    <DiscountDateSyncToggle values={values} />

                    <div className="counterpulse-toggle counterpulse-offer-toggle-row">
                      <label className="counterpulse-toggle-label">
                        <input
                          name="appliesOncePerCustomer"
                          type="checkbox"
                          defaultChecked={values.appliesOncePerCustomer}
                        />
                        <span>
                          Limit created discount to one use per customer
                        </span>
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
                              "Customer limit",
                              "Shopify applies this at checkout when it can identify the customer.",
                            ],
                          ]}
                        />
                      </FieldInfoButton>
                    </div>
                  </article>
                </>
              )}
            </div>

            <div className="counterpulse-offer-actions">
              <button className="counterpulse-button" type="submit">
                {isSubmitting ? "Saving..." : "Save discount"}
              </button>
            </div>
          </Form>
        )}
        {confirmSubmit.modal}
      </div>
    </s-section>
  );
}

function getBasicDiscountModeLabel(mode: BasicDiscountModeValue) {
  const option = discountModeOptions.find((item) => item.value === mode);

  return option?.label ?? "Basic discount";
}

function OfferCardHeader({
  description,
  icon,
  title,
}: {
  description: string;
  icon: string;
  title: string;
}) {
  return (
    <div className="counterpulse-offer-card__header">
      <span aria-hidden="true">{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
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

function DiscountDateSyncToggle({
  values,
}: {
  values: DiscountSettingsValues;
}) {
  return (
    <div className="counterpulse-toggle">
      <label className="counterpulse-toggle-label">
        <input
          name="syncStartEnd"
          type="checkbox"
          defaultChecked={values.syncStartEnd}
        />
        <span>Copy Shopify discount start/end dates into this campaign</span>
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
