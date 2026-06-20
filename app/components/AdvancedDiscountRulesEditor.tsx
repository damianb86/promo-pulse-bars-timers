import { useMemo, useState, type ReactNode } from "react";
import { AppAlert, useConfirmSubmit } from "./Notifications";
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

const defaultThresholdTiers = [
  { discountValue: "15", minimumSubtotal: "100" },
  { discountValue: "", minimumSubtotal: "" },
];

export function AdvancedDiscountRulesEditor({
  errors,
  lockedReason,
  notice,
  rules,
}: AdvancedDiscountRulesEditorProps) {
  const navigation = useNavigation();
  const [thresholdTiers, setThresholdTiers] = useState(defaultThresholdTiers);
  const isSubmitting = navigation.state === "submitting";
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Save advanced rule",
    title: "Save advanced discount rule?",
    children: (
      <p>
        This can create or update an app discount rule. Save as draft until you
        are ready for Shopify Functions to evaluate it in carts.
      </p>
    ),
  });
  const thresholdsJson = useMemo(() => {
    const tiers = thresholdTiers
      .map((tier) => ({
        discountValue: Number(tier.discountValue),
        minimumSubtotal: Number(tier.minimumSubtotal),
      }))
      .filter(
        (tier) =>
          Number.isFinite(tier.discountValue) &&
          tier.discountValue > 0 &&
          Number.isFinite(tier.minimumSubtotal) &&
          tier.minimumSubtotal > 0,
      );

    return JSON.stringify(
      tiers.length > 0 ? tiers : JSON.parse(defaultThresholdsJson),
    );
  }, [thresholdTiers]);

  const updateThresholdTier = (
    index: number,
    field: "discountValue" | "minimumSubtotal",
    value: string,
  ) => {
    setThresholdTiers((currentTiers) =>
      currentTiers.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [field]: value } : tier,
      ),
    );
  };

  return (
    <s-section heading="Advanced Discount Rules">
      <p className="counterpulse-section-description">
        Build premium discount logic for cases that need Shopify Functions, such
        as tiers, spend thresholds, free gifts, or cart conditions.
      </p>

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
        <Form
          method="post"
          className="counterpulse-form"
          onSubmit={confirmSubmit.onSubmit}
        >
          <input
            name="_action"
            type="hidden"
            value="saveAdvancedDiscountRule"
          />
          <input name="thresholdsJson" type="hidden" value={thresholdsJson} />

          <div className="counterpulse-panel-grid">
            <div className="counterpulse-config-card counterpulse-config-card--wide">
              <PanelHeader
                eyebrow="Rule"
                title="Discount logic"
                description="Start with a draft rule, then activate it after the Shopify Function discount has been verified."
              />
              <div className="counterpulse-form-grid counterpulse-form-grid--wide">
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

                <FormField
                  label="Discount value (%)"
                  error={errors?.discountValue}
                >
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
                    placeholder="Optional"
                  />
                </FormField>

                <FormField label="Start date/time">
                  <input name="startsAt" type="datetime-local" />
                </FormField>

                <FormField label="End date/time">
                  <input name="endsAt" type="datetime-local" />
                </FormField>
              </div>
            </div>

            <div className="counterpulse-config-card">
              <PanelHeader
                eyebrow="Eligibility"
                title="Products and collections"
                description="Leave both fields blank to evaluate the whole cart."
              />
              <div className="counterpulse-stack">
                <FormField label="Product or variant IDs">
                  <textarea
                    name="productIds"
                    rows={4}
                    placeholder="gid://shopify/Product/123"
                  />
                  <small className="counterpulse-field-hint">
                    One product or variant GID per line.
                  </small>
                </FormField>

                <FormField label="Collection IDs">
                  <textarea
                    name="collectionIds"
                    rows={4}
                    placeholder="gid://shopify/Collection/123"
                  />
                  <small className="counterpulse-field-hint">
                    Optional collection filters, one per line.
                  </small>
                </FormField>
              </div>
            </div>

            <div className="counterpulse-config-card">
              <PanelHeader
                eyebrow="Tiers"
                title="Spend thresholds"
                description="Build the tier rules without editing raw JSON."
              />
              <div className="counterpulse-tier-list">
                {thresholdTiers.map((tier, index) => (
                  <div className="counterpulse-tier-row" key={index}>
                    <strong>Tier {index + 1}</strong>
                    <FormField label={`Tier ${index + 1} minimum subtotal`}>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={tier.minimumSubtotal}
                        onChange={(event) =>
                          updateThresholdTier(
                            index,
                            "minimumSubtotal",
                            event.currentTarget.value,
                          )
                        }
                      />
                    </FormField>
                    <FormField label={`Tier ${index + 1} discount percent`}>
                      <input
                        min="0"
                        max="100"
                        step="0.01"
                        type="number"
                        value={tier.discountValue}
                        onChange={(event) =>
                          updateThresholdTier(
                            index,
                            "discountValue",
                            event.currentTarget.value,
                          )
                        }
                      />
                    </FormField>
                  </div>
                ))}
              </div>
              {errors?.thresholdsJson && (
                <small className="counterpulse-field-error">
                  {errors.thresholdsJson}
                </small>
              )}
            </div>
          </div>

          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Saving..." : "Save advanced rule"}
            </button>
          </div>
        </Form>
      )}
      {confirmSubmit.modal}

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
                      <DeleteAdvancedDiscountRuleForm ruleId={rule.id} />
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

function DeleteAdvancedDiscountRuleForm({ ruleId }: { ruleId: string }) {
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Delete rule",
    title: "Delete advanced discount rule?",
    tone: "critical",
    children: (
      <p>
        This removes the rule from Promo Pulse and may revoke the matching app
        discount when possible.
      </p>
    ),
  });

  return (
    <>
      <Form method="post" onSubmit={confirmSubmit.onSubmit}>
        <input
          name="_action"
          type="hidden"
          value="deleteAdvancedDiscountRule"
        />
        <input name="ruleId" type="hidden" value={ruleId} />
        <button className="counterpulse-button-danger" type="submit">
          Delete
        </button>
      </Form>
      {confirmSubmit.modal}
    </>
  );
}

function PanelHeader({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="counterpulse-panel-heading counterpulse-panel-heading--compact">
      <div>
        <p className="counterpulse-kicker">{eyebrow}</p>
        <h3>{title}</h3>
        <p className="counterpulse-panel-description">{description}</p>
      </div>
    </div>
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
