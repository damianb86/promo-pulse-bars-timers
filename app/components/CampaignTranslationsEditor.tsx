import { useEffect, useRef, useState } from "react";
import { AppAlert, ConfirmModal, useConfirmSubmit } from "./Notifications";
import { Form, useFetcher, useNavigation, useSubmit } from "react-router";

import {
  campaignTranslationFields,
  storefrontLocales,
  translationFallbackInputName,
  translationInputName,
  type CampaignTextField,
  type CampaignTranslationFormErrors,
  type CampaignTranslationValues,
  type CampaignTranslationsByLocale,
  type StorefrontLocale,
} from "../types/localization";

type CampaignTranslationsEditorProps = {
  embedded?: boolean;
  initialLocale?: StorefrontLocale;
  initialValues: CampaignTranslationsByLocale;
  showActions?: boolean;
  resolvedValues: CampaignTranslationsByLocale;
  errors?: CampaignTranslationFormErrors;
  onActiveLocaleChange?: (
    values: CampaignTranslationsByLocale,
    activeLocale: StorefrontLocale,
  ) => void;
  onValuesChange?: (
    values: CampaignTranslationsByLocale,
    activeLocale: StorefrontLocale,
  ) => void;
};

type CampaignTranslationAiFetcherData = {
  aiTranslation?: {
    source: "mock" | "provider";
    sourceLocale: StorefrontLocale;
    translations: CampaignTranslationsByLocale;
  };
  aiTranslationError?: string;
};

type TranslationNotice = {
  message: string;
  title: string;
  tone: "success" | "critical";
};

