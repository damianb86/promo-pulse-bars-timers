import { useMemo, useState, type ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
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
  const activeRulesCount = rules.filter(
    (rule) => rule.status === "ACTIVE",
  ).length;
  const draftRulesCount = rules.filter(
    (rule) => rule.status === "DRAFT",
  ).length;
  const pausedRulesCount = rules.filter(
    (rule) => rule.status === "PAUSED",
  ).length;
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
      <div className="counterpulse-offer-strategy-panel">
        <section className="counterpulse-offer-hero counterpulse-offer-hero--advanced">
          <div className="counterpulse-offer-hero__content">
            <span className="counterpulse-offer-hero__icon" aria-hidden="true">
              AR
            </span>
            <div>
              <h2>Advanced rules</h2>
              <p>
                Build premium Shopify Functions logic for tiers, spend
                thresholds, free gifts, and cart conditions.
              </p>
            </div>
          </div>
          <div className="counterpulse-offer-hero__meta">
            <span className="counterpulse-offer-status-pill">
              {rules.length} rules
            </span>
          </div>
        </section>

        <dl className="counterpulse-offer-stat-strip counterpulse-offer-stat-strip--compact">
          <div>
            <dt>Total rules</dt>
            <dd>{rules.length}</dd>
          </div>
          <div>
            <dt>Active</dt>
            <dd>{activeRulesCount}</dd>
          </div>
          <div>
            <dt>Draft</dt>
            <dd>{draftRulesCount}</dd>
          </div>
          <div>
            <dt>Paused</dt>
            <dd>{pausedRulesCount}</dd>
          </div>
        </dl>

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
          <AppAlert
            tone="critical"
            title="Advanced discount could not be saved"
          >
            <s-paragraph>{errors.form}</s-paragraph>
          </AppAlert>
        )}

        {!lockedReason && (
          <Form
            method="post"
            className="counterpulse-form counterpulse-offer-form"
            onSubmit={confirmSubmit.onSubmit}
          >
            <input
              name="_action"
              type="hidden"
              value="saveAdvancedDiscountRule"
            />
            <input name="thresholdsJson" type="hidden" value={thresholdsJson} />

            <div className="counterpulse-panel-grid counterpulse-offer-card-grid">
              <div className="counterpulse-config-card counterpulse-config-card--wide counterpulse-offer-card">
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

                  <FormField
                    label="Rule type"
                    info={
                      <FieldInfoButton
                        label="Advanced discount rule type"
                        title="Advanced discount rule types"
                      >
                        <AdvancedDiscountInfoContent
                          intro="Rule type determines which Shopify Function logic should evaluate the cart."
                          items={[
                            [
                              "Spend X get Y",
                              "Use when reaching a subtotal or quantity threshold should unlock a configured benefit.",
                            ],
                            [
                              "Tiered discount",
                              "Use multiple subtotal tiers, such as 10% over 100 and 15% over 200.",
                            ],
                            [
                              "Free gift",
                              "Use when eligible cart contents should unlock a gift product or gift-like discount.",
                            ],
                            [
                              "Product + shipping combo",
                              "Use when a product discount and shipping benefit need to be coordinated.",
                            ],
                            [
                              "Cart contents",
                              "Use when eligibility depends on product IDs, collections, or specific cart composition.",
                            ],
                          ]}
                        />
                      </FieldInfoButton>
                    }
                  >
                    <select
                      aria-label="Advanced discount rule type"
                      name="ruleType"
                      defaultValue="TIERED_DISCOUNT"
                    >
                      {ruleTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    label="Status"
                    info={
                      <FieldInfoButton
                        label="Advanced discount status"
                        title="Rule status"
                      >
                        <AdvancedDiscountInfoContent
                          intro="Status controls whether a rule is ready for evaluation after it is saved."
                          items={[
                            [
                              "Draft",
                              "Saved for review. Use this while configuring thresholds and Shopify Function setup.",
                            ],
                            [
                              "Active",
                              "Eligible for app discount evaluation when the matching Shopify discount exists.",
                            ],
                            [
                              "Paused",
                              "Temporarily disabled without deleting the configuration.",
                            ],
                          ]}
                        />
                      </FieldInfoButton>
                    }
                  >
                    <select
                      aria-label="Advanced discount status"
                      name="ruleStatus"
                      defaultValue="DRAFT"
                    >
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
                    info={
                      <FieldInfoButton
                        label="Advanced discount value"
                        title="Discount value"
                      >
                        <AdvancedDiscountInfoContent
                          intro="This is the default percentage discount used by rule types that do not need per-tier values."
                          items={[
                            [
                              "Tiered rules",
                              "The tier builder can override this with threshold-specific percentages.",
                            ],
                            [
                              "Cart rules",
                              "The value applies only when the configured product or cart conditions match.",
                            ],
                          ]}
                        />
                      </FieldInfoButton>
                    }
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
                    info={
                      <FieldInfoButton
                        label="Shipping discount"
                        title="Shipping discount"
                      >
                        <AdvancedDiscountInfoContent
                          intro="Use this only when the advanced rule intentionally includes a shipping benefit."
                          items={[
                            [
                              "Optional",
                              "Leave blank for product-only or order-only discount rules.",
                            ],
                            [
                              "Shopify limitations",
                              "Combined product and shipping behavior depends on Shopify Function capabilities and discount configuration.",
                            ],
                          ]}
                        />
                      </FieldInfoButton>
                    }
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

              <div className="counterpulse-config-card counterpulse-offer-card">
                <PanelHeader
                  eyebrow="Eligibility"
                  title="Products and collections"
                  description="Leave both fields blank to evaluate the whole cart."
                />
                <div className="counterpulse-stack">
                  <FormField
                    label="Product or variant IDs"
                    info={
                      <FieldInfoButton
                        label="Product or variant IDs"
                        title="Product eligibility"
                      >
                        <AdvancedDiscountInfoContent
                          intro="These IDs limit which cart lines can trigger or receive the advanced discount."
                          items={[
                            [
                              "Accepted format",
                              "Use Shopify GIDs, one product or variant per line.",
                            ],
                            [
                              "Blank state",
                              "Leave blank together with collection IDs to evaluate the whole cart.",
                            ],
                          ]}
                        />
                      </FieldInfoButton>
                    }
                  >
                    <textarea
                      name="productIds"
                      rows={4}
                      placeholder="gid://shopify/Product/123"
                    />
                    <small className="counterpulse-field-hint">
                      One product or variant GID per line.
                    </small>
                  </FormField>

                  <FormField
                    label="Collection IDs"
                    info={
                      <FieldInfoButton
                        label="Collection IDs"
                        title="Collection eligibility"
                      >
                        <AdvancedDiscountInfoContent
                          intro="Collection IDs let a rule apply to products in selected Shopify collections."
                          items={[
                            [
                              "Accepted format",
                              "Use Shopify collection GIDs, one per line.",
                            ],
                            [
                              "Evaluation",
                              "The function or backend resolver must be able to map cart lines to those collections.",
                            ],
                          ]}
                        />
                      </FieldInfoButton>
                    }
                  >
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

              <div className="counterpulse-config-card counterpulse-offer-card">
                <PanelHeader
                  eyebrow="Tiers"
                  title="Spend thresholds"
                  description="Build the tier rules without editing raw JSON."
                />
                <div className="counterpulse-tier-list">
                  {thresholdTiers.map((tier, index) => (
                    <div className="counterpulse-tier-row" key={index}>
                      <strong>Tier {index + 1}</strong>
                      <FormField
                        label={`Tier ${index + 1} minimum subtotal`}
                        info={
                          index === 0 ? (
                            <FieldInfoButton
                              label="Tier minimum subtotal"
                              title="Spend tiers"
                            >
                              <AdvancedDiscountInfoContent
                                intro="Spend tiers replace raw JSON with structured threshold rows."
                                items={[
                                  [
                                    "Minimum subtotal",
                                    "The cart subtotal that must be reached before the tier can apply.",
                                  ],
                                  [
                                    "Discount percent",
                                    "The benefit applied after the subtotal threshold is reached.",
                                  ],
                                  [
                                    "Generated JSON",
                                    "Promo Pulse serializes these rows into the hidden rule configuration.",
                                  ],
                                ]}
                              />
                            </FieldInfoButton>
                          ) : null
                        }
                      >
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

            <div className="counterpulse-offer-actions">
              <button className="counterpulse-button" type="submit">
                {isSubmitting ? "Saving..." : "Save advanced rule"}
              </button>
            </div>
          </Form>
        )}
        {confirmSubmit.modal}

        <section className="counterpulse-offer-table-card">
          <div className="counterpulse-offer-table-card__header">
            <h3>Saved advanced rules</h3>
            <p>Review rule status and remote Shopify discount linkage.</p>
          </div>
          <div className="counterpulse-offer-table-card__scroll">
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
                      <td>
                        <span className="counterpulse-offer-status-pill">
                          {formatEnum(rule.status)}
                        </span>
                      </td>
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
                    <td colSpan={7}>
                      <div className="counterpulse-offer-empty">
                        <span aria-hidden="true">RULE</span>
                        <strong>No advanced discount rules created yet</strong>
                        <p>
                          Save a rule to start coordinating complex cart logic.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
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

function AdvancedDiscountInfoContent({
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
  children,
  error,
  info,
  label,
}: {
  children: ReactNode;
  error?: string;
  info?: ReactNode;
  label: string;
}) {
  return (
    <div className="counterpulse-field">
      <span className="counterpulse-field-label-row">
        <span>{label}</span>
        {info}
      </span>
      <label className="counterpulse-field-control">
        <span className="counterpulse-sr-only">{label}</span>
        {children}
      </label>
      {error && <small className="counterpulse-field-error">{error}</small>}
    </div>
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
