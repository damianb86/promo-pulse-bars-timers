import { useContext, type ReactNode } from "react";

import {
  designAlignmentOptions,
  designBackgroundImageAttachmentOptions,
  designBackgroundImagePositionOptions,
  designBackgroundImageRepeatOptions,
  designBackgroundImageSizeOptions,
  designBackgroundTypeOptions,
  type CampaignDesignErrors,
  type DesignBackgroundTypeValue,
  type CampaignDesignValues,
} from "../../types/campaign-design";
import { BackgroundImageDesignKey, CardControlIcon, ColorDesignKey, DesignPanelFilterContext, DesignSectionIcon, NumberDesignKey, isHexColor } from "./shared";

export function CardDesignPanel({
  values,
  errors,
  backgroundImageError,
  isBackgroundPickerBusy,
  onBackgroundTypeChange,
  onBackgroundImagePick,
  onBackgroundImageSettingChange,
  onNumberChange,
  onColorChange,
  onAlignmentChange,
}: {
  values: CampaignDesignValues;
  errors: CampaignDesignErrors;
  backgroundImageError?: string;
  isBackgroundPickerBusy: boolean;
  onBackgroundTypeChange: (value: DesignBackgroundTypeValue) => void;
  onBackgroundImagePick: () => void;
  onBackgroundImageSettingChange: <Key extends BackgroundImageDesignKey>(
    key: Key,
    value: CampaignDesignValues[Key],
  ) => void;
  onNumberChange: (key: NumberDesignKey, value: string) => void;
  onColorChange: (key: ColorDesignKey, value: string) => void;
  onAlignmentChange: (value: CampaignDesignValues["alignment"]) => void;
}) {
  // The card editor isn't a DesignPanel, so honor the panel filter directly so
  // it only shows when "Card" is requested (e.g. the inspector's root container).
  const panelFilter = useContext(DesignPanelFilterContext);
  if (panelFilter && !panelFilter.has("Card")) return null;

  return (
    <section className="counterpulse-design-card counterpulse-card-editor">
      <h3>
        <DesignSectionIcon title="Card" />
        <span>Card</span>
      </h3>

      <div className="counterpulse-card-editor__body">
        <div className="counterpulse-card-editor__section">
          <CardSectionHeader
            description="Choose the background style for your card."
            title="Background"
          />
          <div
            className="counterpulse-card-background-grid"
            role="radiogroup"
            aria-label="Background"
          >
            {designBackgroundTypeOptions.map((option) => (
              <CardBackgroundOption
                checked={values.backgroundType === option.value}
                key={option.value}
                type={option.value}
                values={values}
                onChange={onBackgroundTypeChange}
              />
            ))}
          </div>
          {errors.backgroundType ? (
            <span className="counterpulse-form-error">
              {errors.backgroundType}
            </span>
          ) : null}
        </div>

        {values.backgroundType === "GRADIENT" ? (
          <>
            <input
              name="backgroundColor"
              type="hidden"
              value={values.backgroundColor}
            />
            <input name="backgroundImageUrl" type="hidden" value="" />
            <div className="counterpulse-card-editor__section">
              <div className="counterpulse-card-angle-heading">
                <CardSectionHeader
                  description="Control the direction of the gradient."
                  title="Gradient angle"
                />
                <div className="counterpulse-card-angle-value">
                  <input
                    aria-label="Gradient angle value"
                    max={360}
                    min={0}
                    name="gradientAngle"
                    type="number"
                    value={values.gradientAngle}
                    onChange={(event) =>
                      onNumberChange("gradientAngle", event.target.value)
                    }
                  />
                  <span aria-hidden="true">°</span>
                </div>
              </div>
              <input
                aria-label="Gradient angle"
                className="counterpulse-card-slider"
                max={360}
                min={0}
                type="range"
                value={values.gradientAngle}
                onChange={(event) =>
                  onNumberChange("gradientAngle", event.target.value)
                }
              />
              {errors.gradientAngle ? (
                <span className="counterpulse-form-error">
                  {errors.gradientAngle}
                </span>
              ) : null}
            </div>
            <div className="counterpulse-card-field-grid counterpulse-card-field-grid--two">
              <CardColorField
                description="Starting color of the gradient."
                error={errors.gradientStartColor}
                label="Gradient start"
                name="gradientStartColor"
                value={values.gradientStartColor}
                onChange={(value) => onColorChange("gradientStartColor", value)}
              />
              <CardColorField
                description="Ending color of the gradient."
                error={errors.gradientEndColor}
                label="Gradient end"
                name="gradientEndColor"
                value={values.gradientEndColor}
                onChange={(value) => onColorChange("gradientEndColor", value)}
              />
            </div>
          </>
        ) : values.backgroundType === "IMAGE" ? (
          <>
            <input
              name="gradientStartColor"
              type="hidden"
              value={values.gradientStartColor}
            />
            <input
              name="gradientEndColor"
              type="hidden"
              value={values.gradientEndColor}
            />
            <input
              name="gradientAngle"
              type="hidden"
              value={values.gradientAngle}
            />
            <CardImagePicker
              error={backgroundImageError}
              isPicking={isBackgroundPickerBusy}
              value={values.backgroundImageUrl}
              onPickFromShopify={onBackgroundImagePick}
            />
            <div className="counterpulse-card-field-grid counterpulse-card-field-grid--two">
              <CardSelectField
                description="CSS background-size"
                error={errors.backgroundImageSize}
                icon={<CardControlIcon kind="image" />}
                label="Image size"
                name="backgroundImageSize"
                options={designBackgroundImageSizeOptions}
                value={values.backgroundImageSize}
                onChange={(value) =>
                  onBackgroundImageSettingChange("backgroundImageSize", value)
                }
              />
              <CardSelectField
                description="CSS background-position"
                error={errors.backgroundImagePosition}
                icon={<CardControlIcon kind="align" />}
                label="Image position"
                name="backgroundImagePosition"
                options={designBackgroundImagePositionOptions}
                value={values.backgroundImagePosition}
                onChange={(value) =>
                  onBackgroundImageSettingChange(
                    "backgroundImagePosition",
                    value,
                  )
                }
              />
              <CardSelectField
                description="CSS background-repeat"
                error={errors.backgroundImageRepeat}
                icon={<CardControlIcon kind="gap" />}
                label="Image repeat"
                name="backgroundImageRepeat"
                options={designBackgroundImageRepeatOptions}
                value={values.backgroundImageRepeat}
                onChange={(value) =>
                  onBackgroundImageSettingChange("backgroundImageRepeat", value)
                }
              />
              <CardSelectField
                description="CSS background-attachment"
                error={errors.backgroundImageAttachment}
                icon={<CardControlIcon kind="duration" />}
                label="Image attachment"
                name="backgroundImageAttachment"
                options={designBackgroundImageAttachmentOptions}
                value={values.backgroundImageAttachment}
                onChange={(value) =>
                  onBackgroundImageSettingChange(
                    "backgroundImageAttachment",
                    value,
                  )
                }
              />
            </div>
            <CardColorField
              description="Shown while the image loads or if it cannot render."
              error={errors.backgroundColor}
              label="Fallback color"
              name="backgroundColor"
              value={values.backgroundColor}
              onChange={(value) => onColorChange("backgroundColor", value)}
            />
          </>
        ) : (
          <>
            <CardColorField
              description="Primary surface color for the card."
              error={errors.backgroundColor}
              label="Background color"
              name="backgroundColor"
              value={values.backgroundColor}
              onChange={(value) => onColorChange("backgroundColor", value)}
            />
            <input
              name="gradientStartColor"
              type="hidden"
              value={values.gradientStartColor}
            />
            <input
              name="gradientEndColor"
              type="hidden"
              value={values.gradientEndColor}
            />
            <input
              name="gradientAngle"
              type="hidden"
              value={values.gradientAngle}
            />
            <input name="backgroundImageUrl" type="hidden" value="" />
          </>
        )}

        <div className="counterpulse-card-editor__section counterpulse-card-editor__section--container">
          <CardSectionHeader title="Card container" />
          <div className="counterpulse-card-field-grid counterpulse-card-field-grid--three">
            <CardNumberField
              description="Corner roundness"
              error={errors.borderRadius}
              icon={<CardControlIcon kind="radius" />}
              label="Border radius"
              min={0}
              name="borderRadius"
              value={values.borderRadius}
              onChange={(value) => onNumberChange("borderRadius", value)}
            />
            <CardNumberField
              description="Border thickness"
              error={errors.borderSize}
              icon={<CardControlIcon kind="borderSize" />}
              label="Border size"
              max={8}
              min={0}
              name="borderSize"
              value={values.borderSize}
              onChange={(value) => onNumberChange("borderSize", value)}
            />
            <CardColorField
              description="Border color"
              error={errors.borderColor}
              label="Border color"
              name="borderColor"
              value={values.borderColor}
              onChange={(value) => onColorChange("borderColor", value)}
            />
            <CardSelectField
              description="Content alignment"
              error={errors.alignment}
              icon={<CardControlIcon kind="align" />}
              label="Alignment"
              name="alignment"
              value={values.alignment}
              onChange={(value) =>
                onAlignmentChange(value as CampaignDesignValues["alignment"])
              }
            />
            <CardNumberField
              description="Space top & bottom"
              error={errors.paddingBlock}
              icon={<CardControlIcon kind="verticalPadding" />}
              label="Vertical padding"
              max={48}
              min={4}
              name="paddingBlock"
              value={values.paddingBlock}
              onChange={(value) => onNumberChange("paddingBlock", value)}
            />
            <CardNumberField
              description="Space left & right"
              error={errors.paddingInline}
              icon={<CardControlIcon kind="horizontalPadding" />}
              label="Horizontal padding"
              max={64}
              min={8}
              name="paddingInline"
              value={values.paddingInline}
              onChange={(value) => onNumberChange("paddingInline", value)}
            />
            <CardNumberField
              description="Outer space above"
              error={errors.marginTop}
              icon={<CardControlIcon kind="verticalPadding" />}
              label="Margin top"
              max={200}
              min={0}
              name="marginTop"
              value={values.marginTop}
              onChange={(value) => onNumberChange("marginTop", value)}
            />
            <CardNumberField
              description="Outer space below"
              error={errors.marginBottom}
              icon={<CardControlIcon kind="verticalPadding" />}
              label="Margin bottom"
              max={200}
              min={0}
              name="marginBottom"
              value={values.marginBottom}
              onChange={(value) => onNumberChange("marginBottom", value)}
            />
            <CardNumberField
              description="Outer space left"
              error={errors.marginLeft}
              icon={<CardControlIcon kind="horizontalPadding" />}
              label="Margin left"
              max={200}
              min={0}
              name="marginLeft"
              value={values.marginLeft}
              onChange={(value) => onNumberChange("marginLeft", value)}
            />
            <CardNumberField
              description="Outer space right"
              error={errors.marginRight}
              icon={<CardControlIcon kind="horizontalPadding" />}
              label="Margin right"
              max={200}
              min={0}
              name="marginRight"
              value={values.marginRight}
              onChange={(value) => onNumberChange("marginRight", value)}
            />
            <CardNumberField
              description="Space between elements"
              error={errors.contentGap}
              icon={<CardControlIcon kind="gap" />}
              label="Content gap"
              max={32}
              min={0}
              name="contentGap"
              value={values.contentGap}
              onChange={(value) => onNumberChange("contentGap", value)}
            />
            <CardNumberField
              description="Maximum content width"
              error={errors.contentMaxWidth}
              icon={<CardControlIcon kind="maxWidth" />}
              label="Content max width"
              max={1440}
              min={280}
              name="contentMaxWidth"
              value={values.contentMaxWidth}
              onChange={(value) => onNumberChange("contentMaxWidth", value)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function CardSectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="counterpulse-card-section-heading">
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
    </div>
  );
}

export function CardBackgroundOption({
  type,
  values,
  checked,
  onChange,
}: {
  type: DesignBackgroundTypeValue;
  values: CampaignDesignValues;
  checked: boolean;
  onChange: (value: DesignBackgroundTypeValue) => void;
}) {
  const detail = getBackgroundTypeDetail(type);

  return (
    <label
      className={
        checked
          ? "counterpulse-card-background-option is-selected"
          : "counterpulse-card-background-option"
      }
    >
      <input
        checked={checked}
        name="backgroundType"
        type="radio"
        value={type}
        onChange={() => onChange(type)}
      />
      <span className="counterpulse-card-background-option__visual">
        <CardBackgroundVisual type={type} values={values} />
      </span>
      <span className="counterpulse-card-background-option__copy">
        <strong>{detail.label}</strong>
        <small>{detail.description}</small>
      </span>
    </label>
  );
}

export function CardBackgroundVisual({
  type,
  values,
}: {
  type: DesignBackgroundTypeValue;
  values: CampaignDesignValues;
}) {
  if (type === "IMAGE") {
    return values.backgroundImageUrl ? (
      <img alt="" src={values.backgroundImageUrl} />
    ) : (
      <CardControlIcon kind="image" />
    );
  }

  if (type === "GRADIENT") {
    return (
      <span
        className="counterpulse-card-background-option__gradient"
        style={{
          background: `linear-gradient(${values.gradientAngle}deg, ${values.gradientStartColor}, ${values.gradientEndColor})`,
        }}
      />
    );
  }

  return (
    <span
      className="counterpulse-card-background-option__solid"
      style={{ background: values.backgroundColor }}
    />
  );
}

export function CardColorField({
  name,
  label,
  description,
  value,
  error,
  onChange,
}: {
  name: ColorDesignKey;
  label: string;
  description: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="counterpulse-card-field">
      <span className="counterpulse-card-field__label">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="counterpulse-card-color-control">
        <span className="counterpulse-card-color-control__swatch">
          <input
            aria-label={`${label} color picker`}
            type="color"
            value={isHexColor(value) ? value : "#000000"}
            onChange={(event) => onChange(event.target.value)}
          />
        </span>
        <input
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span
          className="counterpulse-card-color-control__picker"
          aria-hidden="true"
        >
          <CardControlIcon kind="eyedropper" />
        </span>
      </span>
      {error ? <span className="counterpulse-form-error">{error}</span> : null}
    </label>
  );
}

export function CardNumberField({
  name,
  label,
  description,
  icon,
  value,
  error,
  min,
  max,
  onChange,
}: {
  name: NumberDesignKey;
  label: string;
  description: string;
  icon: ReactNode;
  value: number;
  error?: string;
  min: number;
  max?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="counterpulse-card-field">
      <span className="counterpulse-card-field__label">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="counterpulse-card-number-control">
        <span
          className="counterpulse-card-number-control__icon"
          aria-hidden="true"
        >
          {icon}
        </span>
        <input
          {...(typeof max === "number" ? { max } : {})}
          min={min}
          name={name}
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="counterpulse-card-number-control__unit">px</span>
      </span>
      {error ? <span className="counterpulse-form-error">{error}</span> : null}
    </label>
  );
}

export function CardSelectField({
  name,
  label,
  description,
  icon,
  options,
  value,
  error,
  onChange,
}: {
  name: "alignment" | BackgroundImageDesignKey;
  label: string;
  description: string;
  icon: ReactNode;
  options?: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const selectOptions = options ?? designAlignmentOptions;

  return (
    <label className="counterpulse-card-field">
      <span className="counterpulse-card-field__label">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="counterpulse-card-number-control">
        <span
          className="counterpulse-card-number-control__icon"
          aria-hidden="true"
        >
          {icon}
        </span>
        <select
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {selectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
      {error ? <span className="counterpulse-form-error">{error}</span> : null}
    </label>
  );
}

export function CardImagePicker({
  value,
  error,
  isPicking,
  onPickFromShopify,
}: {
  value: string;
  error?: string;
  isPicking: boolean;
  onPickFromShopify: () => void;
}) {
  return (
    <div className="counterpulse-card-image-picker">
      <div className="counterpulse-card-image-picker__preview">
        {value ? <img alt="" src={value} /> : <CardControlIcon kind="image" />}
      </div>
      <div className="counterpulse-card-image-picker__content">
        <CardSectionHeader
          description="Use a Shopify-hosted image as the card surface."
          title="Background image"
        />
        <button
          className="counterpulse-button-secondary counterpulse-button-secondary--small"
          disabled={isPicking}
          type="button"
          onClick={onPickFromShopify}
        >
          {isPicking ? "Opening library..." : "Choose from Shopify library"}
        </button>
        {error ? (
          <span className="counterpulse-form-error">{error}</span>
        ) : null}
      </div>
      <input name="backgroundImageUrl" type="hidden" value={value} />
    </div>
  );
}

export function getBackgroundTypeDetail(type: DesignBackgroundTypeValue) {
  if (type === "GRADIENT") {
    return {
      label: "Gradient",
      description: "Two color background",
    };
  }

  if (type === "IMAGE") {
    return {
      label: "Image",
      description: "Use an image background",
    };
  }

  return {
    label: "Single color",
    description: "Solid background",
  };
}


