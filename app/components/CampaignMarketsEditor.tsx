import { useMemo, useState, type ReactNode } from "react";
import { AppAlert, FieldInfoButton, useConfirmSubmit } from "./Notifications";
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
  scopeSummary: string;
};

export type MarketRuleErrors = {
  form?: string;
  countryCode?: string;
  currencyCode?: string;
  locale?: string;
  thresholdAmount?: string;
  deliverySettingsJson?: string;
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
  const [deliverySettings, setDeliverySettings] = useState({
    cutoffHour: "",
    maxDeliveryDays: "",
    minDeliveryDays: "",
  });
  const deliverySettingsJson = useMemo(
    () => stringifyDeliverySettings(deliverySettings),
    [deliverySettings],
  );
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Save market rule",
    title: "Save market override?",
    children: (
      <p>
        This can override market-specific thresholds and delivery settings for
        matching storefront requests. Campaign text stays managed in Campaign
        &gt; Message.
      </p>
    ),
  });
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
      <p className="counterpulse-section-description">
        Configure market-specific business rules for Shopify Markets, such as
        free-shipping thresholds, currency matching, delivery cutoffs, and
        whether the campaign is active for a market. Text and translations are
        managed in Campaign &gt; Message.
      </p>

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
        <Form
          method="post"
          className="counterpulse-form"
          onSubmit={confirmSubmit.onSubmit}
        >
          <input name="_action" type="hidden" value="saveMarketRule" />
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
                description="Use the broadest selector that is accurate. Matching market rules can override thresholds, currency, delivery settings, and active state."
              />
              <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                <FormField
                  label="Market"
                  info={
                    <FieldInfoButton label="Market" title="Market scope">
                      <MarketInfoContent
                        intro="Market scope controls which Shopify Market this override belongs to."
                        items={[
                          [
                            "Specific market",
                            "Use when Shopify Markets exposes a market ID and the override should match that market.",
                          ],
                          [
                            "Any market",
                            "Use when country, locale, or currency are enough to identify the audience.",
                          ],
                          [
                            "Access scopes",
                            "If Shopify blocks markets access, manual country and currency rules still work as fallback.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
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

                <FormField
                  label="Country"
                  error={errors?.countryCode}
                  info={
                    <FieldInfoButton label="Country" title="Country matching">
                      <MarketInfoContent
                        intro="Country narrows the override to storefront requests detected for that country."
                        items={[
                          [
                            "Format",
                            "Use a two-letter ISO country code such as US, ES, MX, or AR.",
                          ],
                          [
                            "Fallback",
                            "Leave blank when market, locale, or currency should be enough.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
                  <input
                    name="marketRuleCountryCode"
                    placeholder="US"
                    maxLength={2}
                  />
                </FormField>

                <FormField
                  label="Locale"
                  error={errors?.locale}
                  info={
                    <FieldInfoButton label="Locale" title="Locale matching">
                      <MarketInfoContent
                        intro="Locale is an optional matching condition for market rules. It does not manage translations."
                        items={[
                          [
                            "Format",
                            "Use values such as en, es, es-ES, pt-BR, fr, or de.",
                          ],
                          [
                            "Translations",
                            "Localized copy is edited in Campaign > Message. Use this field only when a threshold or delivery rule should apply to a specific storefront language.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
                  <input name="marketRuleLocale" placeholder="en or es-ES" />
                </FormField>

                <FormField
                  label="Currency"
                  error={errors?.currencyCode}
                  info={
                    <FieldInfoButton label="Currency" title="Currency matching">
                      <MarketInfoContent
                        intro="Currency controls threshold and money display matching for the override."
                        items={[
                          [
                            "Format",
                            "Use a three-letter ISO currency code such as USD, EUR, MXN, ARS, or BRL.",
                          ],
                          [
                            "Thresholds",
                            "Free-shipping threshold amounts are interpreted in this currency for matching market contexts.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
                  <input
                    name="marketRuleCurrencyCode"
                    placeholder="USD"
                    maxLength={3}
                  />
                </FormField>

                <FormField
                  label="Free shipping threshold"
                  error={errors?.thresholdAmount}
                  info={
                    <FieldInfoButton
                      label="Free shipping threshold"
                      title="Market threshold"
                    >
                      <MarketInfoContent
                        intro="This overrides the campaign's global free-shipping threshold for matching market requests."
                        items={[
                          [
                            "Market-specific",
                            "Use different values when shipping economics differ by country or currency.",
                          ],
                          [
                            "Blank state",
                            "Leave blank to keep the global campaign threshold.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
                >
                  <input
                    name="marketRuleThresholdAmount"
                    min="0"
                    step="0.01"
                    type="number"
                    placeholder="75.00"
                  />
                </FormField>

                <div className="counterpulse-toggle counterpulse-toggle--card">
                  <label className="counterpulse-toggle-label">
                    <input
                      name="marketRuleEnabled"
                      type="checkbox"
                      defaultChecked
                    />
                    <span>Campaign active for this market rule</span>
                  </label>
                  <FieldInfoButton
                    label="Campaign active for this market rule"
                    title="Market rule activation"
                  >
                    <MarketInfoContent
                      intro="This toggle controls whether the override can make a campaign eligible for the matched market."
                      items={[
                        [
                          "Enabled",
                          "The override can apply threshold, currency, and delivery settings.",
                        ],
                        [
                          "Disabled",
                          "The rule is saved but ignored by storefront eligibility.",
                        ],
                      ]}
                    />
                  </FieldInfoButton>
                </div>
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
                  info={
                    <FieldInfoButton
                      label="Market cutoff hour"
                      title="Market delivery cutoff"
                    >
                      <MarketInfoContent
                        intro="Market delivery settings override the global delivery cutoff for matching requests."
                        items={[
                          [
                            "Cutoff hour",
                            "Use 0 through 23 in the market's operating timezone context.",
                          ],
                          [
                            "Delivery days",
                            "Minimum and maximum days describe the promise shown after matching this override.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
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
      {confirmSubmit.modal}

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
                  <td>{summarizeJson(rule.deliverySettingsJson)}</td>
                  <td>
                    {!lockedReason && <DeleteMarketRuleForm ruleId={rule.id} />}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No market overrides configured yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </s-box>
    </s-section>
  );
}

function DeleteMarketRuleForm({ ruleId }: { ruleId: string }) {
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Delete override",
    title: "Delete market override?",
    tone: "critical",
    children: (
      <p>
        This removes the market rule. Matching storefront requests will fall
        back to the global campaign settings.
      </p>
    ),
  });

  return (
    <>
      <Form method="post" onSubmit={confirmSubmit.onSubmit}>
        <input name="_action" type="hidden" value="deleteMarketRule" />
        <input name="marketRuleId" type="hidden" value={ruleId} />
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

function MarketInfoContent({
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
