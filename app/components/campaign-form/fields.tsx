import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  } from "react";

import {
  type PreviewPlacement,
} from "../CampaignPreviewPanel";
import type {} from "../DevicePreviewToggle";
import {
  campaignTypeOptions,
  placementTypeOptions,
  type CampaignTypeValue,
  type PlacementTypeValue,
} from "../../types/campaign-options";
import type {
  CampaignTargetingOptions,
  CampaignFormErrors,
  CampaignFormValues,
  } from "../../types/campaign-form";
import {
  defaultCampaignFormValues,
  splitCampaignList,
} from "../../types/campaign-form";
import {
  type CartRescueReasonValue,
  } from "../../types/cart-rescue";
import {
  campaignTranslationFields,
  getStorefrontLocaleLabel,
  getStorefrontLocaleOptions,
  translationInputName,
  type CampaignTranslationFormErrors,
  type CampaignTranslationsByLocale,
  type StorefrontLocaleOption,
} from "../../types/localization";
import { getDefaultCampaignTranslationValues } from "../../utils/campaign-localization";
import type {} from "../../types/ai-campaign";
import {
  MESSAGE_VARIABLES,
  messageVariableScopeLabel,
  variableScopesForType,
} from "../../utils/message-variables";
import { BuilderTabKey, CampaignSetupPreset, ResourceChip, ResourceFieldName, ShopifyResourcePickerResult, ShopifyResourcePickerType, UrlEligibilityMode, UrlPageTargetingToken, goalIconLabels, urlPageTargetingOptions, urlPageTargetingTokenSet } from "./constants";

export function applySetupPreset(
  values: CampaignFormValues,
  preset: CampaignSetupPreset,
): CampaignFormValues {
  const timerMode =
    preset.form?.timerMode ?? defaultCampaignFormValues.timerMode;

  return {
    ...defaultCampaignFormValues,
    goal: values.goal,
    type: values.type,
    name: values.name,
    status: values.status,
    timezone: values.timezone,
    productSelection: values.productSelection,
    productIds: values.productIds,
    excludeProductIds: values.excludeProductIds,
    collectionIds: values.collectionIds,
    productTags: values.productTags,
    countrySelection: values.countrySelection,
    countries: values.countries,
    urlContains: values.urlContains,
    excludedUrlContains: values.excludedUrlContains,
    ...preset.form,
    ...(preset.goal ? { goal: preset.goal } : {}),
    ...(preset.type ? { type: preset.type } : {}),
    startsAt:
      timerMode !== "FIXED_DATE"
        ? ""
        : (preset.form?.startsAt ?? values.startsAt),
    endsAt:
      timerMode !== "FIXED_DATE" ? "" : (preset.form?.endsAt ?? values.endsAt),
    placementType: preset.placementType,
    placementTypes: [preset.placementType],
  };
}

export function getVisibleFreeShippingDiscountCode(values: CampaignFormValues) {
  if (!values.freeShippingShowDiscountCode) return null;

  const existingReference = values.freeShippingExistingDiscount.trim();
  if (isFreeShippingCodeReference(existingReference)) {
    return existingReference.toUpperCase();
  }

  const legacyCode = values.freeShippingDiscountCode.trim();
  return legacyCode ? legacyCode.toUpperCase() : null;
}

export function isFreeShippingCodeReference(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return false;
  if (/^gid:\/\/shopify\/Discount/i.test(trimmed)) return false;

  return /^[A-Z0-9_-]{3,80}$/i.test(trimmed);
}

export function buildCampaignTypeDefaultTranslations(
  values: CampaignFormValues,
  localeOptions: readonly StorefrontLocaleOption[],
) {
  return localeOptions.reduce((translations, localeOption) => {
    translations[localeOption.locale] = {
      ...getDefaultCampaignTranslationValues(
        values.goal,
        values.type,
        localeOption.locale,
      ),
    };
    return translations;
  }, {} as CampaignTranslationsByLocale);
}

