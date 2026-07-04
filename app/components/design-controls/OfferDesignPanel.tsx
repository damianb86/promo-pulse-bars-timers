
import {
  designOfferApplyBehaviorOptions,
  designOfferCodeLayoutOptions,
  designOfferCopyBehaviorOptions,
  type CampaignDesignErrors,
  type CampaignDesignValues,
} from "../../types/campaign-design";
import { ColorDesignKey, ColorField, DesignField, DesignGroup, DesignPanel, MissingElement, NumberDesignKey, NumberField, ToggleField } from "./shared";

export function OfferDesignPanel({
  values,
  errors,
  missingElements,
  onValueChange,
  onNumberChange,
  onColorChange,
}: {
  values: CampaignDesignValues;
  errors: CampaignDesignErrors;
  missingElements?: MissingElement[] | null;
  onValueChange: <Key extends keyof CampaignDesignValues>(
    key: Key,
    value: CampaignDesignValues[Key],
  ) => void;
  onNumberChange: (key: NumberDesignKey, value: string) => void;
  onColorChange: (key: ColorDesignKey, value: string) => void;
}) {
  return (
    <DesignPanel title="Offer code" missingElements={missingElements}>
      <div className="counterpulse-toggle-grid">
        <ToggleField
          checked={values.showDiscountCode}
          label="Show code"
          name="showDiscountCode"
          onChange={(checked) => onValueChange("showDiscountCode", checked)}
        />
        <ToggleField
          checked={values.showCopyCodeButton}
          label="Show copy button"
          name="showCopyCodeButton"
          onChange={(checked) => onValueChange("showCopyCodeButton", checked)}
        />
        <ToggleField
          checked={values.showApplyDiscountButton}
          label="Show apply button"
          name="showApplyDiscountButton"
          onChange={(checked) =>
            onValueChange("showApplyDiscountButton", checked)
          }
        />
      </div>

      <DesignGroup error={errors.offerCodeLayout} label="Layout">
        <div className="counterpulse-segmented counterpulse-segmented--compact counterpulse-segmented--fit">
          {designOfferCodeLayoutOptions.map((option) => (
            <button
              className={
                values.offerCodeLayout === option.value ? "is-active" : ""
              }
              key={option.value}
              type="button"
              onClick={() => onValueChange("offerCodeLayout", option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <input
          name="offerCodeLayout"
          type="hidden"
          value={values.offerCodeLayout}
        />
      </DesignGroup>

      <div className="counterpulse-form-grid counterpulse-form-grid--wide">
        <DesignField label="Code label" error={errors.offerCodeLabel}>
          <input
            maxLength={32}
            name="offerCodeLabel"
            value={values.offerCodeLabel}
            onChange={(event) =>
              onValueChange("offerCodeLabel", event.target.value)
            }
          />
        </DesignField>
        <DesignField label="Copy label" error={errors.copyCodeLabel}>
          <input
            maxLength={24}
            name="copyCodeLabel"
            value={values.copyCodeLabel}
            onChange={(event) =>
              onValueChange("copyCodeLabel", event.target.value)
            }
          />
        </DesignField>
        <DesignField label="Copied label" error={errors.copiedCodeLabel}>
          <input
            maxLength={24}
            name="copiedCodeLabel"
            value={values.copiedCodeLabel}
            onChange={(event) =>
              onValueChange("copiedCodeLabel", event.target.value)
            }
          />
        </DesignField>
        <DesignField label="Apply label" error={errors.applyDiscountLabel}>
          <input
            maxLength={28}
            name="applyDiscountLabel"
            value={values.applyDiscountLabel}
            onChange={(event) =>
              onValueChange("applyDiscountLabel", event.target.value)
            }
          />
        </DesignField>
        <DesignField
          label="Applied message"
          error={errors.appliedDiscountMessage}
        >
          <input
            maxLength={80}
            name="appliedDiscountMessage"
            value={values.appliedDiscountMessage}
            onChange={(event) =>
              onValueChange("appliedDiscountMessage", event.target.value)
            }
          />
        </DesignField>
      </div>

      <div className="counterpulse-form-grid counterpulse-form-grid--wide">
        <ColorField
          error={errors.offerCodeTextColor}
          label="Code text"
          name="offerCodeTextColor"
          value={values.offerCodeTextColor}
          onChange={(value) => onColorChange("offerCodeTextColor", value)}
        />
        <ColorField
          error={errors.offerCodeBackgroundColor}
          label="Code background"
          name="offerCodeBackgroundColor"
          value={values.offerCodeBackgroundColor}
          onChange={(value) => onColorChange("offerCodeBackgroundColor", value)}
        />
        <ColorField
          error={errors.offerCodeBorderColor}
          label="Code border"
          name="offerCodeBorderColor"
          value={values.offerCodeBorderColor}
          onChange={(value) => onColorChange("offerCodeBorderColor", value)}
        />
        <NumberField
          error={errors.offerCodeFontSize}
          label="Code text size"
          max={24}
          min={10}
          name="offerCodeFontSize"
          value={values.offerCodeFontSize}
          onChange={(value) => onNumberChange("offerCodeFontSize", value)}
        />
        <NumberField
          error={errors.offerCodeBorderRadius}
          label="Code radius"
          max={40}
          min={0}
          name="offerCodeBorderRadius"
          value={values.offerCodeBorderRadius}
          onChange={(value) => onNumberChange("offerCodeBorderRadius", value)}
        />
        <NumberField
          error={errors.offerCodePaddingBlock}
          label="Code vertical padding"
          max={24}
          min={2}
          name="offerCodePaddingBlock"
          value={values.offerCodePaddingBlock}
          onChange={(value) => onNumberChange("offerCodePaddingBlock", value)}
        />
        <NumberField
          error={errors.offerCodePaddingInline}
          label="Code horizontal padding"
          max={32}
          min={4}
          name="offerCodePaddingInline"
          value={values.offerCodePaddingInline}
          onChange={(value) => onNumberChange("offerCodePaddingInline", value)}
        />
        <NumberField
          error={errors.offerCodeGap}
          label="Offer gap"
          max={24}
          min={0}
          name="offerCodeGap"
          value={values.offerCodeGap}
          onChange={(value) => onNumberChange("offerCodeGap", value)}
        />
      </div>

      <div className="counterpulse-form-grid counterpulse-form-grid--wide">
        <DesignField label="After copy" error={errors.offerCopyBehavior}>
          <select
            name="offerCopyBehavior"
            value={values.offerCopyBehavior}
            onChange={(event) =>
              onValueChange(
                "offerCopyBehavior",
                event.target.value as CampaignDesignValues["offerCopyBehavior"],
              )
            }
          >
            {designOfferCopyBehaviorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </DesignField>
        <DesignField label="After apply" error={errors.offerApplyBehavior}>
          <select
            name="offerApplyBehavior"
            value={values.offerApplyBehavior}
            onChange={(event) =>
              onValueChange(
                "offerApplyBehavior",
                event.target
                  .value as CampaignDesignValues["offerApplyBehavior"],
              )
            }
          >
            {designOfferApplyBehaviorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </DesignField>
      </div>
    </DesignPanel>
  );
}

export function OfferDesignHiddenInputs({ values }: { values: CampaignDesignValues }) {
  return (
    <>
      <input
        name="showDiscountCode"
        type="hidden"
        value={String(values.showDiscountCode)}
      />
      <input
        name="showCopyCodeButton"
        type="hidden"
        value={String(values.showCopyCodeButton)}
      />
      <input
        name="showApplyDiscountButton"
        type="hidden"
        value={String(values.showApplyDiscountButton)}
      />
      <input
        name="offerCodeLayout"
        type="hidden"
        value={values.offerCodeLayout}
      />
      <input
        name="offerCodeLabel"
        type="hidden"
        value={values.offerCodeLabel}
      />
      <input name="copyCodeLabel" type="hidden" value={values.copyCodeLabel} />
      <input
        name="copiedCodeLabel"
        type="hidden"
        value={values.copiedCodeLabel}
      />
      <input
        name="applyDiscountLabel"
        type="hidden"
        value={values.applyDiscountLabel}
      />
      <input
        name="appliedDiscountMessage"
        type="hidden"
        value={values.appliedDiscountMessage}
      />
      <input
        name="offerCodeTextColor"
        type="hidden"
        value={values.offerCodeTextColor}
      />
      <input
        name="offerCodeBackgroundColor"
        type="hidden"
        value={values.offerCodeBackgroundColor}
      />
      <input
        name="offerCodeBorderColor"
        type="hidden"
        value={values.offerCodeBorderColor}
      />
      <input
        name="offerCodeFontSize"
        type="hidden"
        value={values.offerCodeFontSize}
      />
      <input
        name="offerCodeBorderRadius"
        type="hidden"
        value={values.offerCodeBorderRadius}
      />
      <input
        name="offerCodePaddingBlock"
        type="hidden"
        value={values.offerCodePaddingBlock}
      />
      <input
        name="offerCodePaddingInline"
        type="hidden"
        value={values.offerCodePaddingInline}
      />
      <input name="offerCodeGap" type="hidden" value={values.offerCodeGap} />
      <input
        name="offerCopyBehavior"
        type="hidden"
        value={values.offerCopyBehavior}
      />
      <input
        name="offerApplyBehavior"
        type="hidden"
        value={values.offerApplyBehavior}
      />
    </>
  );
}

export function ProPlanBadge() {
  return (
    <span className="counterpulse-pro-badge" title="Requires Pro plan">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
        <path d="M8 1.5 9.8 5l3.9.6-2.8 2.7.7 3.9L8 10.3l-3.5 1.9.7-3.9-2.8-2.7L6.2 5 8 1.5Z" />
      </svg>
      Pro
    </span>
  );
}

export function CustomCssInfoContent() {
  return (
    <div className="counterpulse-info-copy counterpulse-info-copy--wide">
      <p>
        Custom CSS should target Promo Pulse storefront classes only. Use it for
        small visual adjustments that are not covered by the normal design
        controls. Every rule you add here is automatically scoped to this
        campaign, so plain selectors like <code>.pp-bar</code> only affect this
        campaign — no wrapper or <code>__CP_SCOPE__</code> prefix needed.
      </p>
      <ul className="counterpulse-info-list">
        <li>
          <strong>Main surfaces</strong>
          <span>
            Use <code>.pp-bar</code> for top, bottom, and custom selector bars;{" "}
            <code>.pp-product-card</code> for product-page timers;{" "}
            <code>.pp-cart-card</code> for cart timers; and{" "}
            <code>.pp-badge</code> for product badges.
          </span>
        </li>
        <li>
          <strong>Inner elements</strong>
          <span>
            Use <code>.pp-message</code>, <code>.pp-countdown</code>,{" "}
            <code>.pp-cta</code>, <code>.pp-close</code>, <code>.pp-icon</code>,{" "}
            <code>.pp-progress</code>, <code>.pp-discount-offer</code>,{" "}
            <code>.pp-discount-code__value</code>, and <code>.pp-code</code> for
            text, timer, buttons, close icon, campaign icon, progress bar, offer
            layout, discount value, and copy-button styling.
          </span>
        </li>
        <li>
          <strong>Useful modifiers</strong>
          <span>
            Placements add classes like <code>.pp-bar--top-bar</code>,{" "}
            <code>.pp-bar--bottom-bar</code>, <code>.pp-bar--full-width</code>,{" "}
            <code>.pp-bar--overlay</code>, and <code>.pp-bar--sticky</code>.
          </span>
        </li>
        <li>
          <strong>CSS variables</strong>
          <span>
            You can override <code>--pp-bg</code>, <code>--pp-text</code>,{" "}
            <code>--pp-accent</code>, <code>--pp-button</code>,{" "}
            <code>--pp-button-text</code>, <code>--pp-close</code>,{" "}
            <code>--pp-icon-size</code>, <code>--pp-radius</code>,{" "}
            <code>--pp-padding-block</code>, <code>--pp-padding-inline</code>,
            <code>--pp-content-max-width</code>, <code>--pp-offer-code-bg</code>
            , <code>--pp-offer-code-text</code>, and <code>--pp-offer-gap</code>
            .
          </span>
        </li>
        <li>
          <strong>Safety</strong>
          <span>
            The app strips <code>&lt;style&gt;</code> tags, <code>@import</code>
            , JavaScript URLs, and legacy CSS expressions. Keep snippets scoped
            and under 2,000 characters.
          </span>
        </li>
      </ul>
      <pre className="counterpulse-code-example">{`.pp-bar {
  box-shadow: 0 12px 30px rgba(15, 23, 42, .18);
}

.pp-countdown {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

.pp-cta {
  text-transform: uppercase;
}

.pp-close {
  color: #ffffff;
}`}</pre>
    </div>
  );
}

