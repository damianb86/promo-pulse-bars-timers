import { useRef, useState, type ReactNode } from "react";

import {
  designAlignmentOptions,
  designBackgroundTypeOptions,
  designFontFamilyOptions,
  designIconOptions,
  designLayoutOptions,
  designPositionModeOptions,
  designTimerFormatOptions,
  designTimerStyleOptions,
  type CampaignDesignErrors,
  type CampaignDesignValues,
} from "../types/campaign-design";
import { TemplatePicker } from "./TemplatePicker";

const customIconMaxDataUrlLength = 150_000;
const customIconDataUrlPattern = /^data:image\/(?:svg\+xml|png|jpe?g);base64,/i;
const customIconFileTypes = new Set([
  "image/svg+xml",
  "image/png",
  "image/jpeg",
]);
const customIconFileExtensions = new Map([
  ["svg", "image/svg+xml"],
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
]);

type DesignControlsProps = {
  values: CampaignDesignValues;
  errors?: CampaignDesignErrors;
  isProPlan: boolean;
  onChange: (values: CampaignDesignValues) => void;
};

export function DesignControls({
  values,
  errors = {},
  isProPlan,
  onChange,
}: DesignControlsProps) {
  const customIconInputRef = useRef<HTMLInputElement | null>(null);
  const [customIconError, setCustomIconError] = useState<string | null>(null);
  const updateValue = <Key extends keyof CampaignDesignValues>(
    key: Key,
    value: CampaignDesignValues[Key],
  ) => {
    onChange({ ...values, [key]: value });
  };

  const updateNumber = (key: NumberDesignKey, value: string) => {
    updateValue(key, Number(value) as CampaignDesignValues[typeof key]);
  };

  const updateColor = (key: ColorDesignKey, value: string) => {
    updateValue(key, value.toUpperCase() as CampaignDesignValues[typeof key]);
  };

  const updateCustomIcon = (file: File | null) => {
    if (!file) return;
    setCustomIconError(null);

    const iconMimeType = getCustomIconMimeType(file);

    if (!iconMimeType) {
      setCustomIconError("Use an SVG, PNG, JPG, or JPEG icon.");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      let result = typeof reader.result === "string" ? reader.result : "";

      if (
        result &&
        !customIconDataUrlPattern.test(result) &&
        /^data:[^;]*;base64,/i.test(result)
      ) {
        result = result.replace(
          /^data:[^;]*;base64,/i,
          `data:${iconMimeType};base64,`,
        );
      }

      if (!result || result.length > customIconMaxDataUrlLength) {
        setCustomIconError("Keep the icon under 110 KB.");
        return;
      }

      if (!customIconDataUrlPattern.test(result)) {
        setCustomIconError("Upload a valid SVG, PNG, JPG, or JPEG icon.");
        return;
      }

      onChange({
        ...values,
        showIcon: true,
        icon: "CUSTOM",
        customIconUrl: result,
      });
    });
    reader.readAsDataURL(file);
  };

  const updateIcon = (icon: CampaignDesignValues["icon"]) => {
    onChange({
      ...values,
      icon,
      showIcon: icon === "NONE" ? values.showIcon : true,
      customIconUrl: icon === "CUSTOM" ? values.customIconUrl : "",
    });
  };

  return (
    <div className="counterpulse-design-controls">
      <DesignPanel title="Template">
        <DesignGroup error={errors.layout} label="Layout">
          <div className="counterpulse-layout-picker">
            {designLayoutOptions.map((option) => (
              <button
                aria-pressed={values.layout === option.value}
                className={
                  values.layout === option.value
                    ? "counterpulse-layout-option is-active"
                    : "counterpulse-layout-option"
                }
                key={option.value}
                type="button"
                onClick={() => updateValue("layout", option.value)}
              >
                <LayoutPreview layout={option.value} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          <input name="layout" type="hidden" value={values.layout} />
        </DesignGroup>

        <DesignGroup error={errors.templateKey} label="Preset">
          <TemplatePicker
            value={values.templateKey}
            onChange={(template) =>
              onChange({
                ...values,
                ...template,
                customCss: values.customCss,
                layout: values.layout,
              })
            }
          />
          <input name="templateKey" type="hidden" value={values.templateKey} />
          <input name="textColor" type="hidden" value={values.textColor} />
          <input name="fontSize" type="hidden" value={values.fontSize} />
        </DesignGroup>
      </DesignPanel>

      <DesignPanel title="Card">
        <DesignGroup error={errors.backgroundType} label="Background">
          <div className="counterpulse-radio-stack">
            {designBackgroundTypeOptions.map((option) => (
              <label className="counterpulse-radio" key={option.value}>
                <input
                  checked={values.backgroundType === option.value}
                  name="backgroundType"
                  type="radio"
                  value={option.value}
                  onChange={() => updateValue("backgroundType", option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </DesignGroup>

        {values.backgroundType === "GRADIENT" ? (
          <>
            <input
              name="backgroundColor"
              type="hidden"
              value={values.backgroundColor}
            />
            <DesignField
              error={errors.gradientAngle}
              label="Gradient angle degree"
            >
              <div className="counterpulse-range-field">
                <input
                  max={360}
                  min={0}
                  type="range"
                  value={values.gradientAngle}
                  onChange={(event) =>
                    updateNumber("gradientAngle", event.target.value)
                  }
                />
                <input
                  aria-label="Gradient angle value"
                  max={360}
                  min={0}
                  name="gradientAngle"
                  type="number"
                  value={values.gradientAngle}
                  onChange={(event) =>
                    updateNumber("gradientAngle", event.target.value)
                  }
                />
              </div>
            </DesignField>
            <ColorField
              error={errors.gradientStartColor}
              label="Gradient start"
              name="gradientStartColor"
              value={values.gradientStartColor}
              onChange={(value) => updateColor("gradientStartColor", value)}
            />
            <ColorField
              error={errors.gradientEndColor}
              label="Gradient end"
              name="gradientEndColor"
              value={values.gradientEndColor}
              onChange={(value) => updateColor("gradientEndColor", value)}
            />
          </>
        ) : (
          <ColorField
            error={errors.backgroundColor}
            label="Background"
            name="backgroundColor"
            value={values.backgroundColor}
            onChange={(value) => updateColor("backgroundColor", value)}
          />
        )}

        {values.backgroundType === "SOLID" && (
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
          </>
        )}

        <div className="counterpulse-form-grid counterpulse-form-grid--wide">
          <NumberField
            error={errors.borderRadius}
            label="Border radius"
            max={24}
            min={0}
            name="borderRadius"
            value={values.borderRadius}
            onChange={(value) => updateNumber("borderRadius", value)}
          />
          <NumberField
            error={errors.borderSize}
            label="Border size"
            max={8}
            min={0}
            name="borderSize"
            value={values.borderSize}
            onChange={(value) => updateNumber("borderSize", value)}
          />
          <ColorField
            error={errors.borderColor}
            label="Border color"
            name="borderColor"
            value={values.borderColor}
            onChange={(value) => updateColor("borderColor", value)}
          />
          <DesignField label="Alignment" error={errors.alignment}>
            <select
              name="alignment"
              value={values.alignment}
              onChange={(event) =>
                updateValue(
                  "alignment",
                  event.target.value as CampaignDesignValues["alignment"],
                )
              }
            >
              {designAlignmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </DesignField>
        </div>

        <div className="counterpulse-form-grid counterpulse-form-grid--wide">
          <NumberField
            error={errors.paddingBlock}
            label="Vertical padding"
            max={48}
            min={4}
            name="paddingBlock"
            value={values.paddingBlock}
            onChange={(value) => updateNumber("paddingBlock", value)}
          />
          <NumberField
            error={errors.paddingInline}
            label="Horizontal padding"
            max={64}
            min={8}
            name="paddingInline"
            value={values.paddingInline}
            onChange={(value) => updateNumber("paddingInline", value)}
          />
          <NumberField
            error={errors.contentGap}
            label="Content gap"
            max={32}
            min={0}
            name="contentGap"
            value={values.contentGap}
            onChange={(value) => updateNumber("contentGap", value)}
          />
        </div>
      </DesignPanel>

      <DesignPanel title="Typography">
        <DesignField label="Font" error={errors.fontFamily}>
          <select
            name="fontFamily"
            value={values.fontFamily}
            onChange={(event) =>
              updateValue(
                "fontFamily",
                event.target.value as CampaignDesignValues["fontFamily"],
              )
            }
          >
            {designFontFamilyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </DesignField>

        <div className="counterpulse-typography-grid">
          <NumberField
            error={errors.titleFontSize}
            label="Title size"
            max={48}
            min={12}
            name="titleFontSize"
            value={values.titleFontSize}
            onChange={(value) => updateNumber("titleFontSize", value)}
          />
          <ColorField
            error={errors.titleColor}
            label="Title color"
            name="titleColor"
            value={values.titleColor}
            onChange={(value) => updateColor("titleColor", value)}
          />
          <NumberField
            error={errors.subheadingFontSize}
            label="Subheading size"
            max={32}
            min={10}
            name="subheadingFontSize"
            value={values.subheadingFontSize}
            onChange={(value) => updateNumber("subheadingFontSize", value)}
          />
          <ColorField
            error={errors.subheadingColor}
            label="Subheading color"
            name="subheadingColor"
            value={values.subheadingColor}
            onChange={(value) => updateColor("subheadingColor", value)}
          />
          <NumberField
            error={errors.timerFontSize}
            label="Timer size"
            max={72}
            min={12}
            name="timerFontSize"
            value={values.timerFontSize}
            onChange={(value) => updateNumber("timerFontSize", value)}
          />
          <ColorField
            error={errors.timerColor}
            label="Timer color"
            name="timerColor"
            value={values.timerColor}
            onChange={(value) => updateColor("timerColor", value)}
          />
          <NumberField
            error={errors.legendFontSize}
            label="Legend size"
            max={24}
            min={10}
            name="legendFontSize"
            value={values.legendFontSize}
            onChange={(value) => updateNumber("legendFontSize", value)}
          />
          <ColorField
            error={errors.legendColor}
            label="Legend color"
            name="legendColor"
            value={values.legendColor}
            onChange={(value) => updateColor("legendColor", value)}
          />
        </div>
      </DesignPanel>

      <DesignPanel title="Timer Style">
        <DesignGroup error={errors.timerFormat} label="Format">
          <div className="counterpulse-segmented counterpulse-segmented--compact">
            {designTimerFormatOptions.map((option) => (
              <button
                className={
                  values.timerFormat === option.value ? "is-active" : ""
                }
                key={option.value}
                type="button"
                onClick={() => updateValue("timerFormat", option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input name="timerFormat" type="hidden" value={values.timerFormat} />
        </DesignGroup>

        <ToggleField
          checked={values.timerShowLabels}
          label="Show timer labels"
          name="timerShowLabels"
          onChange={(checked) => updateValue("timerShowLabels", checked)}
        />

        <DesignGroup error={errors.timerStyle} label="Type">
          <div className="counterpulse-timer-style-picker">
            {designTimerStyleOptions.map((option) => (
              <button
                aria-pressed={values.timerStyle === option.value}
                className={
                  values.timerStyle === option.value
                    ? "counterpulse-timer-style-option is-active"
                    : "counterpulse-timer-style-option"
                }
                key={option.value}
                type="button"
                onClick={() => updateValue("timerStyle", option.value)}
              >
                <TimerStylePreview timerStyle={option.value} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          <input name="timerStyle" type="hidden" value={values.timerStyle} />
        </DesignGroup>

        {values.timerStyle !== "PLAIN" && (
          <div className="counterpulse-form-grid counterpulse-form-grid--wide">
            <ColorField
              error={errors.timerSurfaceColor}
              label={
                values.timerStyle === "BOXES"
                  ? "Box background"
                  : "Group background"
              }
              name="timerSurfaceColor"
              value={values.timerSurfaceColor}
              onChange={(value) => updateColor("timerSurfaceColor", value)}
            />
            <NumberField
              error={errors.timerSurfaceRadius}
              label={
                values.timerStyle === "BOXES" ? "Box radius" : "Group radius"
              }
              max={40}
              min={0}
              name="timerSurfaceRadius"
              value={values.timerSurfaceRadius}
              onChange={(value) => updateNumber("timerSurfaceRadius", value)}
            />
            <NumberField
              error={errors.timerSurfaceBorderSize}
              label="Timer border size"
              max={6}
              min={0}
              name="timerSurfaceBorderSize"
              value={values.timerSurfaceBorderSize}
              onChange={(value) =>
                updateNumber("timerSurfaceBorderSize", value)
              }
            />
            <ColorField
              error={errors.timerSurfaceBorderColor}
              label="Timer border color"
              name="timerSurfaceBorderColor"
              value={values.timerSurfaceBorderColor}
              onChange={(value) =>
                updateColor("timerSurfaceBorderColor", value)
              }
            />
          </div>
        )}

        {values.timerStyle === "PLAIN" && (
          <>
            <input
              name="timerSurfaceColor"
              type="hidden"
              value={values.timerSurfaceColor}
            />
            <input
              name="timerSurfaceBorderColor"
              type="hidden"
              value={values.timerSurfaceBorderColor}
            />
            <input
              name="timerSurfaceBorderSize"
              type="hidden"
              value={values.timerSurfaceBorderSize}
            />
            <input
              name="timerSurfaceRadius"
              type="hidden"
              value={values.timerSurfaceRadius}
            />
          </>
        )}
      </DesignPanel>

      <DesignPanel title="Behavior">
        <div className="counterpulse-form-grid counterpulse-form-grid--wide">
          <DesignField label="Icon" error={errors.icon}>
            <select
              name="icon"
              value={values.icon}
              onChange={(event) =>
                updateIcon(event.target.value as CampaignDesignValues["icon"])
              }
            >
              {designIconOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </DesignField>
          {values.icon === "CUSTOM" ? (
            <DesignGroup
              label="Custom icon"
              error={customIconError ?? errors.customIconUrl}
            >
              <div className="counterpulse-icon-upload">
                <button
                  className="counterpulse-icon-upload__target"
                  type="button"
                  onClick={() => customIconInputRef.current?.click()}
                >
                  {values.customIconUrl ? (
                    <span className="counterpulse-icon-upload__preview">
                      <img alt="" src={values.customIconUrl} />
                    </span>
                  ) : (
                    <span className="counterpulse-icon-upload__empty">
                      <EditIcon />
                    </span>
                  )}
                  <span className="counterpulse-icon-upload__overlay">
                    <EditIcon />
                  </span>
                </button>
                <input
                  accept="image/svg+xml,image/png,image/jpeg,.svg,.png,.jpg,.jpeg"
                  aria-label="Upload custom icon"
                  className="counterpulse-icon-upload__input"
                  ref={customIconInputRef}
                  type="file"
                  onChange={(event) =>
                    updateCustomIcon(event.currentTarget.files?.[0] ?? null)
                  }
                />
                {values.customIconUrl ? (
                  <button
                    aria-label="Remove custom icon"
                    className="counterpulse-icon-upload__remove"
                    type="button"
                    onClick={() => {
                      setCustomIconError(null);
                      updateValue("customIconUrl", "");
                    }}
                  >
                    x
                  </button>
                ) : null}
              </div>
            </DesignGroup>
          ) : null}
          <input
            name="customIconUrl"
            type="hidden"
            value={values.icon === "CUSTOM" ? values.customIconUrl : ""}
          />
          <ColorField
            error={errors.accentColor}
            label="Accent"
            name="accentColor"
            value={values.accentColor}
            onChange={(value) => updateColor("accentColor", value)}
          />
          <ColorField
            error={errors.buttonColor}
            label="Button"
            name="buttonColor"
            value={values.buttonColor}
            onChange={(value) => updateColor("buttonColor", value)}
          />
          <ColorField
            error={errors.buttonTextColor}
            label="Button text"
            name="buttonTextColor"
            value={values.buttonTextColor}
            onChange={(value) => updateColor("buttonTextColor", value)}
          />
        </div>

        <div className="counterpulse-toggle-grid">
          <DesignField label="Position" error={errors.positionMode}>
            <select
              name="positionMode"
              value={values.positionMode}
              onChange={(event) =>
                updateValue(
                  "positionMode",
                  event.target.value as CampaignDesignValues["positionMode"],
                )
              }
            >
              {designPositionModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </DesignField>
          <input
            name="positionSticky"
            type="hidden"
            value={String(values.positionSticky)}
          />
          <ToggleField
            checked={values.fullWidth}
            label="Full width"
            name="fullWidth"
            onChange={(checked) => updateValue("fullWidth", checked)}
          />
          <ToggleField
            checked={values.mobileEnabled}
            label="Mobile enabled"
            name="mobileEnabled"
            onChange={(checked) => updateValue("mobileEnabled", checked)}
          />
          <ToggleField
            checked={values.showCloseButton}
            label="Closable banner"
            name="showCloseButton"
            onChange={(checked) => updateValue("showCloseButton", checked)}
          />
          <ToggleField
            checked={values.showIcon}
            label="Show icon"
            name="showIcon"
            onChange={(checked) => updateValue("showIcon", checked)}
          />
        </div>
      </DesignPanel>

      <DesignPanel title="Advanced">
        <DesignField
          label={isProPlan ? "Custom CSS" : "Custom CSS (Pro plan)"}
          error={errors.customCss}
        >
          <textarea
            disabled={!isProPlan}
            name="customCss"
            rows={4}
            value={values.customCss}
            onChange={(event) => updateValue("customCss", event.target.value)}
          />
        </DesignField>
      </DesignPanel>
    </div>
  );
}

type ColorDesignKey = {
  [Key in keyof CampaignDesignValues]: CampaignDesignValues[Key] extends string
    ? Key
    : never;
}[keyof CampaignDesignValues];

type NumberDesignKey = {
  [Key in keyof CampaignDesignValues]: CampaignDesignValues[Key] extends number
    ? Key
    : never;
}[keyof CampaignDesignValues];

function DesignPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="counterpulse-design-card">
      <h3>{title}</h3>
      <div className="counterpulse-design-card__body">{children}</div>
    </section>
  );
}

function getCustomIconMimeType(file: File) {
  if (customIconFileTypes.has(file.type)) return file.type;

  const extension = file.name.toLowerCase().split(".").pop();
  return extension ? (customIconFileExtensions.get(extension) ?? null) : null;
}

function DesignGroup({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="counterpulse-form-field">
      <span>{label}</span>
      {children}
      {error && <span className="counterpulse-form-error">{error}</span>}
    </div>
  );
}

function DesignField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="counterpulse-form-field">
      <span>{label}</span>
      {children}
      {error && <span className="counterpulse-form-error">{error}</span>}
    </label>
  );
}

function ColorField({
  name,
  label,
  value,
  error,
  onChange,
}: {
  name: ColorDesignKey;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <DesignField label={label} error={error}>
      <div className="counterpulse-color-input">
        <input
          aria-label={`${label} color picker`}
          type="color"
          value={isHexColor(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </DesignField>
  );
}

function NumberField({
  name,
  label,
  value,
  error,
  min,
  max,
  onChange,
}: {
  name: NumberDesignKey;
  label: string;
  value: number;
  error?: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <DesignField label={label} error={error}>
      <div className="counterpulse-number-input">
        <input
          max={max}
          min={min}
          name={name}
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span>px</span>
      </div>
    </DesignField>
  );
}

function ToggleField({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="counterpulse-toggle">
      <input
        checked={checked}
        name={name}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function LayoutPreview({ layout }: { layout: CampaignDesignValues["layout"] }) {
  return (
    <span
      className={`counterpulse-layout-preview counterpulse-layout-preview--${layout.toLowerCase()}`}
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </span>
  );
}

function TimerStylePreview({
  timerStyle,
}: {
  timerStyle: CampaignDesignValues["timerStyle"];
}) {
  return (
    <span
      className={`counterpulse-timer-style-preview counterpulse-timer-style-preview--${timerStyle.toLowerCase()}`}
      aria-hidden="true"
    >
      <span>01</span>
      <span>58</span>
      <span>26</span>
    </span>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path
        d="m5 16.8-.7 2.9 2.9-.7L17.9 8.3 15.7 6.1 5 16.8Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="m14.6 7.2 2.2 2.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function isHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}