export function resolveCampaignTranslationValues(
  values: CampaignTranslationsByLocale,
  fallbackValues?: CampaignTranslationsByLocale,
  localeOptions: readonly StorefrontLocaleOption[] = getStorefrontLocaleOptions(),
) {
  const fallbackLocale = localeOptions[0]?.locale ?? "en";

  return localeOptions.reduce((resolvedValues, localeOption) => {
    const locale = localeOption.locale;

    campaignTranslationFields.forEach((field) => {
      resolvedValues[locale][field.key] =
        values[locale]?.[field.key] ||
        values[fallbackLocale]?.[field.key] ||
        values.en?.[field.key] ||
        fallbackValues?.[locale]?.[field.key] ||
        fallbackValues?.[fallbackLocale]?.[field.key] ||
        fallbackValues?.en?.[field.key] ||
        "";
    });

    return resolvedValues;
  }, buildEmptyResolvedTranslations(localeOptions));
}

export function buildEmptyResolvedTranslations(
  localeOptions: readonly StorefrontLocaleOption[],
) {
  return localeOptions.reduce((translations, localeOption) => {
    translations[localeOption.locale] =
      {} as CampaignTranslationsByLocale[string];
    return translations;
  }, {} as CampaignTranslationsByLocale);
}

export function getTranslationValuesSignature(
  values: CampaignTranslationsByLocale,
  localeOptions: readonly StorefrontLocaleOption[],
) {
  return localeOptions
    .flatMap((localeOption) =>
      campaignTranslationFields.map(
        (field) => values[localeOption.locale]?.[field.key] ?? "",
      ),
    )
    .join("\u001f");
}

export function getCampaignTypeChoiceKey(values: CampaignFormValues) {
  if (values.type === "PRODUCT_TIMER") return "PRODUCT_TIMER";
  if (values.goal === "ANNOUNCEMENT") return "ANNOUNCEMENT";

  return values.goal;
}