export function CampaignTranslationsEditor({
  embedded = false,
  initialLocale = "en",
  initialValues,
  showActions = true,
  resolvedValues,
  errors,
  onActiveLocaleChange,
  onValuesChange,
}: CampaignTranslationsEditorProps) {
  const navigation = useNavigation();
  const submit = useSubmit();
  const aiTranslationFetcher = useFetcher<CampaignTranslationAiFetcherData>();
  const [activeLocale, setActiveLocale] =
    useState<StorefrontLocale>(initialLocale);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [translatingLocale, setTranslatingLocale] =
    useState<StorefrontLocale | null>(null);
  const [translationNotice, setTranslationNotice] =
    useState<TranslationNotice | null>(null);
  const [values, setValues] = useState(initialValues);
  const initialValuesRef = useRef(initialValues);
  const initialValuesSignature = getTranslationValuesSignature(initialValues);
  const isSubmitting = navigation.state === "submitting";
  const isAiTranslating = aiTranslationFetcher.state !== "idle";
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
  const selectLocale = (locale: StorefrontLocale) => {
    setActiveLocale(locale);
    onActiveLocaleChange?.(values, locale);
  };
  const replaceValues = (
    nextValues: CampaignTranslationsByLocale,
    locale = activeLocale,
  ) => {
    setValues(nextValues);
    onValuesChange?.(nextValues, locale);
  };
  const updateFieldValue = (
    locale: StorefrontLocale,
    field: CampaignTextField,
    value: string,
  ) => {
    setValues((currentValues) => {
      const nextValues = updateTranslationValue(
        currentValues,
        locale,
        field,
        value,
      );

      onValuesChange?.(nextValues, locale);
      return nextValues;
    });
  };
  const translateFromLocale = (locale: StorefrontLocale) => {
    setTranslationNotice(null);
    setTranslatingLocale(locale);
    aiTranslationFetcher.submit(
      buildAiTranslationFormData(values, resolvedValues, locale),
      { method: "post" },
    );
  };

  useEffect(() => {
    initialValuesRef.current = initialValues;
  }, [initialValues]);

  useEffect(() => {
    const syncValues = window.setTimeout(() => {
      setValues(initialValuesRef.current);
    }, 0);

    return () => window.clearTimeout(syncValues);
  }, [initialValuesSignature]);

  useEffect(() => {
    const data = aiTranslationFetcher.data;

    if (!data) return;

    const syncAiTranslation = window.setTimeout(() => {
      if (data.aiTranslation?.translations) {
        const sourceLabel =
          localeLabel(data.aiTranslation.sourceLocale) ??
          data.aiTranslation.sourceLocale;

        setValues(data.aiTranslation.translations);
        onValuesChange?.(
          data.aiTranslation.translations,
          data.aiTranslation.sourceLocale,
        );
        setTranslationNotice({
          tone: "success",
          title: "Translations generated",
          message: `AI filled the other languages using ${sourceLabel} as the source.`,
        });
      } else if (data.aiTranslationError) {
        setTranslationNotice({
          tone: "critical",
          title: "Translations could not be generated",
          message: data.aiTranslationError,
        });
      }

      setTranslatingLocale(null);
    }, 0);

    return () => window.clearTimeout(syncAiTranslation);
  }, [aiTranslationFetcher.data, onValuesChange]);

  const content = (
    <>
      <div
        aria-label="Campaign translation locales"
        className="counterpulse-locale-tabs"
        role="tablist"
      >
        {storefrontLocales.map((localeOption) => (
          <button
            aria-controls={`translation-panel-${localeOption.locale}`}
            aria-selected={activeLocale === localeOption.locale}
            className={
              activeLocale === localeOption.locale ? "is-active" : undefined
            }
            id={`translation-tab-${localeOption.locale}`}
            key={localeOption.locale}
            role="tab"
            type="button"
            onClick={() => selectLocale(localeOption.locale)}
          >
            <span className="counterpulse-locale-tabs__flag" aria-hidden="true">
              {localeOption.flag}
            </span>
            <span>{localeOption.shortLabel}</span>
            <small>{localeOption.label}</small>
          </button>
        ))}
      </div>

      {translationNotice && (
        <AppAlert tone={translationNotice.tone} title={translationNotice.title}>
          <p>{translationNotice.message}</p>
        </AppAlert>
      )}

      <div className="counterpulse-translations__actions">
        {activeLocale !== "en" && (
          <button
            className="counterpulse-button-secondary"
            type="button"
            onClick={() =>
              replaceValues(copyEnglishToLocale(activeLocale, values))
            }
          >
            Copy English
          </button>
        )}
        <button
          className="counterpulse-button-secondary"
          type="button"
          onClick={() => replaceValues(copyEnglishToAll(values))}
        >
          Copy English to all
        </button>
      </div>

      {storefrontLocales.map((localeOption) => (
        <div
          aria-labelledby={`translation-tab-${localeOption.locale}`}
          className="counterpulse-translation-panel"
          hidden={activeLocale !== localeOption.locale}
          id={`translation-panel-${localeOption.locale}`}
          key={localeOption.locale}
          role="tabpanel"
        >
          <div className="counterpulse-translation-panel__toolbar">
            <div>
              <strong>Use {localeOption.label} as source</strong>
              <small>
                Translate this copy into every other campaign language with AI.
              </small>
            </div>
            <button
              className="counterpulse-button-secondary counterpulse-ai-translation-button"
              disabled={
                isAiTranslating ||
                !hasTranslationSourceCopy(
                  localeOption.locale,
                  values,
                  resolvedValues,
                )
              }
              type="button"
              onClick={() => translateFromLocale(localeOption.locale)}
            >
              <AiTranslationIcon />
              {isAiTranslating && translatingLocale === localeOption.locale
                ? "Translating..."
                : `Translate from ${localeOption.shortLabel}`}
            </button>
          </div>

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
                  updateFieldValue(localeOption.locale, field.key, nextValue)
                }
              />
            ))}
          </div>
        </div>
      ))}

      {showActions && (
        <div className="counterpulse-actions">
          <button
            className="counterpulse-button"
            type={embedded ? "button" : "submit"}
            onClick={embedded ? () => setConfirmOpen(true) : undefined}
          >
            {isSubmitting ? "Saving..." : "Save translations"}
          </button>
        </div>
      )}
    </>
  );

  return (
    <section className="counterpulse-translations-section">
      <div className="counterpulse-translations-heading">
        <h3>Translations</h3>
        <p className="counterpulse-section-description">
          Manage locale-specific copy while keeping clear fallback text for any
          language that is not fully translated.
        </p>
      </div>

      {errors?.form && (
        <AppAlert tone="critical" title="Translations could not be saved">
          <s-paragraph>{errors.form}</s-paragraph>
        </AppAlert>
      )}

      {embedded ? (
        <>
          <div className="counterpulse-translations">{content}</div>
          <ConfirmModal
            confirmLabel="Save translations"
            open={confirmOpen}
            title="Save campaign translations?"
            tone="warning"
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false);
              submit(buildTranslationsFormData(values), { method: "post" });
            }}
          >
            <p>
              This updates localized campaign copy. Empty fields will continue
              using the resolved fallback shown in each input.
            </p>
          </ConfirmModal>
        </>
      ) : (
        <Form
          method="post"
          className="counterpulse-translations"
          onSubmit={confirmSubmit.onSubmit}
        >
          <input name="_action" type="hidden" value="saveTranslations" />
          {content}
        </Form>
      )}
      {!embedded && confirmSubmit.modal}
    </section>
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
  const inputId = `translation-${locale}-${field.key}`;

  return (
    <div
      className={
        field.multiline
          ? "counterpulse-form-field counterpulse-form-field--full"
          : "counterpulse-form-field"
      }
    >
      <label htmlFor={inputId}>{field.label}</label>
      {field.multiline ? (
        <textarea
          id={inputId}
          name={name}
          placeholder={placeholder}
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={inputId}
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
    </div>
  );
}

function updateTranslationValue(
  values: CampaignTranslationsByLocale,
  locale: StorefrontLocale,
  field: CampaignTextField,
  value: string,
) {
  return {
    ...values,
    [locale]: {
      ...values[locale],
      [field]: value,
    },
  };
}

function copyEnglishToLocale(
  locale: StorefrontLocale,
  values: CampaignTranslationsByLocale,
) {
  return {
    ...values,
    [locale]: { ...values.en },
  };
}

function copyEnglishToAll(values: CampaignTranslationsByLocale) {
  return storefrontLocales.reduce((nextValues, localeOption) => {
    nextValues[localeOption.locale] =
      localeOption.locale === "en"
        ? values.en
        : ({ ...values.en } as CampaignTranslationValues);
    return nextValues;
  }, {} as CampaignTranslationsByLocale);
}

function getTranslationValuesSignature(values: CampaignTranslationsByLocale) {
  return storefrontLocales
    .flatMap((localeOption) =>
      campaignTranslationFields.map(
        (field) => values[localeOption.locale][field.key],
      ),
    )
    .join("\u001f");
}

function buildAiTranslationFormData(
  values: CampaignTranslationsByLocale,
  resolvedValues: CampaignTranslationsByLocale,
  sourceLocale: StorefrontLocale,
) {
  const formData = new FormData();

  formData.set("_action", "translateCampaignTranslations");
  formData.set("sourceLocale", sourceLocale);
  storefrontLocales.forEach((localeOption) => {
    campaignTranslationFields.forEach((field) => {
      formData.set(
        translationInputName(localeOption.locale, field.key),
        values[localeOption.locale][field.key],
      );
    });
  });
  campaignTranslationFields.forEach((field) => {
    formData.set(
      translationFallbackInputName(sourceLocale, field.key),
      resolvedValues[sourceLocale][field.key],
    );
  });

  return formData;
}

function buildTranslationsFormData(values: CampaignTranslationsByLocale) {
  const formData = new FormData();

  formData.set("_action", "saveTranslations");
  storefrontLocales.forEach((localeOption) => {
    campaignTranslationFields.forEach((field) => {
      formData.set(
        translationInputName(localeOption.locale, field.key),
        values[localeOption.locale][field.key],
      );
    });
  });

  return formData;
}

function hasTranslationSourceCopy(
  locale: StorefrontLocale,
  values: CampaignTranslationsByLocale,
  resolvedValues: CampaignTranslationsByLocale,
) {
  return campaignTranslationFields
    .filter((field) => field.key !== "ctaUrl")
    .some((field) => {
      return (
        values[locale][field.key].trim() ||
        resolvedValues[locale][field.key].trim()
      );
    });
}

function localeLabel(locale: StorefrontLocale) {
  return storefrontLocales.find(
    (localeOption) => localeOption.locale === locale,
  )?.label;
}

function AiTranslationIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path
        d="M10 2.5 11.2 6.8 15.5 8l-4.3 1.2L10 13.5 8.8 9.2 4.5 8l4.3-1.2L10 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M15.3 12.2 16 14.1l1.9.6-1.9.6-.7 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z"
        fill="currentColor"
      />
    </svg>
  );
}
