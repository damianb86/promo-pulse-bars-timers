import { useState } from "react";
import { AppAlert, useConfirmSubmit } from "./Notifications";
import { Form, useNavigation } from "react-router";

import {
  campaignTranslationFields,
  storefrontLocales,
  translationInputName,
  type CampaignTextField,
  type CampaignTranslationFormErrors,
  type CampaignTranslationValues,
  type CampaignTranslationsByLocale,
  type StorefrontLocale,
} from "../types/localization";

type CampaignTranslationsEditorProps = {
  initialValues: CampaignTranslationsByLocale;
  resolvedValues: CampaignTranslationsByLocale;
  errors?: CampaignTranslationFormErrors;
};

export function CampaignTranslationsEditor({
  initialValues,
  resolvedValues,
  errors,
}: CampaignTranslationsEditorProps) {
  const navigation = useNavigation();
  const [activeLocale, setActiveLocale] = useState<StorefrontLocale>("en");
  const [values, setValues] = useState(initialValues);
  const isSubmitting = navigation.state === "submitting";
  const confirmSubmit = useConfirmSubmit({
    confirmLabel: "Save translations",
    title: "Save campaign translations?",
    children: (
      <p>
        This updates localized campaign copy. Empty fields will continue using
        the resolved fallback shown in each input.
      </p>
    ),
  });

  return (
    <s-section heading="Translations">
      <p className="counterpulse-section-description">
        Manage locale-specific copy while keeping clear fallback text for any
        language that is not fully translated.
      </p>

      {errors?.form && (
        <AppAlert tone="critical" title="Translations could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      <Form
        method="post"
        className="counterpulse-translations"
        onSubmit={confirmSubmit.onSubmit}
      >
        <input name="_action" type="hidden" value="saveTranslations" />

        <div
          aria-label="Campaign translation locales"
          className="counterpulse-locale-tabs"
          role="tablist"
        >
          {storefrontLocales.map((localeOption) => (
            <button
              aria-selected={activeLocale === localeOption.locale}
              className={
                activeLocale === localeOption.locale ? "is-active" : undefined
              }
              key={localeOption.locale}
              role="tab"
              type="button"
              onClick={() => setActiveLocale(localeOption.locale)}
            >
              <span>{localeOption.shortLabel}</span>
              <small>{localeOption.label}</small>
            </button>
          ))}
        </div>

        <div className="counterpulse-translations__actions">
          {activeLocale !== "en" && (
            <button
              className="counterpulse-button-secondary"
              type="button"
              onClick={() =>
                copyEnglishToLocale(activeLocale, values, setValues)
              }
            >
              Copy English
            </button>
          )}
          <button
            className="counterpulse-button-secondary"
            type="button"
            onClick={() => copyEnglishToAll(values, setValues)}
          >
            Copy English to all
          </button>
        </div>

        {storefrontLocales.map((localeOption) => (
          <div
            className="counterpulse-translation-panel"
            hidden={activeLocale !== localeOption.locale}
            key={localeOption.locale}
            role="tabpanel"
          >
            <div className="counterpulse-form-grid">
              {campaignTranslationFields.map((field) => (
                <TranslationField
                  error={
                    errors?.locales?.[localeOption.locale]?.[field.key] ?? ""
                  }
                  field={field}
                  key={field.key}
                  locale={localeOption.locale}
                  placeholder={resolvedValues[localeOption.locale][field.key]}
                  value={values[localeOption.locale][field.key]}
                  onChange={(nextValue) =>
                    updateTranslationValue(
                      values,
                      setValues,
                      localeOption.locale,
                      field.key,
                      nextValue,
                    )
                  }
                />
              ))}
            </div>
          </div>
        ))}

        <div className="counterpulse-actions">
          <button className="counterpulse-button" type="submit">
            {isSubmitting ? "Saving..." : "Save translations"}
          </button>
        </div>
      </Form>
      {confirmSubmit.modal}
    </s-section>
  );
}

function TranslationField({
  locale,
  field,
  value,
  placeholder,
  error,
  onChange,
}: {
  locale: StorefrontLocale;
  field: (typeof campaignTranslationFields)[number];
  value: string;
  placeholder: string;
  error: string;
  onChange: (value: string) => void;
}) {
  const name = translationInputName(locale, field.key);

  return (
    <label
      className={
        field.multiline
          ? "counterpulse-form-field counterpulse-form-field--full"
          : "counterpulse-form-field"
      }
    >
      <span>{field.label}</span>
      {field.multiline ? (
        <textarea
          name={name}
          placeholder={placeholder}
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {!value && placeholder && (
        <span className="counterpulse-form-hint">Fallback: {placeholder}</span>
      )}
      {error && <span className="counterpulse-form-error">{error}</span>}
    </label>
  );
}

function updateTranslationValue(
  values: CampaignTranslationsByLocale,
  setValues: (values: CampaignTranslationsByLocale) => void,
  locale: StorefrontLocale,
  field: CampaignTextField,
  value: string,
) {
  setValues({
    ...values,
    [locale]: {
      ...values[locale],
      [field]: value,
    },
  });
}

function copyEnglishToLocale(
  locale: StorefrontLocale,
  values: CampaignTranslationsByLocale,
  setValues: (values: CampaignTranslationsByLocale) => void,
) {
  setValues({
    ...values,
    [locale]: { ...values.en },
  });
}

function copyEnglishToAll(
  values: CampaignTranslationsByLocale,
  setValues: (values: CampaignTranslationsByLocale) => void,
) {
  setValues(
    storefrontLocales.reduce((nextValues, localeOption) => {
      nextValues[localeOption.locale] =
        localeOption.locale === "en"
          ? values.en
          : ({ ...values.en } as CampaignTranslationValues);
      return nextValues;
    }, {} as CampaignTranslationsByLocale),
  );
}