export function BuilderPanel({
  activeTab,
  children,
  panelId,
  shouldRender,
  tabId,
  tabKey,
}: {
  activeTab: BuilderTabKey;
  children: ReactNode;
  panelId: string;
  shouldRender: boolean;
  tabId: string;
  tabKey: BuilderTabKey;
}) {
  return (
    <div
      aria-labelledby={tabId}
      className="counterpulse-builder-panel"
      hidden={activeTab !== tabKey || !shouldRender}
      id={panelId}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

export function TabSummaryGrid({ rows }: { rows: string[][] }) {
  return (
    <dl className="counterpulse-tab-summary">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function UrlPageTargetingPicker({
  description,
  selectedTokens,
  title,
  onToggle,
}: {
  description: string;
  selectedTokens: UrlPageTargetingToken[];
  title: string;
  onToggle: (token: UrlPageTargetingToken, checked: boolean) => void;
}) {
  return (
    <div className="counterpulse-url-page-targeting">
      <div
        className="counterpulse-url-page-targeting__header"
        aria-label={title}
        role="group"
      >
        <strong>{title}</strong>
        <span>{description}</span>
        <div className="counterpulse-url-page-options">
          {urlPageTargetingOptions.map((option) => {
            const checked = selectedTokens.includes(option.token);

            return (
              <label
                className={
                  checked
                    ? "counterpulse-url-page-option is-selected"
                    : "counterpulse-url-page-option"
                }
                key={option.token}
              >
                <input
                  aria-label={option.label}
                  checked={checked}
                  type="checkbox"
                  onChange={(event) =>
                    onToggle(option.token, event.currentTarget.checked)
                  }
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                  <code>{option.example}</code>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function selectedUrlPageTargetingTokens(
  value: string | undefined,
): UrlPageTargetingToken[] {
  const selected = new Set(
    splitCampaignList(value ?? "")
      .map((item) => item.toLowerCase())
      .filter((item) => urlPageTargetingTokenSet.has(item)),
  );

  return urlPageTargetingOptions
    .map((option) => option.token)
    .filter((token) => selected.has(token));
}

export function manualUrlTargetingItems(value: string | undefined) {
  return splitCampaignList(value ?? "").filter(
    (item) => !urlPageTargetingTokenSet.has(item.toLowerCase()),
  );
}

export function manualUrlTargetingText(value: string | undefined) {
  return manualUrlTargetingItems(value).join("\n");
}

export function getInitialUrlEligibilityMode(
  values: Pick<CampaignFormValues, "urlContains" | "excludedUrlContains">,
): UrlEligibilityMode {
  return getUrlEligibilityModeFromValues(values) ?? "include";
}

export function getUrlEligibilityModeFromValues(
  values: Pick<CampaignFormValues, "urlContains" | "excludedUrlContains">,
): UrlEligibilityMode | null {
  const includeCount = splitCampaignList(values.urlContains ?? "").length;
  const excludeCount = splitCampaignList(
    values.excludedUrlContains ?? "",
  ).length;

  if (excludeCount > 0 && includeCount === 0) return "exclude";
  if (includeCount > 0 && excludeCount === 0) return "include";

  return null;
}

export function toggleUrlPageTargetingToken(
  currentTokens: UrlPageTargetingToken[],
  token: UrlPageTargetingToken,
  checked: boolean,
) {
  const nextTokens = new Set(currentTokens);

  if (checked) {
    nextTokens.add(token);
  } else {
    nextTokens.delete(token);
  }

  return urlPageTargetingOptions
    .map((option) => option.token)
    .filter((optionToken) => nextTokens.has(optionToken));
}

export function mergeUrlTargetingValue(
  pageTokens: UrlPageTargetingToken[],
  manualItems: string[],
) {
  return [...pageTokens, ...manualItems].join("\n");
}

export function TargetingRadioOption({
  checked,
  children,
  description,
  disabled,
  lockReason,
  name,
  onSelect,
  title,
  value,
}: {
  checked: boolean;
  children?: ReactNode;
  description?: string;
  disabled: boolean;
  lockReason?: string;
  name: "productSelection" | "countrySelection";
  onSelect: () => void;
  title: string;
  value: string;
}) {
  const lockedMessage = disabled ? (lockReason ?? "") : "";

  return (
    <div
      className={[
        "counterpulse-targeting-option",
        checked ? "is-selected" : "",
        disabled ? "is-disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <label>
        <input
          checked={checked}
          disabled={disabled}
          name={name}
          type="radio"
          value={value}
          onChange={onSelect}
        />
        <span>
          <strong>{title}</strong>
          {description && <small>{description}</small>}
          {lockedMessage && <UpgradeText reason={lockedMessage} />}
        </span>
      </label>
      {checked && children && (
        <div className="counterpulse-targeting-option__content">{children}</div>
      )}
    </div>
  );
}

export function ResourcePickerField({
  chips,
  disabled = false,
  error,
  label,
  name,
  onManualChange,
  onOpenPicker,
  onRemove,
  pickerLabel,
  value,
}: {
  chips: ResourceChip[];
  disabled?: boolean;
  error?: string;
  label: string;
  name: ResourceFieldName;
  onManualChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onOpenPicker: () => void;
  onRemove: (id: string) => void;
  pickerLabel: string;
  value: string;
}) {
  return (
    <div className="counterpulse-targeting-field">
      <input name={name} type="hidden" value={value} />
      <span>{label}</span>
      <button
        className="counterpulse-picker-button"
        type="button"
        disabled={disabled}
        onClick={onOpenPicker}
      >
        {pickerLabel}
      </button>
      <ChipList
        chips={chips}
        emptyLabel="No items selected"
        onRemove={onRemove}
      />
      <details className="counterpulse-manual-entry">
        <summary>Paste IDs manually</summary>
        <textarea
          rows={3}
          value={value}
          placeholder="gid://shopify/Product/123456789"
          onChange={onManualChange}
        />
      </details>
      <FieldError message={error} />
    </div>
  );
}

export function TagSelectorField({
  error,
  matchingTags,
  onAddTag,
  onManualChange,
  onQueryChange,
  onRemoveTag,
  onSelectFirst,
  query,
  searchId,
  selectedTags,
  value,
}: {
  error?: string;
  matchingTags: string[];
  onAddTag: (tag: string) => void;
  onManualChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onQueryChange: (value: string) => void;
  onRemoveTag: (tag: string) => void;
  onSelectFirst: (event: KeyboardEvent<HTMLInputElement>) => void;
  query: string;
  searchId: string;
  selectedTags: string[];
  value: string;
}) {
  return (
    <div className="counterpulse-targeting-field">
      <input name="productTags" type="hidden" value={value} />
      <label htmlFor={searchId}>Product tags</label>
      <div className="counterpulse-combo-field">
        <input
          id={searchId}
          value={query}
          placeholder="Search product tags"
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onKeyDown={onSelectFirst}
        />
        {query.trim() && (
          <div className="counterpulse-combo-results">
            {matchingTags.length > 0 ? (
              matchingTags.map((tag) => (
                <button key={tag} type="button" onClick={() => onAddTag(tag)}>
                  {tag}
                </button>
              ))
            ) : (
              <span>No matching tags from Shopify</span>
            )}
          </div>
        )}
      </div>
      <ChipList
        chips={selectedTags.map((tag) => ({ id: tag, label: tag }))}
        emptyLabel="No tags selected"
        onRemove={onRemoveTag}
      />
      <details className="counterpulse-manual-entry">
        <summary>Paste tags manually</summary>
        <textarea
          rows={3}
          value={value}
          placeholder="sale, limited, preorder"
          onChange={onManualChange}
        />
      </details>
      <FieldError message={error} />
    </div>
  );
}

export function CountrySelectorField({
  countries,
  countryLabelsByCode,
  error,
  onAddCountry,
  onManualChange,
  onQueryChange,
  onRemoveCountry,
  onSelectFirst,
  query,
  searchId,
  selectedCountries,
  value,
}: {
  countries: CampaignTargetingOptions["countries"];
  countryLabelsByCode: Map<string, string>;
  error?: string;
  onAddCountry: (code: string) => void;
  onManualChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onQueryChange: (value: string) => void;
  onRemoveCountry: (code: string) => void;
  onSelectFirst: (event: KeyboardEvent<HTMLInputElement>) => void;
  query: string;
  searchId: string;
  selectedCountries: string[];
  value: string;
}) {
  return (
    <div className="counterpulse-targeting-field">
      <input name="countries" type="hidden" value={value} />
      <label htmlFor={searchId}>Countries</label>
      <div className="counterpulse-combo-field">
        <input
          id={searchId}
          value={query}
          placeholder="Search Shopify countries"
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onKeyDown={onSelectFirst}
        />
        {query.trim() && (
          <div className="counterpulse-combo-results">
            {countries.length > 0 ? (
              countries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => onAddCountry(country.code)}
                >
                  {country.name} <span>{country.code}</span>
                </button>
              ))
            ) : (
              <span>No matching countries from Shopify</span>
            )}
          </div>
        )}
      </div>
      <ChipList
        chips={selectedCountries.map((code) => ({
          id: code,
          label: countryLabelsByCode.get(code)
            ? `${countryLabelsByCode.get(code)} (${code})`
            : code,
        }))}
        emptyLabel="No countries selected"
        onRemove={onRemoveCountry}
      />
      <details className="counterpulse-manual-entry">
        <summary>Paste country codes manually</summary>
        <textarea
          rows={3}
          value={value}
          placeholder="US, CA, GB"
          onChange={onManualChange}
        />
      </details>
      <FieldError message={error} />
    </div>
  );
}

export function ChipList({
  chips,
  emptyLabel,
  onRemove,
}: {
  chips: ResourceChip[];
  emptyLabel: string;
  onRemove: (id: string) => void;
}) {
  if (chips.length === 0) {
    return <small>{emptyLabel}</small>;
  }

  return (
    <div className="counterpulse-chip-list">
      {chips.map((chip) => (
        <span className="counterpulse-chip" key={chip.id}>
          {chip.label}
          <button
            aria-label={`Remove ${chip.label}`}
            type="button"
            onClick={() => onRemove(chip.id)}
          >
            x
          </button>
        </span>
      ))}
    </div>
  );
}

export function UpgradeText({ reason }: { reason: string }) {
  return (
    <small className="counterpulse-upgrade-inline">
      {reason} <a href="/app/billing">Upgrade</a>
    </small>
  );
}

export function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <rect
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        width="13"
        x="8"
        y="8"
      />
      <path
        d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function CampaignInfoContent({
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

export function MessageVariablesInfo({ type }: { type: CampaignFormValues["type"] }) {
  const scopes = variableScopesForType(type);
  const variablesByScope = scopes
    .map((scope) => ({
      scope,
      label: messageVariableScopeLabel(scope),
      variables: MESSAGE_VARIABLES.filter(
        (variable) => variable.scope === scope,
      ),
    }))
    .filter((group) => group.variables.length > 0);

  return (
    <div className="counterpulse-info-copy">
      <p>
        Wrap a variable in double curly braces to insert live data into your
        headline, subheadline, CTA, any message — or directly into the custom
        HTML structure. Unknown variables are left untouched.
      </p>

      {variablesByScope.map((group) => (
        <div className="counterpulse-message-variables" key={group.scope}>
          <strong className="counterpulse-message-variables__title">
            {group.label}
          </strong>
          <ul className="counterpulse-message-variables__list">
            {group.variables.map((variable) => (
              <li key={variable.token}>
                <code>{`{{${variable.token}}}`}</code>
                <span>{variable.description}</span>
                <em>
                  renders as <b>{variable.example}</b>
                </em>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function GoalIcon({ goal }: { goal: CampaignFormValues["goal"] }) {
  const title = goalIconLabels[goal];

  return (
    <svg
      aria-label={title}
      fill="none"
      height="22"
      role="img"
      viewBox="0 0 24 24"
      width="22"
    >
      {goal === "FLASH_SALE" && (
        <path
          d="M13 2 5 13h6l-1 9 9-13h-6l1-7Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {goal === "FREE_SHIPPING" && (
        <>
          <path
            d="M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      )}
      {goal === "CART_RESCUE" && (
        <path
          d="M5 5h2l2 10h8l2-7H8m3 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm6 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM4 12l-2 2 2 2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {goal === "DELIVERY_CUTOFF" && (
        <>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 7v5l3 2"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {goal === "LOW_STOCK_URGENCY" && (
        <path
          d="M12 3 3 20h18L12 3Zm0 6v5m0 3h.01"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {goal === "PRODUCT_BADGE" && (
        <path
          d="M4 7V4h3m10 0h3v3M4 17v3h3m10 0h3v-3M8 8h8v8H8V8Zm2.5 4h3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
      {goal === "ANNOUNCEMENT" && (
        <path
          d="M4 10v4h4l8 4V6l-8 4H4Zm12 0 4-2v8l-4-2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

export function CartRescueReasonIcon({ reason }: { reason: CartRescueReasonValue }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="22"
      viewBox="0 0 24 24"
      width="22"
    >
      {reason === "CART_RESERVED" && (
        <>
          <path
            d="M5 5h2l2 10h8l2-7H8"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M9 19h8m-4-6v-3m0 0-1.5 1.5M13 10l1.5 1.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {reason === "CHECKOUT_REMINDER" && (
        <>
          <path
            d="M5 5h14v14H5V5Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="m8 12 2.5 2.5L16 9"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
}

export function CampaignTypeIcon({ type }: { type: CampaignTypeValue }) {
  const title =
    campaignTypeOptions.find((option) => option.value === type)?.label ?? type;

  return (
    <svg
      aria-label={title}
      fill="none"
      height="22"
      role="img"
      viewBox="0 0 24 24"
      width="22"
    >
      {type === "COUNTDOWN_BAR" && (
        <>
          <path
            d="M4 7h16v10H4z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M9 12h6M17 12h.01"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {type === "PRODUCT_TIMER" && (
        <>
          <path
            d="M5 6h6l8 8-6 6-8-8V6Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <circle cx="9" cy="10" r="1.3" fill="currentColor" />
          <path
            d="M14 11v3l2 1"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {type === "CART_TIMER" && (
        <>
          <path
            d="M5 5h2l2 10h8l2-7H8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M12 9v3l2 1M11 19h.01M17 19h.01"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {type === "FREE_SHIPPING_GOAL" && (
        <>
          <path
            d="M3 8h10v8H3V8Zm10 3h4l3 3v2h-7v-5Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M6 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      )}
      {type === "DELIVERY_CUTOFF" && (
        <>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 7v5l4 2"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {type === "LOW_STOCK" && (
        <>
          <path
            d="M5 8h14v11H5zM8 5h8l1 3H7l1-3Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M9 13h6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      )}
      {type === "PRODUCT_BADGE" && (
        <path
          d="M4 7V4h3m10 0h3v3M4 17v3h3m10 0h3v-3M8 8h8v8H8V8Zm2.5 4h3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

export function placementInitial(label: string) {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Badge placements render a small badge over product media, while every other
// surface renders a banner/card. A single design can't be tuned well for both,
// so we warn the merchant to split them into separate campaigns.
export const badgePlacementTypes: PlacementTypeValue[] = [
  "PRODUCT_PAGE_BADGE",
  "COLLECTION_CARD",
];

export function getIncompatiblePlacementWarning(placements: PlacementTypeValue[]) {
  const badge = placements.filter((placement) =>
    badgePlacementTypes.includes(placement),
  );
  const nonBadge = placements.filter(
    (placement) => !badgePlacementTypes.includes(placement),
  );

  if (badge.length === 0 || nonBadge.length === 0) return null;

  const labelFor = (placement: PlacementTypeValue) =>
    placementTypeOptions.find((option) => option.value === placement)?.label ??
    placement;

  return {
    badgeLabels: badge.map(labelFor),
    nonBadgeLabels: nonBadge.map(labelFor),
  };
}

export function formatPlacementSelectionLabel(placements: PlacementTypeValue[]) {
  const labels = placements.map(
    (placement) =>
      placementTypeOptions.find((option) => option.value === placement)
        ?.label ?? placement,
  );

  return labels.length > 0 ? labels.join(" + ") : "No placement";
}

export function toPreviewPlacement(
  placementType: CampaignFormValues["placementType"],
  campaignType?: CampaignFormValues["type"],
): PreviewPlacement {
  if (campaignType === "PRODUCT_BADGE") return "PRODUCT_BADGE";
  if (placementType === "BOTTOM_BAR") return "BOTTOM_BAR";
  if (placementType === "PRODUCT_PAGE") return "PRODUCT_PAGE";
  if (placementType === "CART_PAGE") return "CART_PAGE";
  if (placementType === "CART_DRAWER") return "CART_DRAWER";
  if (placementType === "PRODUCT_PAGE_BADGE") return "PRODUCT_BADGE";
  if (placementType === "COLLECTION_CARD") return "PRODUCT_BADGE";
  if (placementType === "CUSTOM_SELECTOR") return "PRODUCT_PAGE";

  return "TOP_BAR";
}

export function formatDateTimeLabel(value: string, fallback: string) {
  return value ? value.replace("T", " ") : fallback;
}

export function toDateTimeLocalInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function buildResourceChips(value: string): ResourceChip[] {
  return splitCampaignList(value).map((id) => ({
    id,
    label: shortResourceId(id),
  }));
}

export function shortResourceId(value: string | undefined) {
  if (!value) return "";
  const parts = value.split("/").filter(Boolean);

  return parts[parts.length - 1] ?? value;
}

export function isSelectableResourceId(type: ShopifyResourcePickerType, id: string) {
  const resourceType = type === "product" ? "Product" : "Collection";

  return id.includes(`/shopify/${resourceType}/`);
}

export function normalizeSelectableResourceId(
  type: ShopifyResourcePickerType,
  id: string | undefined,
) {
  if (!id || !isSelectableResourceId(type, id)) return "";

  return id;
}

export const campaignErrorFieldLabels: Partial<
  Record<keyof CampaignFormValues, string>
> = {
  badgePosition: "Badge position",
  badgeShape: "Badge shape",
  badgeText: "Badge text",
  cartRescueReason: "Cart rescue reason",
  cartRescueShowButton: "Cart rescue button",
  cartRescueShowTimer: "Cart rescue timer",
  cartRescueTimerStart: "Cart rescue countdown start",
  cartRescueArmBeforeStart: "Cart rescue arm before start",
  cartTimerDurationMinutes: "Cart timer minutes",
  collectionIds: "Collections",
  countries: "Countries",
  ctaText: "CTA text",
  ctaUrl: "CTA URL",
  customSelector: "Custom selector",
  customStyle: "Custom placement style",
  deliveryAfterCutoffBehavior: "After cutoff behavior",
  deliveryCutoffHour: "Cutoff hour",
  deliveryCutoffMinute: "Cutoff minute",
  deliveryMaxDays: "Maximum delivery days",
  deliveryMinDays: "Minimum delivery days",
  deliveryProcessingDays: "Processing days",
  deliveryWorkingDays: "Fulfillment days",
  endsAt: "End date",
  excludeProductIds: "Excluded products",
  excludedUrlContains: "Excluded URLs",
  expiredText: "Expired text",
  freeShippingAutoDiscount: "Automatic free shipping",
  freeShippingCurrencyCode: "Free shipping currency",
  freeShippingDiscountCode: "Free shipping discount code",
  freeShippingExistingDiscount: "Existing free shipping discount",
  freeShippingDiscountTitle: "Free shipping discount title",
  freeShippingEmptyCartMessage: "Empty cart message",
  freeShippingSuccessMessage: "Success message",
  freeShippingThresholdAmount: "Free shipping threshold",
  headline: "Headline",
  lowStockFallbackMessage: "Low stock fallback message",
  lowStockThreshold: "Low stock threshold",
  name: "Campaign name",
  placementType: "Campaign placement",
  placementTypes: "Campaign placements",
  productIds: "Products",
  productTags: "Product tags",
  startsAt: "Start date",
  status: "Campaign status",
  subheadline: "Subheadline",
  timerDurationMinutes: "Timer minutes",
  timerExpiredBehavior: "After expiration",
  timerRecurringHour: "Recurring time",
  timezone: "Timezone",
  urlContains: "Included URLs",
};

export function buildCampaignErrorSummary(
  errors: CampaignFormErrors,
  translationErrors?: CampaignTranslationFormErrors,
) {
  const messages: string[] = [];
  const seenMessages = new Set<string>();
  const pushMessage = (message: unknown, label?: string) => {
    if (typeof message !== "string") return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    const summaryMessage = label
      ? `${label}: ${trimmedMessage}`
      : trimmedMessage;

    if (seenMessages.has(summaryMessage)) return;

    seenMessages.add(summaryMessage);
    messages.push(summaryMessage);
  };

  pushMessage(errors.form);
  Object.entries(errors).forEach(([field, message]) => {
    if (field === "form") return;

    pushMessage(message, getCampaignErrorFieldLabel(field));
  });

  pushMessage(translationErrors?.form, "Messages");
  Object.entries(translationErrors?.locales ?? {}).forEach(
    ([locale, localeErrors]) => {
      const localeLabel = getStorefrontLocaleLabel(locale);

      Object.entries(localeErrors ?? {}).forEach(([field, message]) => {
        pushMessage(
          message,
          `${localeLabel} ${getCampaignTranslationErrorFieldLabel(field)}`,
        );
      });
    },
  );

  return messages;
}

export function getCampaignErrorFieldLabel(field: string) {
  return (
    campaignErrorFieldLabels[field as keyof CampaignFormValues] ??
    humanizeFieldName(field)
  );
}

export function getCampaignTranslationErrorFieldLabel(field: string) {
  return (
    campaignTranslationFields.find((option) => option.key === field)?.label ??
    humanizeFieldName(field)
  );
}

export function humanizeFieldName(field: string) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (firstCharacter) => firstCharacter.toUpperCase());
}

export function getShopifyBridge() {
  return (
    window as Window & {
      shopify?: {
        resourcePicker?: (options: {
          action?: "add" | "select";
          filter?: {
            variants?: boolean;
          };
          multiple?: boolean | number;
          selectionIds?: Array<{ id: string }>;
          type: ShopifyResourcePickerType;
        }) => Promise<ShopifyResourcePickerResult | undefined>;
      };
    }
  ).shopify;
}

export function CampaignMessageHiddenInputs({
  localeOptions,
  values,
  translations,
}: {
  localeOptions: readonly StorefrontLocaleOption[];
  values: CampaignFormValues;
  translations?: CampaignTranslationsByLocale;
}) {
  return (
    <>
      <input name="headline" type="hidden" value={values.headline} />
      <input name="subheadline" type="hidden" value={values.subheadline} />
      <input name="ctaText" type="hidden" value={values.ctaText} />
      <input name="ctaUrl" type="hidden" value={values.ctaUrl} />
      <input name="expiredText" type="hidden" value={values.expiredText} />
      {translations
        ? localeOptions.flatMap((localeOption) => [
            <input
              key={`${localeOption.locale}-locale`}
              name="translationLocale"
              type="hidden"
              value={localeOption.locale}
            />,
            ...campaignTranslationFields.map((field) => (
              <input
                key={`${localeOption.locale}-${field.key}`}
                name={translationInputName(localeOption.locale, field.key)}
                type="hidden"
                value={translations[localeOption.locale]?.[field.key] ?? ""}
              />
            )),
          ])
        : null}
    </>
  );
}

export function FormField({
  label,
  error,
  children,
  info,
  fullWidth = false,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  info?: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={
        fullWidth
          ? "counterpulse-form-field counterpulse-form-field--full"
          : "counterpulse-form-field"
      }
    >
      <span className="counterpulse-field-label-row">
        <span>{label}</span>
        {info}
      </span>
      <label className="counterpulse-field-control">
        <span className="counterpulse-sr-only">{label}</span>
        {children}
      </label>
      <FieldError message={error} />
    </div>
  );
}

export function FormGroup({
  label,
  error,
  children,
  info,
  fullWidth = false,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  info?: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={
        fullWidth
          ? "counterpulse-form-field counterpulse-form-field--full"
          : "counterpulse-form-field"
      }
    >
      <span className="counterpulse-field-label-row">
        <span>{label}</span>
        {info}
      </span>
      {children}
      <FieldError message={error} />
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <span className="counterpulse-form-error">{message}</span>;
}

