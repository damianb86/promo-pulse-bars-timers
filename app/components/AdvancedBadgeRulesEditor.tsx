import type { CSSProperties, ReactNode } from "react";
import { AppAlert } from "./Notifications";
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

  return (
    <s-section heading="Badge Rules">
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
        <Form method="post" className="counterpulse-form">
          <input name="_action" type="hidden" value="saveAdvancedBadgeRule" />

          <div className="counterpulse-form-grid">
            <FormField label="Badge text" error={errors?.badgeText}>
              <input name="badgeRuleText" defaultValue="Limited offer" />
            </FormField>

            <FormField label="Priority" error={errors?.priority}>
              <input
                name="badgeRulePriority"
                type="number"
                min="0"
                max="1000"
                step="1"
                defaultValue="10"
              />
            </FormField>

            <FormField label="Status">
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
              <FormField label="Product tags">
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

              <FormField label="Inventory below">
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
              <FormField label="Metafield namespace" error={errors?.metafield}>
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
                      <Form method="post">
                        <input
                          name="_action"
                          type="hidden"
                          value="deleteAdvancedBadgeRule"
                        />
                        <input
                          name="badgeRuleId"
                          type="hidden"
                          value={rule.id}
                        />
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
                <td colSpan={6}>No advanced badge rules created yet.</td>
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
