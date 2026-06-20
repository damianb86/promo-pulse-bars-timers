import { useMemo, useState, type ReactNode } from "react";
import { AppAlert } from "./Notifications";
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
  const [textOverrides, setTextOverrides] = useState({
    ctaText: "",
    freeShippingProgressText: "",
    headline: "",
    subheadline: "",
  });
  const [deliverySettings, setDeliverySettings] = useState({
    cutoffHour: "",
    maxDeliveryDays: "",
    minDeliveryDays: "",
  });
  const textOverridesJson = useMemo(
    () => stringifyNonEmptyObject(textOverrides),
    [textOverrides],
  );
  const deliverySettingsJson = useMemo(
    () => stringifyDeliverySettings(deliverySettings),
    [deliverySettings],
  );
  const updateTextOverride = (
    field: keyof typeof textOverrides,
    value: string,
  ) => {
    setTextOverrides((current) => ({
      ...current,
      [field]: value,
    }));
  };
  const updateDeliverySetting = (
    field: keyof typeof deliverySettings,
    value: string,
  ) => {
    setDeliverySettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <s-section heading="Markets">
      {lockedReason && (
        <PlanUpgradeCallout
          message={lockedReason}
          title="Advanced markets are locked"
        />
      )}

      {apiError && (
        <AppAlert tone="warning" title="Shopify Markets could not be loaded">
          <s-paragraph>{apiError}</s-paragraph>
        </AppAlert>
      )}

      {notice && (
        <AppAlert tone="info" title="Markets updated">
          <s-paragraph>{notice}</s-paragraph>
        </AppAlert>
      )}

      {errors?.form && (
        <AppAlert tone="critical" title="Market rule could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {!lockedReason && (
        <Form method="post" className="counterpulse-form">
          <input name="_action" type="hidden" value="saveMarketRule" />
          <input
            name="marketRuleTextOverridesJson"
            type="hidden"
            value={textOverridesJson}
          />
          <input
            name="marketRuleDeliverySettingsJson"
            type="hidden"
            value={deliverySettingsJson}
          />

          <div className="counterpulse-panel-grid">
            <div className="counterpulse-config-card counterpulse-config-card--wide">
              <PanelHeader
                eyebrow="Scope"
                title="Where this override applies"
                description="Use the broadest selector that is accurate. Market overrides win over global campaign settings."
              />
              <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                <FormField label="Market">
                  <select name="marketRuleMarketId" defaultValue="">
                    <option value="">Any market</option>
                    {markets.map((market) => (
                      <option
                        key={market.id || market.handle}
                        value={market.id}
                      >
                        {market.name} ({market.currencyCode || "currency n/a"})
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Country" error={errors?.countryCode}>
                  <input
                    name="marketRuleCountryCode"
                    placeholder="US"
                    maxLength={2}
                  />
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
                    placeholder="75.00"
                  />
                </FormField>

                <label className="counterpulse-toggle counterpulse-toggle--card">
                  <input
                    name="marketRuleEnabled"
                    type="checkbox"
                    defaultChecked
                  />
                  <span>Campaign active for this market rule</span>
                </label>
              </div>
            </div>

            <div className="counterpulse-config-card">
              <PanelHeader
                eyebrow="Copy"
                title="Localized message"
                description="Only fill the fields that should differ from the campaign default."
              />
              <div className="counterpulse-stack">
                <FormField
                  label="Headline override"
                  error={errors?.textOverridesJson}
                >
                  <input
                    value={textOverrides.headline}
                    placeholder="Free shipping in Spain"
                    onChange={(event) =>
                      updateTextOverride("headline", event.currentTarget.value)
                    }
                  />
                </FormField>
                <FormField label="Supporting text override">
                  <textarea
                    rows={3}
                    value={textOverrides.subheadline}
                    placeholder="Localized supporting copy"
                    onChange={(event) =>
                      updateTextOverride(
                        "subheadline",
                        event.currentTarget.value,
                      )
                    }
                  />
                </FormField>
                <FormField label="CTA override">
                  <input
                    value={textOverrides.ctaText}
                    placeholder="Shop now"
                    onChange={(event) =>
                      updateTextOverride("ctaText", event.currentTarget.value)
                    }
                  />
                </FormField>
                <FormField label="Free shipping progress text">
                  <input
                    value={textOverrides.freeShippingProgressText}
                    placeholder="You are {{amount}} away"
                    onChange={(event) =>
                      updateTextOverride(
                        "freeShippingProgressText",
                        event.currentTarget.value,
                      )
                    }
                  />
                </FormField>
              </div>
            </div>

            <div className="counterpulse-config-card">
              <PanelHeader
                eyebrow="Delivery"
                title="Market cutoff"
                description="Optional delivery settings for this market or country."
              />
              <div className="counterpulse-form-grid">
                <FormField
                  label="Cutoff hour"
                  error={errors?.deliverySettingsJson}
                >
                  <input
                    max="23"
                    min="0"
                    type="number"
                    value={deliverySettings.cutoffHour}
                    placeholder="16"
                    onChange={(event) =>
                      updateDeliverySetting(
                        "cutoffHour",
                        event.currentTarget.value,
                      )
                    }
                  />
                </FormField>
                <FormField label="Minimum delivery days">
                  <input
                    min="0"
                    type="number"
                    value={deliverySettings.minDeliveryDays}
                    placeholder="2"
                    onChange={(event) =>
                      updateDeliverySetting(
                        "minDeliveryDays",
                        event.currentTarget.value,
                      )
                    }
                  />
                </FormField>
                <FormField label="Maximum delivery days">
                  <input
                    min="0"
                    type="number"
                    value={deliverySettings.maxDeliveryDays}
                    placeholder="4"
                    onChange={(event) =>
                      updateDeliverySetting(
                        "maxDeliveryDays",
                        event.currentTarget.value,
                      )
                    }
                  />
                </FormField>
              </div>
            </div>
          </div>

          <div className="counterpulse-actions">
            <button className="counterpulse-button" type="submit">
              {isSubmitting ? "Saving..." : "Save market rule"}
            </button>
          </div>
        </Form>
      )}

      <s-box paddingBlockStart="base">
        <div className="counterpulse-config-card">
          <PanelHeader
            eyebrow="Preview"
            title="Market context"
            description="Use these selectors to mirror how a storefront request will resolve market settings."
          />
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
                  <td>{summarizeJson(rule.textOverridesJson)}</td>
                  <td>{summarizeJson(rule.deliverySettingsJson)}</td>
                  <td>
                    {!lockedReason && (
                      <Form method="post">
                        <input
                          name="_action"
                          type="hidden"
                          value="deleteMarketRule"
                        />
                        <input
                          name="marketRuleId"
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
                <td colSpan={7}>No market overrides configured yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </s-box>
    </s-section>
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

function stringifyNonEmptyObject(value: Record<string, string>) {
  const normalized = Object.entries(value).reduce<Record<string, string>>(
    (result, [key, item]) => {
      const trimmed = item.trim();

      if (trimmed) result[key] = trimmed;

      return result;
    },
    {},
  );

  return JSON.stringify(normalized);
}

function stringifyDeliverySettings(value: Record<string, string>) {
  const normalized = Object.entries(value).reduce<Record<string, number>>(
    (result, [key, item]) => {
      const parsed = Number(item);

      if (Number.isFinite(parsed) && item.trim() !== "") {
        result[key] = parsed;
      }

      return result;
    },
    {},
  );

  return JSON.stringify(normalized);
}

function summarizeJson(value: string) {
  if (!value || value === "{}") return "-";

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return value;
    }

    const entries = Object.entries(parsed)
      .filter(([, item]) => item !== "" && item != null)
      .slice(0, 3)
      .map(([key, item]) => `${formatJsonKey(key)}: ${String(item)}`);

    return entries.length > 0 ? entries.join("; ") : "-";
  } catch {
    return value;
  }
}

function formatJsonKey(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
