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
  | "customTopBarSelector"
  | "customBottomBarSelector"
  | "customProductPageSelector"
  | "customProductPageBadgeSelector"
  | "customCollectionCardSelector"
  | "customCartDrawerSelector"
  | "customCartPageSelector"
  | "customProductFormSelector"
  | "customThankYouPageSelector"
  | "customOrderStatusPageSelector"
  | "customHtmlSlotSelector"
  | "defaultCountry"
  | "defaultCurrency"
  | "defaultLocale"
  | "defaultTimezone";

type SelectorSettingKey = Exclude<
  TextSettingKey,
  | "brandName"
  | "defaultCountry"
  | "defaultCurrency"
  | "defaultLocale"
  | "defaultTimezone"
>;

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
  topBar: [
    "body",
    "#shopify-section-header",
    "header",
    ".shopify-section-header",
    "[data-section-type='header']",
  ],
  bottomBar: [
    "body",
    "#shopify-section-footer",
    "footer",
    ".shopify-section-footer",
    "[data-section-type='footer']",
  ],
  productPage: [
    "product-info",
    ".product__info-container",
    ".product-form",
    "[data-product-information]",
    "main .product",
  ],
  productPageBadge: [
    "media-gallery",
    "[id^='MediaGallery-']",
    "[data-product-media]",
    ".product__media-wrapper",
    ".product__media",
  ],
  collectionCard: [
    "[data-product-card]",
    ".card-wrapper",
    ".product-card",
    ".product-grid-item",
    ".grid__item",
  ],
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
  checkoutExtension: [
    "[data-promo-pulse-checkout-target]",
    "[data-extension-target]",
    ".shopify-checkout__dynamic-content",
  ],
  customHtmlSlot: [
    "[data-promo-pulse-slot]",
    "#promo-pulse-slot",
    ".promo-pulse-slot",
    "main",
  ],
};

