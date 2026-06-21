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
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Save market rule",
    title: "Save market override?",
    children: (
      <p>
        This can override campaign copy, free-shipping thresholds, and delivery
        settings for matching storefront market requests.
      </p>
    ),
  });
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
      <p className="counterpulse-section-description">
        Configure country, locale, currency, threshold, and delivery overrides
        for Shopify Markets without changing the global campaign defaults.
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
                        intro="Locale controls language-specific copy overrides."
                        items={[
                          [
                            "Format",
                            "Use values such as en, es, es-ES, pt-BR, fr, or de.",
                          ],
                          [
                            "Priority",
                            "When a locale override matches, localized text wins over global campaign text.",
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
                          "The override can apply copy, threshold, and delivery settings.",
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
                eyebrow="Copy"
                title="Localized message"
                description="Only fill the fields that should differ from the campaign default."
              />
              <div className="counterpulse-stack">
                <FormField
                  label="Headline override"
                  error={errors?.textOverridesJson}
                  info={
                    <FieldInfoButton
                      label="Headline override"
                      title="Localized copy"
                    >
                      <MarketInfoContent
                        intro="Localized copy fields replace only the campaign text entered here."
                        items={[
                          [
                            "Partial overrides",
                            "Fill only the fields that differ for this market or locale.",
                          ],
                          [
                            "Fallback",
                            "Blank fields continue using the global campaign message.",
                          ],
                        ]}
                      />
                    </FieldInfoButton>
                  }
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
        <div className="counterpulse-config-card">
          <PanelHeader
            eyebrow="Preview"
            title="Market context"
            description="Simulate a Shopify Market, locale, and currency to preview which override would be used. This does not change who can see the campaign."
          />
          <AppAlert tone="info" title="Preview only">
            <p>
              These fields do not geolocate you and do not filter the live
              storefront. Country and audience visibility are configured in the
              Targeting tab; this panel only helps check market-specific copy,
              thresholds, currency, and delivery settings.
            </p>
          </AppAlert>
          <div className="counterpulse-form-grid">
            <FormField
              label="Preview market"
              info={
                <FieldInfoButton label="Preview market" title="Market preview">
                  <MarketInfoContent
                    intro="Preview market simulates the market context sent to Promo Pulse so you can inspect market overrides without changing live eligibility."
                    items={[
                      [
                        "What it affects",
                        "It helps you verify localized copy, free-shipping thresholds, currency assumptions, and delivery settings for this editor preview.",
                      ],
                      [
                        "What it does not affect",
                        "It does not save a rule, publish targeting, geolocate the admin user, or decide whether the campaign should render for Argentina, United States, or any other country.",
                      ],
                      [
                        "Where visibility lives",
                        "Use the Targeting tab for country, market, product, customer, device, and URL eligibility rules.",
                      ],
                    ]}
                  />
                </FieldInfoButton>
              }
            >
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
                    {!lockedReason && <DeleteMarketRuleForm ruleId={rule.id} />}
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

function DeleteMarketRuleForm({ ruleId }: { ruleId: string }) {
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Delete override",
    title: "Delete market override?",
    tone: "critical",
    children: (
      <p>
        This removes the localized market rule. Matching storefront requests
        will fall back to the global campaign settings.
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
