import type { ReactNode } from "react";
import { Form, useNavigation } from "react-router";

import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

export type MarketOptionRow = {
  id: string;
  name: string;
  handle: string;
  enabled: boolean;
  primary: boolean;
  countryCodes: string;
  locale: string;
  currencyCode: string;
};

export type MarketRuleRow = {
  id: string;
  enabled: boolean;
  marketId: string;
  countryCode: string;
  locale: string;
  currencyCode: string;
  thresholdAmount: string;
  deliverySettingsJson: string;
  textOverridesJson: string;
  scopeSummary: string;
};

export type MarketRuleErrors = {
  form?: string;
  countryCode?: string;
  currencyCode?: string;
  locale?: string;
  thresholdAmount?: string;
  deliverySettingsJson?: string;
  textOverridesJson?: string;
};

type CampaignMarketsEditorProps = {
  apiError?: string;
  errors?: MarketRuleErrors;
  lockedReason?: string;
  markets: MarketOptionRow[];
  notice?: string;
  rules: MarketRuleRow[];
};

export function CampaignMarketsEditor({
  apiError,
  errors,
  lockedReason,
  markets,
  notice,
  rules,
}: CampaignMarketsEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-section heading="Markets">
      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Advanced markets are locked"
        />
      )}

      {apiError && (
        <s-banner tone="warning" heading="Shopify Markets could not be loaded">
          <s-paragraph>{apiError}</s-paragraph>
        </s-banner>
      )}

      {notice && (
        <s-banner tone="info" heading="Markets updated">
          <s-paragraph>{notice}</s-paragraph>
        </s-banner>
      )}

      {errors?.form && (
        <s-banner tone="critical" heading="Market rule could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      {!lockedReason && (
        <Form method="post" className="counterpulse-form">
          <input name="_action" type="hidden" value="saveMarketRule" />

          <div className="counterpulse-form-grid">
            <FormField label="Market">
              <select name="marketRuleMarketId" defaultValue="">
                <option value="">Any market</option>
                {markets.map((market) => (
                  <option key={market.id || market.handle} value={market.id}>
                    {market.name} ({market.currencyCode || "currency n/a"})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Country" error={errors?.countryCode}>
              <input name="marketRuleCountryCode" placeholder="US" maxLength={2} />
            </FormField>

            <FormField label="Locale" error={errors?.locale}>
              <input name="marketRuleLocale" placeholder="en or es-ES" />
            </FormField>

            <FormField label="Currency" error={errors?.currencyCode}>
              <input
                name="marketRuleCurrencyCode"
                placeholder="USD"
                maxLength={3}
              />
            </FormField>

            <FormField
              label="Free shipping threshold"
              error={errors?.thresholdAmount}
            >
              <input
                name="marketRuleThresholdAmount"
                min="0"
                step="0.01"
                type="number"
              />
            </FormField>

            <label className="counterpulse-toggle">
              <input name="marketRuleEnabled" type="checkbox" defaultChecked />
              <span>Campaign active for this market rule</span>
            </label>
          </div>

          <div className="counterpulse-form-grid">
            <FormField
              label="Text overrides JSON"
              error={errors?.textOverridesJson}
            >
              <textarea
                name="marketRuleTextOverridesJson"
                rows={4}
                placeholder='{"headline":"Free shipping in Spain","freeShippingProgressText":"You are {{amount}} away"}'
              />
            </FormField>

            <FormField
              label="Delivery cutoff JSON"
              error={errors?.deliverySettingsJson}
            >
              <textarea
                name="marketRuleDeliverySettingsJson"
                rows={4}
                placeholder='{"cutoffHour":16,"minDeliveryDays":2,"maxDeliveryDays":4}'
              />
            </FormField>
          </div>

          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Saving..." : "Save market rule"}
            </button>
          </div>
        </Form>
      )}

      <s-box paddingBlockStart="base">
        <div className="counterpulse-form-grid">
          <FormField label="Preview market">
            <select defaultValue={markets[0]?.id ?? ""}>
              {markets.length > 0 ? (
                markets.map((market) => (
                  <option key={market.id || market.handle} value={market.id}>
                    {market.name}
                  </option>
                ))
              ) : (
                <option value="">Fallback market</option>
              )}
            </select>
          </FormField>
          <FormField label="Preview locale">
            <input defaultValue={markets[0]?.locale || "en"} />
          </FormField>
          <FormField label="Preview currency">
            <input defaultValue={markets[0]?.currencyCode || "USD"} />
          </FormField>
        </div>
      </s-box>

      <s-box paddingBlockStart="base">
        <table className="counterpulse-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Countries</th>
              <th>Locale</th>
              <th>Currency</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {markets.length > 0 ? (
              markets.map((market) => (
                <tr key={market.id || market.handle}>
                  <td>
                    {market.name}
                    {market.primary ? " (primary)" : ""}
                  </td>
                  <td>{market.countryCodes || "-"}</td>
                  <td>{market.locale || "-"}</td>
                  <td>{market.currencyCode || "-"}</td>
                  <td>{market.enabled ? "Enabled" : "Disabled"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No Shopify markets detected.</td>
              </tr>
            )}
          </tbody>
        </table>
      </s-box>

      <s-box paddingBlockStart="base">
        <table className="counterpulse-table">
          <thead>
            <tr>
              <th>Scope</th>
              <th>Active</th>
              <th>Threshold</th>
              <th>Currency</th>
              <th>Text overrides</th>
              <th>Delivery</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.length > 0 ? (
              rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.scopeSummary}</td>
                  <td>{rule.enabled ? "Active" : "Inactive"}</td>
                  <td>{rule.thresholdAmount || "-"}</td>
                  <td>{rule.currencyCode || "-"}</td>
                  <td>
                    <code>{rule.textOverridesJson || "{}"}</code>
                  </td>
                  <td>
                    <code>{rule.deliverySettingsJson || "{}"}</code>
                  </td>
                  <td>
                    {!lockedReason && (
                      <Form method="post">
                        <input
                          name="_action"
                          type="hidden"
                          value="deleteMarketRule"
                        />
                        <input name="marketRuleId" type="hidden" value={rule.id} />
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
                <td colSpan={7}>No market overrides configured yet.</td>
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
