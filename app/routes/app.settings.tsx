import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

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
  const navigation = useNavigation();
  const values = actionData?.values ?? loaderValues;
  const errors = actionData?.errors ?? {};
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page heading="Settings">
      {actionData?.notice && (
        <s-banner tone="success" heading="Settings saved">
          <s-paragraph>{actionData.notice}</s-paragraph>
        </s-banner>
      )}

      {errors.form && (
        <s-banner tone="critical" heading="Settings could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      <s-section>
        <div className="counterpulse-dashboard-header">
          <div>
            <s-heading>Shop defaults</s-heading>
            <s-paragraph>
              Configure storefront defaults, analytics behavior, and theme
              selectors for Promo Pulse.
            </s-paragraph>
            <div className="counterpulse-muted">{shopifyDomain}</div>
          </div>
        </div>
      </s-section>

      <Form className="counterpulse-form" method="post">
        <s-section heading="Localization">
          <div className="counterpulse-form-grid">
            <label className="counterpulse-form-field">
              Default locale
              <select name="defaultLocale" defaultValue={values.defaultLocale}>
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

            <label className="counterpulse-form-field">
              Default timezone
              <input
                name="defaultTimezone"
                placeholder="UTC"
                defaultValue={values.defaultTimezone}
              />
              {errors.defaultTimezone && (
                <span className="counterpulse-form-error">
                  {errors.defaultTimezone}
                </span>
              )}
            </label>

            <label className="counterpulse-form-field">
              Default currency
              <input
                name="defaultCurrency"
                placeholder="USD"
                defaultValue={values.defaultCurrency}
              />
              {errors.defaultCurrency && (
                <span className="counterpulse-form-error">
                  {errors.defaultCurrency}
                </span>
              )}
            </label>

            <label className="counterpulse-form-field">
              Default country
              <input
                name="defaultCountry"
                placeholder="US"
                defaultValue={values.defaultCountry}
              />
              {errors.defaultCountry && (
                <span className="counterpulse-form-error">
                  {errors.defaultCountry}
                </span>
              )}
            </label>

            <fieldset className="counterpulse-fieldset counterpulse-form-field--full">
              <legend>Enabled locales</legend>
              <div className="counterpulse-toggle-grid">
                {supportedStorefrontLocales.map((locale) => (
                  <label className="counterpulse-toggle" key={locale}>
                    <input
                      type="checkbox"
                      name="enabledLocales"
                      value={locale}
                      defaultChecked={values.enabledLocales.includes(locale)}
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
            </fieldset>
          </div>
        </s-section>

        <s-section heading="Brand and support">
          <div className="counterpulse-form-grid">
            <label className="counterpulse-form-field">
              Brand name
              <input name="brandName" defaultValue={values.brandName} />
              {errors.brandName && (
                <span className="counterpulse-form-error">
                  {errors.brandName}
                </span>
              )}
            </label>

            <label className="counterpulse-form-field">
              Support email
              <input
                name="supportEmail"
                type="email"
                defaultValue={values.supportEmail}
              />
              {errors.supportEmail && (
                <span className="counterpulse-form-error">
                  {errors.supportEmail}
                </span>
              )}
            </label>
          </div>
        </s-section>

        <s-section heading="Theme selectors">
          <div className="counterpulse-form-grid">
            <label className="counterpulse-form-field">
              Cart drawer selector
              <input
                name="customCartDrawerSelector"
                placeholder="#CartDrawer"
                defaultValue={values.customCartDrawerSelector}
              />
              {errors.customCartDrawerSelector && (
                <span className="counterpulse-form-error">
                  {errors.customCartDrawerSelector}
                </span>
              )}
            </label>

            <label className="counterpulse-form-field">
              Cart page selector
              <input
                name="customCartPageSelector"
                placeholder='form[action="/cart"]'
                defaultValue={values.customCartPageSelector}
              />
              {errors.customCartPageSelector && (
                <span className="counterpulse-form-error">
                  {errors.customCartPageSelector}
                </span>
              )}
            </label>

            <label className="counterpulse-form-field counterpulse-form-field--full">
              Product form selector
              <input
                name="customProductFormSelector"
                placeholder='form[action*="/cart/add"]'
                defaultValue={values.customProductFormSelector}
              />
              {errors.customProductFormSelector && (
                <span className="counterpulse-form-error">
                  {errors.customProductFormSelector}
                </span>
              )}
            </label>
          </div>
        </s-section>

        <s-section heading="Analytics and debug">
          <div className="counterpulse-form-grid">
            <fieldset className="counterpulse-fieldset">
              <legend>Tracking</legend>
              <div className="counterpulse-toggle-grid">
                <label className="counterpulse-toggle">
                  <input
                    type="checkbox"
                    name="analyticsEnabled"
                    defaultChecked={values.analyticsEnabled}
                  />
                  Analytics enabled
                </label>
                <label className="counterpulse-toggle">
                  <input
                    type="checkbox"
                    name="respectDoNotTrack"
                    defaultChecked={values.respectDoNotTrack}
                  />
                  Respect Do Not Track
                </label>
                <label className="counterpulse-toggle">
                  <input
                    type="checkbox"
                    name="enableDebugMode"
                    defaultChecked={values.enableDebugMode}
                  />
                  Debug mode
                </label>
              </div>
            </fieldset>

            <label className="counterpulse-form-field">
              Consent mode
              <select name="consentMode" defaultValue={values.consentMode}>
                <option value="BASIC">Basic</option>
                <option value="STRICT">Strict</option>
              </select>
              {errors.consentMode && (
                <span className="counterpulse-form-error">
                  {errors.consentMode}
                </span>
              )}
              <span className="counterpulse-form-hint">
                Strict mode suppresses storefront analytics unless consent is
                available.
              </span>
            </label>
          </div>
        </s-section>

        <s-section>
          <div className="counterpulse-actions">
            <button
              className="counterpulse-button"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Saving..." : "Save settings"}
            </button>
          </div>
        </s-section>
      </Form>
    </s-page>
  );
}