const themeSelectorSettings: Array<{
  defaultSelector: string;
  field: SelectorSettingKey;
  hint: string;
  label: string;
  options: string[];
  placement: string;
}> = [
  {
    defaultSelector: "body",
    field: "customTopBarSelector",
    hint: "Preferred mount point for top-bar campaigns before Promo Pulse falls back to the document body.",
    label: "Top bar selector",
    options: selectorOptions.topBar,
    placement: "TOP_BAR",
  },
  {
    defaultSelector: "body",
    field: "customBottomBarSelector",
    hint: "Preferred mount point for bottom-bar campaigns before Promo Pulse falls back to the document body.",
    label: "Bottom bar selector",
    options: selectorOptions.bottomBar,
    placement: "BOTTOM_BAR",
  },
  {
    defaultSelector: "product-info, .product__info-container, .product-form",
    field: "customProductPageSelector",
    hint: "Used by product timer, delivery cutoff, and low-stock product-page placements when no block mount point is present.",
    label: "Product page selector",
    options: selectorOptions.productPage,
    placement: "PRODUCT_PAGE",
  },
  {
    defaultSelector:
      "media-gallery, [id^='MediaGallery-'], [data-product-media]",
    field: "customProductPageBadgeSelector",
    hint: "Used to place product-page badges over the product media area.",
    label: "Product page badge selector",
    options: selectorOptions.productPageBadge,
    placement: "PRODUCT_PAGE_BADGE",
  },
  {
    defaultSelector: "[data-product-card], .card-wrapper, .product-card",
    field: "customCollectionCardSelector",
    hint: "Used to find each product card inside collection and search grids.",
    label: "Collection product selector",
    options: selectorOptions.collectionCard,
    placement: "COLLECTION_CARD",
  },
  {
    defaultSelector: "#CartDrawer, cart-drawer, .drawer__contents",
    field: "customCartDrawerSelector",
    hint: "Used by cart drawer and cart rescue placements when the default drawer is not detected.",
    label: "Cart drawer selector",
    options: selectorOptions.cartDrawer,
    placement: "CART_DRAWER",
  },
  {
    defaultSelector: 'form[action="/cart"], #main-cart-items',
    field: "customCartPageSelector",
    hint: "Used as the preferred mount point for cart page campaigns when they render outside a theme block.",
    label: "Cart page selector",
    options: selectorOptions.cartPage,
    placement: "CART_PAGE",
  },
  {
    defaultSelector: 'form[action*="/cart/add"]',
    field: "customProductFormSelector",
    hint: "Used to listen for variant changes in product-page campaigns and low-stock widgets.",
    label: "Product form selector",
    options: selectorOptions.productForm,
    placement: "PRODUCT_FORM",
  },
  {
    defaultSelector: "Checkout extension target",
    field: "customThankYouPageSelector",
    hint: "Reserved default for thank-you page surfaces when the checkout extension provides a DOM target.",
    label: "Thank you page selector",
    options: selectorOptions.checkoutExtension,
    placement: "THANK_YOU_PAGE",
  },
  {
    defaultSelector: "Checkout extension target",
    field: "customOrderStatusPageSelector",
    hint: "Reserved default for order-status page surfaces when the checkout extension provides a DOM target.",
    label: "Order status page selector",
    options: selectorOptions.checkoutExtension,
    placement: "ORDER_STATUS_PAGE",
  },
  {
    defaultSelector: "Campaign selector",
    field: "customHtmlSlotSelector",
    hint: "Fallback for custom HTML slot campaigns when the campaign does not define its own selector.",
    label: "Custom HTML slot selector",
    options: selectorOptions.customHtmlSlot,
    placement: "CUSTOM_SELECTOR",
  },
];

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
  const availableLocales = useMemo(
    () =>
      supportedStorefrontLocales.filter(
        (locale) => !formValues.enabledLocales.includes(locale),
      ),
    [formValues.enabledLocales],
  );
  const selectedLocales = useMemo(
    () =>
      supportedStorefrontLocales.filter((locale) =>
        formValues.enabledLocales.includes(locale),
      ),
    [formValues.enabledLocales],
  );
  const [localeToAdd, setLocaleToAdd] = useState(availableLocales[0] ?? "");
  const selectedLocaleToAdd =
    localeToAdd && availableLocales.includes(localeToAdd)
      ? localeToAdd
      : (availableLocales[0] ?? "");
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

  const updateField = <Key extends keyof ShopSettingsValues>(
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

  const addEnabledLocale = () => {
    if (!selectedLocaleToAdd) return;

    setFormValues((current) => ({
      ...current,
      enabledLocales: Array.from(
        new Set([...current.enabledLocales, selectedLocaleToAdd]),
      ),
    }));
  };

  const removeEnabledLocale = (locale: string) => {
    setFormValues((current) => {
      if (
        locale === current.defaultLocale ||
        current.enabledLocales.length <= 1
      ) {
        return current;
      }

      return {
        ...current,
        enabledLocales: current.enabledLocales.filter(
          (item) => item !== locale,
        ),
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

        <div
          aria-label="Settings summary"
          className="counterpulse-settings-summary"
        >
          <div>
            <span>Storefront</span>
            <strong>{shopifyDomain}</strong>
          </div>
          <div>
            <span>Localization</span>
            <strong>
              {formValues.defaultLocale.toUpperCase()} /{" "}
              {formValues.defaultCurrency || "USD"}
            </strong>
          </div>
          <div>
            <span>Theme targets</span>
            <strong>{countConfiguredSelectors(formValues)} configured</strong>
          </div>
          <div>
            <span>Tracking</span>
            <strong>
              {formValues.analyticsEnabled ? "Analytics on" : "Analytics off"}
            </strong>
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

              <fieldset className="counterpulse-fieldset counterpulse-form-field--full counterpulse-locale-manager">
                <legend>Enabled locales</legend>
                <div className="counterpulse-locale-manager__selected">
                  {selectedLocales.map((locale) => (
                    <div className="counterpulse-locale-token" key={locale}>
                      <input
                        name="enabledLocales"
                        type="hidden"
                        value={locale}
                      />
                      <span>
                        <strong>{storefrontLocaleLabels[locale]}</strong>
                        <small>{locale}</small>
                      </span>
                      <button
                        aria-label={`Remove ${storefrontLocaleLabels[locale]}`}
                        disabled={
                          locale === formValues.defaultLocale ||
                          selectedLocales.length <= 1
                        }
                        type="button"
                        onClick={() => removeEnabledLocale(locale)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="counterpulse-locale-manager__add">
                  <label className="counterpulse-form-field">
                    Add language
                    <select
                      disabled={availableLocales.length === 0}
                      value={selectedLocaleToAdd}
                      onChange={(event) =>
                        setLocaleToAdd(event.currentTarget.value)
                      }
                    >
                      {availableLocales.length === 0 ? (
                        <option value="">All languages are enabled</option>
                      ) : (
                        availableLocales.map((locale) => (
                          <option key={locale} value={locale}>
                            {storefrontLocaleLabels[locale]} ({locale})
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <button
                    className="counterpulse-button-secondary"
                    disabled={!selectedLocaleToAdd}
                    type="button"
                    onClick={addEnabledLocale}
                  >
                    Add
                  </button>
                </div>
                {errors.enabledLocales && (
                  <span className="counterpulse-form-error">
                    {errors.enabledLocales}
                  </span>
                )}
                <span className="counterpulse-form-hint">
                  The default locale stays enabled. To remove it, choose another
                  default first.
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
            description="Choose default DOM targets for every campaign placement. Leave a field empty to use Promo Pulse detection, pick a preset from the selector suggestions, or type a custom CSS selector."
            title="Theme selectors"
          >
            <div className="counterpulse-selector-grid">
              {themeSelectorSettings.map((setting) => (
                <SelectorSettingField
                  defaultSelector={setting.defaultSelector}
                  error={errors[setting.field]}
                  field={setting.field}
                  hint={setting.hint}
                  key={setting.field}
                  label={setting.label}
                  options={setting.options}
                  placement={setting.placement}
                  value={formValues[setting.field]}
                  onChange={(value) => updateTextField(setting.field, value)}
                />
              ))}

              <div className="counterpulse-settings-note counterpulse-form-field--full">
                Campaign-level selectors keep priority. These defaults are used
                only when a campaign or Shopify block does not provide a more
                specific mount point.
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
                  Strict mode suppresses storefront analytics unless the visitor
                  has granted consent.
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
      <div className="counterpulse-settings-panel__intro">
        <div>
          <h2>{title}</h2>
          <p className="counterpulse-settings-panel__description">
            {description}
          </p>
        </div>
      </div>
      <div className="counterpulse-settings-panel__body">{children}</div>
    </section>
  );
}

function SelectorSettingField({
  defaultSelector,
  error,
  field,
  hint,
  label,
  onChange,
  options,
  placement,
  value,
}: {
  defaultSelector: string;
  error?: string;
  field: SelectorSettingKey;
  hint: string;
  label: string;
  onChange: (value: string) => void;
  options: string[];
  placement: string;
  value: string;
}) {
  const datalistId = `counterpulse-${toKebabCase(field)}-options`;

  return (
    <label className="counterpulse-form-field counterpulse-selector-field">
      <span className="counterpulse-selector-field__heading">
        <span>{label}</span>
        <em>{placement}</em>
      </span>
      <input
        aria-label={label}
        autoComplete="off"
        list={datalistId}
        name={field}
        placeholder={defaultSelector}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <SelectorDatalist id={datalistId} options={options} />
      {error && <span className="counterpulse-form-error">{error}</span>}
      <span className="counterpulse-selector-field__default">
        Default: <code>{defaultSelector}</code>
      </span>
      <span className="counterpulse-form-hint">{hint}</span>
    </label>
  );
}

function SelectorDatalist({ id, options }: { id: string; options: string[] }) {
  return (
    <datalist id={id}>
      {options.map((option) => (
        <option key={option} value={option} />
      ))}
    </datalist>
  );
}

function countConfiguredSelectors(values: ShopSettingsValues) {
  return themeSelectorSettings.filter((setting) => values[setting.field].trim())
    .length;
}

function toKebabCase(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
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
