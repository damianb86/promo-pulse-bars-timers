import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import { AppAlert, AppToast } from "../components/Notifications";
import { TimezoneCombobox } from "../components/TimezoneCombobox";
import { getOrCreateShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import {
  getOrCreateShopSettings,
  hasShopSettingsErrors,
  parseShopSettingsFormData,
  toShopSettingsValues,
  updateShopSettings,
  type ShopSettingsErrors,
  type ShopSettingsValues,
} from "../services/shopSettings.server";
import {
  storefrontLocaleLabels,
  supportedStorefrontLocales,
} from "../types/shop-settings";

type LoaderData = {
  shopifyDomain: string;
  values: ShopSettingsValues;
};

type ActionData = {
  notice?: string;
  errors?: ShopSettingsErrors;
  values?: ShopSettingsValues;
};

type TextSettingKey =
  | "brandName"
  | "customCartDrawerSelector"
  | "customCartPageSelector"
  | "customProductFormSelector"
  | "defaultCountry"
  | "defaultCurrency"
  | "defaultLocale"
  | "defaultTimezone";

const settingsSaveBarId = "counterpulse-settings-save-bar";

const currencyOptions = [
  ["USD", "United States dollar"],
  ["ARS", "Argentine peso"],
  ["BRL", "Brazilian real"],
  ["CAD", "Canadian dollar"],
  ["CLP", "Chilean peso"],
  ["COP", "Colombian peso"],
  ["EUR", "Euro"],
  ["GBP", "British pound"],
  ["MXN", "Mexican peso"],
  ["PEN", "Peruvian sol"],
  ["UYU", "Uruguayan peso"],
];

const countryOptions = [
  ["US", "United States"],
  ["AR", "Argentina"],
  ["BR", "Brazil"],
  ["CA", "Canada"],
  ["CL", "Chile"],
  ["CO", "Colombia"],
  ["DE", "Germany"],
  ["ES", "Spain"],
  ["FR", "France"],
  ["GB", "United Kingdom"],
  ["MX", "Mexico"],
  ["PE", "Peru"],
  ["UY", "Uruguay"],
];

const selectorOptions = {
  cartDrawer: [
    "#CartDrawer",
    "cart-drawer",
    ".cart-drawer",
    ".drawer__contents",
    "[data-cart-drawer]",
  ],
  cartPage: [
    'form[action="/cart"]',
    "#main-cart-items",
    ".cart__items",
    ".cart-items",
    "[data-cart-items]",
  ],
  productForm: [
    'form[action*="/cart/add"]',
    "product-form form",
    ".product-form form",
    "[data-type='add-to-cart-form']",
    "[data-product-form]",
  ],
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const settings = await getOrCreateShopSettings(shop.id);

  return {
    shopifyDomain: shop.shopifyDomain,
    values: toShopSettingsValues(settings),
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const formData = await request.formData();
  const parsed = parseShopSettingsFormData(formData);

  if (hasShopSettingsErrors(parsed.errors)) {
    return {
      errors: parsed.errors,
      values: parsed.values,
    };
  }

  const values = await updateShopSettings(shop.id, parsed.values);

  return {
    notice: "Settings saved.",
    values,
  };
};

export default function SettingsPage() {
  const { shopifyDomain, values: loaderValues } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const errors = actionData?.errors ?? {};
  const savedValues =
    actionData?.notice && actionData.values ? actionData.values : loaderValues;
  const incomingValues = actionData?.values ?? loaderValues;
  const incomingValuesKey = useMemo(
    () => stringifySettingsValues(incomingValues),
    [incomingValues],
  );

  return (
    <s-page inlineSize="large">
      {actionData?.notice && (
        <AppToast tone="success" title="Settings saved">
          <s-paragraph>{actionData.notice}</s-paragraph>
        </AppToast>
      )}

      {errors.form && (
        <AppAlert tone="critical" title="Settings could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      <SettingsForm
        key={incomingValuesKey}
        errors={errors}
        incomingValues={incomingValues}
        savedValues={savedValues}
        shopifyDomain={shopifyDomain}
      />
    </s-page>
  );
}

function SettingsForm({
  errors,
  incomingValues,
  savedValues,
  shopifyDomain,
}: {
  errors: ShopSettingsErrors;
  incomingValues: ShopSettingsValues;
  savedValues: ShopSettingsValues;
  shopifyDomain: string;
}) {
  const navigation = useNavigation();
  const savedValuesKey = useMemo(
    () => stringifySettingsValues(savedValues),
    [savedValues],
  );
  const [formValues, setFormValues] =
    useState<ShopSettingsValues>(incomingValues);
  const formRef = useRef<HTMLFormElement>(null);
  const currentValuesKey = useMemo(
    () => stringifySettingsValues(formValues),
    [formValues],
  );
  const isSubmitting = navigation.state === "submitting";
  const isDirty = currentValuesKey !== savedValuesKey;

  useSettingsSaveBar({
    dirty: isDirty,
    disabled: isSubmitting,
    saving: isSubmitting,
  });

  const updateField = <Key extends keyof ShopSettingsValues,>(
    field: Key,
    value: ShopSettingsValues[Key],
  ) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateTextField = (field: TextSettingKey, value: string) => {
    updateField(field, value);
  };

  const updateDefaultLocale = (defaultLocale: string) => {
    setFormValues((current) => ({
      ...current,
      defaultLocale,
      enabledLocales: current.enabledLocales.includes(defaultLocale)
        ? current.enabledLocales
        : [defaultLocale, ...current.enabledLocales],
    }));
  };

  const updateEnabledLocale = (locale: string, enabled: boolean) => {
    setFormValues((current) => {
      if (!enabled && locale === current.defaultLocale) return current;

      const enabledLocales = enabled
        ? Array.from(new Set([...current.enabledLocales, locale]))
        : current.enabledLocales.filter((item) => item !== locale);

      return {
        ...current,
        enabledLocales,
      };
    });
  };

  return (
    <>
      <SettingsSaveBar
        disabled={isSubmitting}
        saving={isSubmitting}
        onDiscard={() => setFormValues(savedValues)}
        onSave={() => formRef.current?.requestSubmit()}
      />

      <div className="counterpulse-campaigns-layout counterpulse-settings-layout">
        <div className="counterpulse-campaigns-header">
          <div>
            <s-heading>Settings</s-heading>
            <s-paragraph>
              Configure storefront defaults, theme selectors, privacy-aware
              analytics, and new-campaign fallbacks for Promo Pulse.
            </s-paragraph>
            <div className="counterpulse-campaigns-header__meta">
              <span>{shopifyDomain}</span>
              <span>{formValues.defaultCurrency || "USD"}</span>
              <span>
                {formValues.consentMode === "STRICT"
                  ? "Strict consent"
                  : "Basic consent"}
              </span>
            </div>
          </div>
        </div>

        <Form
          ref={formRef}
          className="counterpulse-form counterpulse-settings-form"
          method="post"
        >
          <SettingsPanel
            description="Set the locale, timezone, currency, and country fallbacks used when Shopify does not provide them in the storefront request."
            title="Localization"
          >
            <div className="counterpulse-form-grid">
              <label className="counterpulse-form-field">
                Default locale
                <select
                  name="defaultLocale"
                  value={formValues.defaultLocale}
                  onChange={(event) =>
                    updateDefaultLocale(event.currentTarget.value)
                  }
                >
                  {supportedStorefrontLocales.map((locale) => (
                    <option key={locale} value={locale}>
                      {storefrontLocaleLabels[locale]}
                    </option>
                  ))}
                </select>
                {errors.defaultLocale && (
                  <span className="counterpulse-form-error">
                    {errors.defaultLocale}
                  </span>
                )}
              </label>

              <TimezoneCombobox
                error={errors.defaultTimezone}
                label="Default timezone"
                name="defaultTimezone"
                value={formValues.defaultTimezone}
                onChange={(value) => updateTextField("defaultTimezone", value)}
              />

              <label className="counterpulse-form-field">
                Default currency
                <input
                  autoComplete="off"
                  list="counterpulse-currency-options"
                  name="defaultCurrency"
                  placeholder="USD"
                  value={formValues.defaultCurrency}
                  onBlur={(event) =>
                    updateTextField(
                      "defaultCurrency",
                      event.currentTarget.value.toUpperCase(),
                    )
                  }
                  onChange={(event) =>
                    updateTextField(
                      "defaultCurrency",
                      event.currentTarget.value,
                    )
                  }
                />
                <datalist id="counterpulse-currency-options">
                  {currencyOptions.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </datalist>
                {errors.defaultCurrency && (
                  <span className="counterpulse-form-error">
                    {errors.defaultCurrency}
                  </span>
                )}
                <span className="counterpulse-form-hint">
                  ISO 4217 code used as a fallback for formatting discounts and
                  revenue.
                </span>
              </label>

              <label className="counterpulse-form-field">
                Default country
                <input
                  autoComplete="off"
                  list="counterpulse-country-options"
                  name="defaultCountry"
                  placeholder="US"
                  value={formValues.defaultCountry}
                  onBlur={(event) =>
                    updateTextField(
                      "defaultCountry",
                      event.currentTarget.value.toUpperCase(),
                    )
                  }
                  onChange={(event) =>
                    updateTextField("defaultCountry", event.currentTarget.value)
                  }
                />
                <datalist id="counterpulse-country-options">
                  {countryOptions.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </datalist>
                {errors.defaultCountry && (
                  <span className="counterpulse-form-error">
                    {errors.defaultCountry}
                  </span>
                )}
                <span className="counterpulse-form-hint">
                  ISO 3166-1 alpha-2 code used when country targeting is not
                  present in the storefront request.
                </span>
              </label>

              <fieldset className="counterpulse-fieldset counterpulse-form-field--full">
                <legend>Enabled locales</legend>
                <div className="counterpulse-toggle-grid">
                  {supportedStorefrontLocales.map((locale) => (
                    <label className="counterpulse-toggle" key={locale}>
                      <input
                        checked={formValues.enabledLocales.includes(locale)}
                        name="enabledLocales"
                        type="checkbox"
                        value={locale}
                        onChange={(event) =>
                          updateEnabledLocale(
                            locale,
                            event.currentTarget.checked,
                          )
                        }
                      />
                      {storefrontLocaleLabels[locale]}
                    </label>
                  ))}
                </div>
                {errors.enabledLocales && (
                  <span className="counterpulse-form-error">
                    {errors.enabledLocales}
                  </span>
                )}
                <span className="counterpulse-form-hint">
                  The default locale is always kept enabled when settings are
                  saved.
                </span>
              </fieldset>
            </div>
          </SettingsPanel>

          <SettingsPanel
            description="Set the merchant-facing brand label used by generated copy, reports, and default campaign text."
            title="Brand"
          >
            <div className="counterpulse-form-grid">
              <label className="counterpulse-form-field">
                Brand name
                <input
                  name="brandName"
                  value={formValues.brandName}
                  onChange={(event) =>
                    updateTextField("brandName", event.currentTarget.value)
                  }
                />
                {errors.brandName && (
                  <span className="counterpulse-form-error">
                    {errors.brandName}
                  </span>
                )}
              </label>
            </div>
          </SettingsPanel>

          <SettingsPanel
            description="Only override these selectors when your theme uses non-standard cart or product markup. Top and bottom bars mount from the app embed and do not require a selector."
            title="Theme selectors"
          >
            <div className="counterpulse-form-grid">
              <label className="counterpulse-form-field">
                Cart drawer selector
                <input
                  autoComplete="off"
                  list="counterpulse-cart-drawer-selectors"
                  name="customCartDrawerSelector"
                  placeholder="#CartDrawer"
                  value={formValues.customCartDrawerSelector}
                  onChange={(event) =>
                    updateTextField(
                      "customCartDrawerSelector",
                      event.currentTarget.value,
                    )
                  }
                />
                <SelectorDatalist
                  id="counterpulse-cart-drawer-selectors"
                  options={selectorOptions.cartDrawer}
                />
                {errors.customCartDrawerSelector && (
                  <span className="counterpulse-form-error">
                    {errors.customCartDrawerSelector}
                  </span>
                )}
                <span className="counterpulse-form-hint">
                  Used by cart drawer and cart rescue placements when the
                  default drawer is not detected.
                </span>
              </label>

              <label className="counterpulse-form-field">
                Cart page selector
                <input
                  autoComplete="off"
                  list="counterpulse-cart-page-selectors"
                  name="customCartPageSelector"
                  placeholder='form[action="/cart"]'
                  value={formValues.customCartPageSelector}
                  onChange={(event) =>
                    updateTextField(
                      "customCartPageSelector",
                      event.currentTarget.value,
                    )
                  }
                />
                <SelectorDatalist
                  id="counterpulse-cart-page-selectors"
                  options={selectorOptions.cartPage}
                />
                {errors.customCartPageSelector && (
                  <span className="counterpulse-form-error">
                    {errors.customCartPageSelector}
                  </span>
                )}
                <span className="counterpulse-form-hint">
                  Used as the preferred mount point for cart page campaigns.
                </span>
              </label>

              <label className="counterpulse-form-field counterpulse-form-field--full">
                Product form selector
                <input
                  autoComplete="off"
                  list="counterpulse-product-form-selectors"
                  name="customProductFormSelector"
                  placeholder='form[action*="/cart/add"]'
                  value={formValues.customProductFormSelector}
                  onChange={(event) =>
                    updateTextField(
                      "customProductFormSelector",
                      event.currentTarget.value,
                    )
                  }
                />
                <SelectorDatalist
                  id="counterpulse-product-form-selectors"
                  options={selectorOptions.productForm}
                />
                {errors.customProductFormSelector && (
                  <span className="counterpulse-form-error">
                    {errors.customProductFormSelector}
                  </span>
                )}
                <span className="counterpulse-form-hint">
                  Used by product page badges and low-stock widgets to listen
                  for variant changes.
                </span>
              </label>

              <div className="counterpulse-settings-note counterpulse-form-field--full">
                Product image, collection card, and custom selector placements
                are configured per campaign because they depend on the specific
                surface being targeted.
              </div>
            </div>
          </SettingsPanel>

          <SettingsPanel
            description="Control whether storefront events are recorded and how Promo Pulse handles browser privacy signals."
            title="Analytics and privacy"
          >
            <div className="counterpulse-form-grid">
              <fieldset className="counterpulse-fieldset">
                <legend>Tracking</legend>
                <div className="counterpulse-toggle-grid counterpulse-toggle-grid--single">
                  <label className="counterpulse-toggle">
                    <input
                      checked={formValues.analyticsEnabled}
                      name="analyticsEnabled"
                      type="checkbox"
                      onChange={(event) =>
                        updateField(
                          "analyticsEnabled",
                          event.currentTarget.checked,
                        )
                      }
                    />
                    Analytics enabled
                  </label>
                  <label className="counterpulse-toggle">
                    <input
                      checked={formValues.respectDoNotTrack}
                      name="respectDoNotTrack"
                      type="checkbox"
                      onChange={(event) =>
                        updateField(
                          "respectDoNotTrack",
                          event.currentTarget.checked,
                        )
                      }
                    />
                    Respect Do Not Track
                  </label>
                  <label className="counterpulse-toggle">
                    <input
                      checked={formValues.enableDebugMode}
                      name="enableDebugMode"
                      type="checkbox"
                      onChange={(event) =>
                        updateField(
                          "enableDebugMode",
                          event.currentTarget.checked,
                        )
                      }
                    />
                    Debug mode
                  </label>
                </div>
                <span className="counterpulse-form-hint">
                  When Do Not Track is respected, storefront analytics events
                  are ignored if the visitor sends that browser signal.
                </span>
              </fieldset>

              <label className="counterpulse-form-field">
                Consent mode
                <select
                  name="consentMode"
                  value={formValues.consentMode}
                  onChange={(event) =>
                    updateField(
                      "consentMode",
                      event.currentTarget.value === "STRICT"
                        ? "STRICT"
                        : "BASIC",
                    )
                  }
                >
                  <option value="BASIC">Basic</option>
                  <option value="STRICT">Strict</option>
                </select>
                {errors.consentMode && (
                  <span className="counterpulse-form-error">
                    {errors.consentMode}
                  </span>
                )}
                <span className="counterpulse-form-hint">
                  Strict mode suppresses storefront analytics unless the
                  visitor has granted consent.
                </span>
              </label>
            </div>
          </SettingsPanel>
        </Form>
      </div>
    </>
  );
}

function SettingsPanel({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="counterpulse-feature-panel counterpulse-settings-panel">
      <div className="counterpulse-panel-heading counterpulse-panel-heading--compact">
        <div>
          <h2>{title}</h2>
          <p className="counterpulse-settings-panel__description">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SelectorDatalist({
  id,
  options,
}: {
  id: string;
  options: string[];
}) {
  return (
    <datalist id={id}>
      {options.map((option) => (
        <option key={option} value={option} />
      ))}
    </datalist>
  );
}

function SettingsSaveBar({
  disabled,
  onDiscard,
  onSave,
  saving,
}: {
  disabled: boolean;
  onDiscard: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <ui-save-bar id={settingsSaveBarId}>
      <button
        disabled={disabled}
        type="button"
        variant="primary"
        onClick={onSave}
      >
        {saving ? "Saving..." : "Save"}
      </button>
      <button disabled={disabled} type="button" onClick={onDiscard}>
        Discard
      </button>
    </ui-save-bar>
  );
}

function useSettingsSaveBar({
  dirty,
  disabled,
  saving,
}: {
  dirty: boolean;
  disabled: boolean;
  saving: boolean;
}) {
  useEffect(() => {
    const saveBar = window.shopify?.saveBar;

    if (!saveBar) return;

    if (dirty && !disabled) {
      void saveBar.show(settingsSaveBarId);
      return;
    }

    if (!saving) {
      void saveBar.hide(settingsSaveBarId);
    }
  }, [dirty, disabled, saving]);

  useEffect(
    () => () => {
      void window.shopify?.saveBar?.hide(settingsSaveBarId);
    },
    [],
  );
}

function stringifySettingsValues(values: ShopSettingsValues) {
  return JSON.stringify({
    ...values,
    enabledLocales: [...values.enabledLocales],
  });
}
