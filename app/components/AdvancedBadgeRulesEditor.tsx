import type { CSSProperties, ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import { badgePositionOptions, badgeShapeOptions } from "../types/badge";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

export type AdvancedBadgeRuleRow = {
  id: string;
  priority: number;
  status: string;
  text: string;
  shape: string;
  position: string;
  conditionsSummary: string;
  scheduleSummary: string;
  previewStyle: CSSProperties;
};

export type AdvancedBadgeRuleErrors = {
  form?: string;
  priority?: string;
  badgeText?: string;
  textByLocaleJson?: string;
  metafield?: string;
};

type AdvancedBadgeRulesEditorProps = {
  errors?: AdvancedBadgeRuleErrors;
  lockedReason?: string;
  notice?: string;
  rules: AdvancedBadgeRuleRow[];
};

const statusOptions = [
  { label: "Draft", value: "DRAFT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Paused", value: "PAUSED" },
];

export function AdvancedBadgeRulesEditor({
  errors,
  lockedReason,
  notice,
  rules,
}: AdvancedBadgeRulesEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Save badge rule",
    title: "Save advanced badge rule?",
    children: (
      <p>
        This can change which products show merchandising badges based on tags,
        markets, inventory, metafields, or schedule.
      </p>
    ),
  });

  return (
    <s-section heading="Badge Rules">
      <p className="counterpulse-section-description">
        Build prioritized merchandising rules for product badges using product,
        inventory, market, locale, metafield, and scheduling conditions.
      </p>

      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Advanced badge rules are locked"
        />
      )}

      {notice && (
        <AppAlert tone="info" title="Badge rules updated">
          <s-paragraph>{notice}</s-paragraph>
        </AppAlert>
      )}

      {errors?.form && (
        <AppAlert tone="critical" title="Badge rule could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {!lockedReason && (
        <Form
          method="post"
          className="counterpulse-form"
          onSubmit={confirmSubmit.onSubmit}
        >
          <input name="_action" type="hidden" value="saveAdvancedBadgeRule" />

          <div className="counterpulse-form-grid">
            <FormField label="Badge text" error={errors?.badgeText}>
              <input name="badgeRuleText" defaultValue="Limited offer" />
            </FormField>

            <FormField
              label="Priority"
              error={errors?.priority}
              info={
                <FieldInfoButton
                  label="Badge rule priority"
                  title="Badge rule priority"
                >
                  <AdvancedBadgeInfoContent
                    intro="Priority decides which badge wins when multiple rules match the same product."
                    items={[
                      [
                        "Higher priority",
                        "Use higher numbers for more important badges.",
                      ],
                      [
                        "Duplicate prevention",
                        "Priority helps avoid showing duplicate or conflicting badges.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
              <input
                name="badgeRulePriority"
                type="number"
                min="0"
                max="1000"
                step="1"
                defaultValue="10"
              />
            </FormField>

            <FormField
              label="Status"
              info={
                <FieldInfoButton
                  label="Badge rule status"
                  title="Badge rule status"
                >
                  <AdvancedBadgeInfoContent
                    intro="Status controls whether this rule can display badges on matching products."
                    items={[
                      ["Draft", "Saved for review but not intended to render."],
                      [
                        "Active",
                        "Eligible to render when conditions and schedule match.",
                      ],
                      [
                        "Paused",
                        "Temporarily disabled without deleting the rule.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
              <select name="badgeRuleStatus" defaultValue="ACTIVE">
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Shape">
              <select name="badgeRuleShape" defaultValue="PILL">
                {badgeShapeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Position">
              <select name="badgeRulePosition" defaultValue="TOP_RIGHT">
                {badgePositionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Click URL">
              <input name="badgeRuleUrl" placeholder="/collections/sale" />
            </FormField>
          </div>

          <s-box paddingBlockStart="base">
            <div className="counterpulse-form-grid">
              <FormField
                label="Product tags"
                info={
                  <FieldInfoButton label="Product tags" title="Tag conditions">
                    <AdvancedBadgeInfoContent
                      intro="Product tags limit the badge to products with matching Shopify tags."
                      items={[
                        [
                          "Format",
                          "Use comma-separated tags such as sale, vip, preorder.",
                        ],
                        [
                          "Matching",
                          "The rule matches when product context includes the configured tags.",
                        ],
                      ]}
                    />
                  </FieldInfoButton>
                }
              >
                <input name="badgeRuleProductTags" placeholder="sale, vip" />
              </FormField>

              <FormField label="Collection IDs">
                <input
                  name="badgeRuleCollectionIds"
                  placeholder="gid://shopify/Collection/123"
                />
              </FormField>

              <FormField label="Vendor">
                <input name="badgeRuleVendor" placeholder="Acme" />
              </FormField>

              <FormField
                label="Inventory below"
                info={
                  <FieldInfoButton
                    label="Inventory below"
                    title="Inventory condition"
                  >
                    <AdvancedBadgeInfoContent
                      intro="Inventory conditions rely on real Shopify inventory context."
                      items={[
                        [
                          "Threshold",
                          "The badge can show when available inventory is below this number.",
                        ],
                        [
                          "No fake stock",
                          "If inventory is unavailable, the rule should not invent scarcity.",
                        ],
                      ]}
                    />
                  </FieldInfoButton>
                }
              >
                <input
                  name="badgeRuleInventoryBelow"
                  type="number"
                  min="0"
                  step="1"
                />
              </FormField>

              <label className="counterpulse-toggle">
                <input name="badgeRuleDiscountActive" type="checkbox" />
                <span>Require active discount</span>
              </label>

              <label className="counterpulse-toggle">
                <input name="badgeRuleCompareAtPrice" type="checkbox" />
                <span>Require compare-at price</span>
              </label>
            </div>
          </s-box>

          <s-box paddingBlockStart="base">
            <div className="counterpulse-form-grid">
              <FormField
                label="Metafield namespace"
                error={errors?.metafield}
                info={
                  <FieldInfoButton
                    label="Metafield namespace"
                    title="Metafield condition"
                  >
                    <AdvancedBadgeInfoContent
                      intro="Metafield conditions let merchandising teams target badges from structured product data."
                      items={[
                        [
                          "Namespace and key",
                          "Together they identify the metafield, such as custom.badge_group.",
                        ],
                        [
                          "Value",
                          "The rule matches when the product metafield equals the configured value.",
                        ],
                      ]}
                    />
                  </FieldInfoButton>
                }
              >
                <input
                  name="badgeRuleMetafieldNamespace"
                  placeholder="custom"
                />
              </FormField>

              <FormField label="Metafield key" error={errors?.metafield}>
                <input name="badgeRuleMetafieldKey" placeholder="badge_group" />
              </FormField>

              <FormField label="Metafield value" error={errors?.metafield}>
                <input name="badgeRuleMetafieldValue" placeholder="premium" />
              </FormField>

              <FormField label="Markets">
                <input name="badgeRuleMarkets" placeholder="US, EU" />
              </FormField>

              <FormField label="Locales">
                <input name="badgeRuleLocales" placeholder="en, es" />
              </FormField>

              <FormField label="Starts at">
                <input name="badgeRuleStartsAt" type="datetime-local" />
              </FormField>

              <FormField label="Ends at">
                <input name="badgeRuleEndsAt" type="datetime-local" />
              </FormField>
            </div>
          </s-box>

          <s-box paddingBlockStart="base">
            <div className="counterpulse-form-grid">
              <FormField
                label="Translations JSON"
                error={errors?.textByLocaleJson}
                info={
                  <FieldInfoButton
                    label="Translations JSON"
                    title="Badge translations"
                  >
                    <AdvancedBadgeInfoContent
                      intro="Translations map storefront locales to localized badge text."
                      items={[
                        [
                          "Format",
                          '{"es":"Oferta","fr":"Offre"} maps locale codes to badge labels.',
                        ],
                        [
                          "Fallback",
                          "Locales without a translation use the main badge text.",
                        ],
                      ]}
                    />
                  </FieldInfoButton>
                }
              >
                <textarea
                  name="badgeRuleTextByLocaleJson"
                  rows={4}
                  placeholder='{"es":"Oferta","fr":"Offre"}'
                />
              </FormField>

              <div className="counterpulse-form-grid">
                <FormField label="Background color">
                  <input
                    name="badgeRuleBackgroundColor"
                    type="color"
                    defaultValue="#111827"
                  />
                </FormField>

                <FormField label="Text color">
                  <input
                    name="badgeRuleTextColor"
                    type="color"
                    defaultValue="#ffffff"
                  />
                </FormField>

                <FormField label="Accent color">
                  <input
                    name="badgeRuleAccentColor"
                    type="color"
                    defaultValue="#22c55e"
                  />
                </FormField>

                <FormField label="Font size">
                  <input
                    name="badgeRuleFontSize"
                    type="number"
                    min="10"
                    max="24"
                    step="1"
                    defaultValue="13"
                  />
                </FormField>
              </div>
            </div>
          </s-box>

          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Saving..." : "Save badge rule"}
            </button>
          </div>
        </Form>
      )}
      {confirmSubmit.modal}

      <s-box paddingBlockStart="base">
        <table className="counterpulse-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Preview</th>
              <th>Status</th>
              <th>Conditions</th>
              <th>Schedule</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.length > 0 ? (
              rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.priority}</td>
                  <td>
                    <span
                      className="counterpulse-badge-rule-preview"
                      style={rule.previewStyle}
                    >
                      {rule.text}
                    </span>
                  </td>
                  <td>{rule.status}</td>
                  <td>{rule.conditionsSummary || "All matching products"}</td>
                  <td>{rule.scheduleSummary || "Always"}</td>
                  <td>
                    {!lockedReason && (
                      <DeleteAdvancedBadgeRuleForm ruleId={rule.id} />
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No advanced badge rules created yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </s-box>
    </s-section>
  );
}

function DeleteAdvancedBadgeRuleForm({ ruleId }: { ruleId: string }) {
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Delete badge rule",
    title: "Delete advanced badge rule?",
    tone: "critical",
    children: (
      <p>
        This removes the rule. Matching products will no longer receive this
        advanced badge unless another rule applies.
      </p>
    ),
  });

  return (
    <>
      <Form method="post" onSubmit={confirmSubmit.onSubmit}>
        <input name="_action" type="hidden" value="deleteAdvancedBadgeRule" />
        <input name="badgeRuleId" type="hidden" value={ruleId} />
        <button className="counterpulse-button-danger" type="submit">
          Delete
        </button>
      </Form>
      {confirmSubmit.modal}
    </>
  );
}

function AdvancedBadgeInfoContent({
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
