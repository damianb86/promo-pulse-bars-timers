import { useState, type ReactNode } from "react";

import { FieldInfoButton } from "./Notifications";
import {
  campaignDesignTemplates,
  designAlignmentOptions,
  designBackgroundTypeOptions,
  designBannerAnimationOptions,
  designFontFamilyOptions,
  designIconOptions,
  designLayoutOptions,
  designTimerTickAnimationOptions,
  designTimerFormatOptions,
  designTimerStyleOptions,
  type CampaignDesignErrors,
  type CampaignDesignImageOption,
  type CampaignDesignMediaOptions,
  type CampaignDesignTemplate,
  type CampaignDesignValues,
} from "../types/campaign-design";
import {
  freeShippingProgressStyleOptions,
  type FreeShippingProgressStyleValue,
} from "../types/free-shipping";

type DesignControlsProps = {
  values: CampaignDesignValues;
  errors?: CampaignDesignErrors;
  hasTimer?: boolean;
  mediaOptions?: CampaignDesignMediaOptions;
  isProPlan: boolean;
  progressStyle?: FreeShippingProgressStyleValue;
  onChange: (values: CampaignDesignValues) => void;
  onProgressStyleChange?: (value: FreeShippingProgressStyleValue) => void;
};

export function DesignControls({
  values,
  errors = {},
  hasTimer = true,
  isProPlan,
  progressStyle,
  onChange,
  onProgressStyleChange,
}: DesignControlsProps) {
  const [customIconError, setCustomIconError] = useState<string | null>(null);
  const [backgroundImageError, setBackgroundImageError] = useState<
    string | null
  >(null);
  const [isBackgroundPickerBusy, setIsBackgroundPickerBusy] = useState(false);
  const [isIconPickerBusy, setIsIconPickerBusy] = useState(false);
  const [openTemplateDropdown, setOpenTemplateDropdown] = useState<
    "layout" | "preset" | null
  >(null);
  const selectedLayoutOption =
    designLayoutOptions.find((option) => option.value === values.layout) ??
    designLayoutOptions[0];
  const selectedTemplate =
    campaignDesignTemplates.find(
      (template) => template.templateKey === values.templateKey,
    ) ?? campaignDesignTemplates[0];

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

  const selectShopifyBackgroundImage = async () => {
    setBackgroundImageError(null);
    setIsBackgroundPickerBusy(true);

    try {
      const option = await pickAndResolveShopifyFile("background");

      if (option) {
        updateValue("backgroundImageUrl", option.url);
      }
    } catch (error) {
      setBackgroundImageError(getPickerErrorMessage(error));
    } finally {
      setIsBackgroundPickerBusy(false);
    }
  };

  const selectShopifyCustomIcon = async () => {
    setCustomIconError(null);
    setIsIconPickerBusy(true);

    try {
      const option = await pickAndResolveShopifyFile("icon");

      if (option) {
        onChange({
          ...values,
          showIcon: true,
          icon: "CUSTOM",
          customIconUrl: option.url,
        });
      }
    } catch (error) {
      setCustomIconError(getPickerErrorMessage(error));
    } finally {
      setIsIconPickerBusy(false);
    }
  };

  const updateIcon = (icon: CampaignDesignValues["icon"]) => {
    onChange({
      ...values,
      icon,
      showIcon: icon !== "NONE",
      customIconUrl: icon === "CUSTOM" ? values.customIconUrl : "",
    });
  };

  const updateFullWidth = (checked: boolean) => {
    onChange({
      ...values,
      fullWidth: checked,
      borderRadius: checked ? 0 : values.borderRadius,
    });
  };

  const selectLayout = (layout: CampaignDesignValues["layout"]) => {
    onChange(applyLayoutDefaults({ ...values }, layout));
    setOpenTemplateDropdown(null);
  };

  const selectTemplate = (template: CampaignDesignTemplate) => {
    onChange(
      applyLayoutDefaults(
        {
          ...values,
          ...template,
          customCss: values.customCss,
          layout: values.layout,
        },
        values.layout,
      ),
    );
    setOpenTemplateDropdown(null);
  };

  return (
    <div className="counterpulse-design-controls">
      <DesignPanel title="Template">
        <DesignGroup error={errors.layout} label="Layout">
          <PreviewSelectDropdown
            isOpen={openTemplateDropdown === "layout"}
            label="Layout options"
            preview={<LayoutPreview layout={selectedLayoutOption.value} />}
            selectedLabel={selectedLayoutOption.label}
            onClose={() => setOpenTemplateDropdown(null)}
            onToggle={() =>
              setOpenTemplateDropdown((open) =>
                open === "layout" ? null : "layout",
              )
            }
          >
            {designLayoutOptions.map((option) => (
              <button
                aria-selected={values.layout === option.value}
                className={
                  values.layout === option.value
                    ? "counterpulse-preview-select__option is-selected"
                    : "counterpulse-preview-select__option"
                }
                key={option.value}
                role="option"
                type="button"
                onClick={() => selectLayout(option.value)}
              >
                <span className="counterpulse-preview-select__visual">
                  <LayoutPreview layout={option.value} />
                </span>
                <span className="counterpulse-preview-select__content">
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </button>
            ))}
          </PreviewSelectDropdown>
          <input name="layout" type="hidden" value={values.layout} />
        </DesignGroup>

        <DesignGroup error={errors.templateKey} label="Preset">
          <PreviewSelectDropdown
            isOpen={openTemplateDropdown === "preset"}
            label="Preset options"
            preview={<TemplatePreview template={selectedTemplate} />}
            selectedLabel={selectedTemplate.label}
            onClose={() => setOpenTemplateDropdown(null)}
            onToggle={() =>
              setOpenTemplateDropdown((open) =>
                open === "preset" ? null : "preset",
              )
            }
          >
            {campaignDesignTemplates.map((template) => (
              <button
                aria-selected={values.templateKey === template.templateKey}
                className={
                  values.templateKey === template.templateKey
                    ? "counterpulse-preview-select__option is-selected"
                    : "counterpulse-preview-select__option"
                }
                key={template.templateKey}
                role="option"
                type="button"
                onClick={() => selectTemplate(template)}
              >
                <span className="counterpulse-preview-select__visual">
                  <TemplatePreview template={template} />
                </span>
                <span className="counterpulse-preview-select__content">
                  <strong>{template.label}</strong>
                  <small>
                    {template.backgroundType === "GRADIENT"
                      ? "Gradient preset"
                      : template.backgroundType === "IMAGE"
                        ? "Image preset"
                        : "Solid preset"}
                  </small>
                </span>
              </button>
            ))}
          </PreviewSelectDropdown>
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
            <input name="backgroundImageUrl" type="hidden" value="" />
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
            <ImageBackgroundPicker
              error={backgroundImageError ?? errors.backgroundImageUrl}
              isPicking={isBackgroundPickerBusy}
              value={values.backgroundImageUrl}
              onPickFromShopify={selectShopifyBackgroundImage}
            />
            <ColorField
              error={errors.backgroundColor}
              label="Fallback color"
              name="backgroundColor"
              value={values.backgroundColor}
              onChange={(value) => updateColor("backgroundColor", value)}
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
            <input name="backgroundImageUrl" type="hidden" value="" />
          </>
        )}

        <div className="counterpulse-form-grid counterpulse-form-grid--wide">
          <NumberField
            error={errors.borderRadius}
            label="Border radius"
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
          <NumberField
            error={errors.contentMaxWidth}
            label="Content max width"
            max={1440}
            min={280}
            name="contentMaxWidth"
            value={values.contentMaxWidth}
            onChange={(value) => updateNumber("contentMaxWidth", value)}
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
        {hasTimer ? (
          <>
            <DesignGroup error={errors.timerFormat} label="Format">
              <div className="counterpulse-segmented counterpulse-segmented--compact counterpulse-segmented--fit">
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
              <input
                name="timerFormat"
                type="hidden"
                value={values.timerFormat}
              />
            </DesignGroup>

            <DesignGroup label="Timer labels">
              <div className="counterpulse-design-toggle-row">
                <ToggleSwitch
                  checked={values.timerShowLabels}
                  label="Show timer labels"
                  name="timerShowLabels"
                  onChange={(checked) =>
                    updateValue("timerShowLabels", checked)
                  }
                />
              </div>
              <div className="counterpulse-timer-label-grid">
                <input
                  aria-label="Days label"
                  disabled={!values.timerShowLabels}
                  maxLength={12}
                  name="timerDaysLabel"
                  value={values.timerDaysLabel}
                  onChange={(event) =>
                    updateValue("timerDaysLabel", event.target.value)
                  }
                />
                <input
                  aria-label="Hours label"
                  disabled={!values.timerShowLabels}
                  maxLength={12}
                  name="timerHoursLabel"
                  value={values.timerHoursLabel}
                  onChange={(event) =>
                    updateValue("timerHoursLabel", event.target.value)
                  }
                />
                <input
                  aria-label="Minutes label"
                  disabled={!values.timerShowLabels}
                  maxLength={12}
                  name="timerMinutesLabel"
                  value={values.timerMinutesLabel}
                  onChange={(event) =>
                    updateValue("timerMinutesLabel", event.target.value)
                  }
                />
                <input
                  aria-label="Seconds label"
                  disabled={!values.timerShowLabels}
                  maxLength={12}
                  name="timerSecondsLabel"
                  value={values.timerSecondsLabel}
                  onChange={(event) =>
                    updateValue("timerSecondsLabel", event.target.value)
                  }
                />
              </div>
              {!values.timerShowLabels && (
                <>
                  <input
                    name="timerDaysLabel"
                    type="hidden"
                    value={values.timerDaysLabel}
                  />
                  <input
                    name="timerHoursLabel"
                    type="hidden"
                    value={values.timerHoursLabel}
                  />
                  <input
                    name="timerMinutesLabel"
                    type="hidden"
                    value={values.timerMinutesLabel}
                  />
                  <input
                    name="timerSecondsLabel"
                    type="hidden"
                    value={values.timerSecondsLabel}
                  />
                </>
              )}
              <ToggleField
                checked={values.timerHideZeroDays}
                label="Hide Days when value is 00"
                name="timerHideZeroDays"
                onChange={(checked) =>
                  updateValue("timerHideZeroDays", checked)
                }
              />
            </DesignGroup>

            <ToggleField
              checked={values.timerShowSeconds}
              label="Show seconds"
              name="timerShowSeconds"
              onChange={(checked) => updateValue("timerShowSeconds", checked)}
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
              <input
                name="timerStyle"
                type="hidden"
                value={values.timerStyle}
              />
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
                    values.timerStyle === "BOXES"
                      ? "Box radius"
                      : "Group radius"
                  }
                  max={40}
                  min={0}
                  name="timerSurfaceRadius"
                  value={values.timerSurfaceRadius}
                  onChange={(value) =>
                    updateNumber("timerSurfaceRadius", value)
                  }
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
          </>
        ) : (
          <>
            <div className="counterpulse-design-note">
              This campaign is not currently showing a timer. Choose a timer
              mode or end date in Campaign Schedule to edit timer design
              controls.
            </div>
            <TimerStyleHiddenInputs values={values} />
          </>
        )}
      </DesignPanel>

      {progressStyle && onProgressStyleChange ? (
        <DesignPanel title="Progress">
          <div className="counterpulse-form-grid counterpulse-form-grid--wide">
            <ToggleField
              checked={values.showProgressBar}
              label="Show progress bar"
              name="showProgressBar"
              onChange={(checked) => updateValue("showProgressBar", checked)}
            />
            <DesignGroup label="Progress style">
              <select
                aria-label="Progress style"
                value={progressStyle}
                onChange={(event) =>
                  onProgressStyleChange(
                    event.currentTarget.value as FreeShippingProgressStyleValue,
                  )
                }
              >
                {freeShippingProgressStyleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </DesignGroup>
          </div>
        </DesignPanel>
      ) : (
        <input
          name="showProgressBar"
          type="hidden"
          value={String(values.showProgressBar)}
        />
      )}

      <DesignPanel title="Elements">
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
                  aria-label="Choose custom icon"
                  className="counterpulse-icon-upload__target"
                  disabled={isIconPickerBusy}
                  title="Choose custom icon"
                  type="button"
                  onClick={selectShopifyCustomIcon}
                >
                  {values.customIconUrl ? (
                    <span className="counterpulse-icon-upload__preview">
                      <img alt="" src={values.customIconUrl} />
                    </span>
                  ) : (
                    <span className="counterpulse-icon-upload__empty">
                      {isIconPickerBusy ? "..." : <EditIcon />}
                    </span>
                  )}
                  <span className="counterpulse-icon-upload__overlay">
                    <EditIcon />
                  </span>
                </button>
              </div>
            </DesignGroup>
          ) : null}
          <input
            name="customIconUrl"
            type="hidden"
            value={values.icon === "CUSTOM" ? values.customIconUrl : ""}
          />
          <input
            name="showIcon"
            type="hidden"
            value={values.icon === "NONE" ? "false" : "true"}
          />
          <NumberField
            error={errors.iconSize}
            label="Icon size"
            max={64}
            min={12}
            name="iconSize"
            value={values.iconSize}
            onChange={(value) => updateNumber("iconSize", value)}
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
          <ColorField
            error={errors.closeButtonColor}
            label="Close icon"
            name="closeButtonColor"
            value={values.closeButtonColor}
            onChange={(value) => updateColor("closeButtonColor", value)}
          />
        </div>
      </DesignPanel>

      <DesignPanel title="Behavior">
        <div className="counterpulse-toggle-grid">
          <input
            name="positionMode"
            type="hidden"
            value={values.positionMode}
          />
          {errors.positionMode && (
            <span className="counterpulse-form-error">
              {errors.positionMode}
            </span>
          )}
          <ToggleField
            checked={values.positionMode === "OVERLAY"}
            label="Float over page"
            name="positionOverlay"
            onChange={(checked) =>
              updateValue("positionMode", checked ? "OVERLAY" : "FLOW")
            }
          />
          <input
            name="positionSticky"
            type="hidden"
            value={String(values.positionSticky)}
          />
          <ToggleField
            checked={values.fullWidth}
            label="Full width"
            name="fullWidth"
            onChange={updateFullWidth}
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
            checked={values.showButton}
            label="Show button"
            name="showButton"
            onChange={(checked) => updateValue("showButton", checked)}
          />
        </div>
      </DesignPanel>

      <DesignPanel title="Motion">
        <div className="counterpulse-form-grid counterpulse-form-grid--wide">
          <DesignField label="Entrance effect" error={errors.entranceAnimation}>
            <select
              name="entranceAnimation"
              value={values.entranceAnimation}
              onChange={(event) =>
                updateValue(
                  "entranceAnimation",
                  event.target
                    .value as CampaignDesignValues["entranceAnimation"],
                )
              }
            >
              {designBannerAnimationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </DesignField>
          <DesignField label="Close effect" error={errors.exitAnimation}>
            <select
              name="exitAnimation"
              value={values.exitAnimation}
              onChange={(event) =>
                updateValue(
                  "exitAnimation",
                  event.target.value as CampaignDesignValues["exitAnimation"],
                )
              }
            >
              {designBannerAnimationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </DesignField>
          <NumberField
            error={errors.animationDurationMs}
            label="Duration ms"
            max={1500}
            min={0}
            name="animationDurationMs"
            value={values.animationDurationMs}
            onChange={(value) => updateNumber("animationDurationMs", value)}
          />
          <DesignField label="Timer change" error={errors.timerTickAnimation}>
            <select
              name="timerTickAnimation"
              value={values.timerTickAnimation}
              onChange={(event) =>
                updateValue(
                  "timerTickAnimation",
                  event.target
                    .value as CampaignDesignValues["timerTickAnimation"],
                )
              }
            >
              {designTimerTickAnimationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </DesignField>
        </div>
      </DesignPanel>

      <DesignPanel title="Advanced">
        <DesignField
          label={
            <span className="counterpulse-field-label-row">
              <span>Custom CSS</span>
              {!isProPlan && <ProPlanBadge />}
              <FieldInfoButton
                label="Custom CSS"
                modalClassName="counterpulse-modal--css-reference"
                title="Custom CSS reference"
              >
                <CustomCssInfoContent />
              </FieldInfoButton>
            </span>
          }
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

function ProPlanBadge() {
  return (
    <span className="counterpulse-pro-badge" title="Requires Pro plan">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
        <path d="M8 1.5 9.8 5l3.9.6-2.8 2.7.7 3.9L8 10.3l-3.5 1.9.7-3.9-2.8-2.7L6.2 5 8 1.5Z" />
      </svg>
      Pro
    </span>
  );
}

function CustomCssInfoContent() {
  return (
    <div className="counterpulse-info-copy counterpulse-info-copy--wide">
      <p>
        Custom CSS should target Promo Pulse storefront classes only. Use it for
        small visual adjustments that are not covered by the normal design
        controls.
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
            <code>.pp-progress</code>, and <code>.pp-code</code> for text,
            timer, button, close icon, campaign icon, progress bar, and
            discount-code styling.
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
            and <code>--pp-content-max-width</code>.
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

function applyLayoutDefaults(
  values: CampaignDesignValues,
  layout: CampaignDesignValues["layout"],
): CampaignDesignValues {
  if (layout === "BALANCED") {
    return {
      ...values,
      layout,
      showButton: false,
      timerStyle: "BOXES",
      timerFontSize: Math.min(values.timerFontSize, 24),
      titleFontSize: Math.min(values.titleFontSize, 18),
      subheadingFontSize: Math.min(values.subheadingFontSize, 12),
      legendFontSize: Math.min(values.legendFontSize, 11),
      paddingBlock: Math.min(values.paddingBlock, 14),
      paddingInline: Math.min(values.paddingInline, 18),
      contentGap: Math.min(values.contentGap, 8),
    };
  }

  if (layout === "INLINE") {
    return {
      ...values,
      layout,
      showButton: false,
      timerFormat: "COLON",
      timerShowLabels: false,
      titleFontSize: Math.min(values.titleFontSize, 14),
      timerFontSize: Math.min(values.timerFontSize, 16),
      paddingBlock: Math.min(values.paddingBlock, 10),
    };
  }

  if (layout === "CTA_RIGHT" || layout === "CTA_LEFT" || layout === "CTA_TOP") {
    return {
      ...values,
      layout,
      showButton: true,
    };
  }

  return {
    ...values,
    layout,
  };
}

function PreviewSelectDropdown({
  isOpen,
  label,
  preview,
  selectedLabel,
  children,
  onClose,
  onToggle,
}: {
  isOpen: boolean;
  label: string;
  preview: ReactNode;
  selectedLabel: string;
  children: ReactNode;
  onClose: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={
        isOpen
          ? "counterpulse-preview-select is-open"
          : "counterpulse-preview-select"
      }
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;

        if (
          !(nextTarget instanceof Node) ||
          !event.currentTarget.contains(nextTarget)
        ) {
          onClose();
        }
      }}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label}
        className="counterpulse-preview-select__button"
        type="button"
        onClick={onToggle}
      >
        <span className="counterpulse-preview-select__visual">{preview}</span>
        <span className="counterpulse-preview-select__content">
          <strong>{selectedLabel}</strong>
        </span>
        <span className="counterpulse-preview-select__chevron" aria-hidden />
      </button>
      {isOpen ? (
        <div className="counterpulse-preview-select__menu" role="listbox">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function TemplatePreview({ template }: { template: CampaignDesignTemplate }) {
  return (
    <span
      className="counterpulse-template__swatch counterpulse-template__swatch--dropdown"
      style={{
        background:
          template.backgroundType === "GRADIENT"
            ? `linear-gradient(${template.gradientAngle}deg, ${template.gradientStartColor}, ${template.gradientEndColor})`
            : template.backgroundColor,
        borderColor: template.accentColor,
        color: template.titleColor,
      }}
    >
      <span style={{ background: template.timerColor }} />
    </span>
  );
}

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

async function pickAndResolveShopifyFile(usage: "background" | "icon") {
  const fileId = await pickShopifyFile(usage);

  if (!fileId) return null;

  return resolveShopifyFileWithDirectApi(fileId, usage);
}

async function pickShopifyFile(usage: "background" | "icon") {
  const invoke = window.shopify?.intents?.invoke;

  if (!invoke) {
    throw new Error(
      "Shopify file picker is not available in this admin session.",
    );
  }

  const activity = await invoke("pick:shopify/File", {
    data: {
      mediaTypes:
        usage === "icon" ? ["MediaImage", "GenericFile"] : ["MediaImage"],
      multiSelect: false,
    },
  });
  const response = await activity.complete;

  if (response.code === "closed") return null;

  if (response.code === "error") {
    throw new Error(response.message || "Shopify file picker failed.");
  }

  const ids = Array.isArray(response.data?.ids) ? response.data.ids : [];
  const fileId = ids.find((id): id is string => typeof id === "string");

  if (!fileId) {
    throw new Error("Shopify did not return a selected file ID.");
  }

  return fileId;
}

async function resolveShopifyFileWithDirectApi(
  fileId: string,
  usage: "background" | "icon",
) {
  const response = await fetch("shopify:admin/api/graphql.json", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `#graphql
        query PromoPulseDesignFile($id: ID!) {
          node(id: $id) {
            __typename
            ... on MediaImage {
              id
              alt
              image {
                url
                altText
                width
                height
              }
              preview {
                image {
                  url
                }
              }
            }
            ... on GenericFile {
              id
              alt
              mimeType
              url
              preview {
                image {
                  url
                }
              }
            }
          }
        }`,
      variables: { id: fileId },
    }),
  });
  const payload = await readShopifyJson<ShopifyDesignFileResponse>(response);

  if (!response.ok || payload.errors?.length) {
    throw new Error(
      payload.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join(" ") || "Selected Shopify file could not load.",
    );
  }

  const option = readShopifyDesignFileOption(payload.data?.node, usage);

  if (!option) {
    throw new Error("Choose a supported Shopify image file.");
  }

  return option;
}

function getPickerErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Shopify file picker could not be opened.";
}

type ShopifyDesignFileNode = {
  __typename?: string;
  id?: string | null;
  alt?: string | null;
  mimeType?: string | null;
  url?: string | null;
  image?: {
    url?: string | null;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
  preview?: {
    image?: {
      url?: string | null;
    } | null;
  } | null;
};

type ShopifyDesignFileResponse = {
  data?: {
    node?: ShopifyDesignFileNode | null;
  };
  errors?: Array<{ message?: string }>;
};

async function readShopifyJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      "Shopify did not return file data. Confirm Direct API Access is enabled and redeploy the app configuration.",
    );
  }
}

function readShopifyDesignFileOption(
  node: ShopifyDesignFileNode | null | undefined,
  usage: "background" | "icon",
): CampaignDesignImageOption | null {
  const id = node?.id?.trim() ?? "";
  const mimeType = node?.mimeType?.trim().toLowerCase() ?? "";
  const mediaImageUrl = node?.image?.url?.trim() ?? "";
  const genericFileUrl = node?.url?.trim() ?? "";
  const url = mediaImageUrl || genericFileUrl;
  const previewUrl = node?.preview?.image?.url?.trim() || url;
  const alt = node?.image?.altText?.trim() || node?.alt?.trim() || "";
  const label =
    alt ||
    buildShopifyImageLabel(node?.image?.width, node?.image?.height) ||
    "Shopify image";

  if (!id || !isSafeImageUrl(url)) return null;

  if (
    usage === "icon" &&
    node?.__typename === "GenericFile" &&
    !isSupportedIconMimeType(mimeType)
  ) {
    return null;
  }

  return {
    id,
    label,
    url,
    previewUrl: isSafeImageUrl(previewUrl) ? previewUrl : url,
    ...(alt ? { alt } : {}),
  };
}

function isSupportedIconMimeType(mimeType: string) {
  return ["image/svg+xml", "image/png", "image/jpeg", "image/jpg"].includes(
    mimeType,
  );
}

function buildShopifyImageLabel(width?: number | null, height?: number | null) {
  if (!width || !height) return "";
  return `${width}x${height}`;
}

function isSafeImageUrl(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
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
  label: ReactNode;
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

function ImageBackgroundPicker({
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
    <DesignGroup label="Shopify image" error={error}>
      <div className="counterpulse-library-picker">
        <div className="counterpulse-library-picker__preview">
          {value ? <img alt="" src={value} /> : <span>No image selected</span>}
        </div>
        <div className="counterpulse-library-picker__actions">
          <button
            className="counterpulse-button-secondary counterpulse-button-secondary--small"
            disabled={isPicking}
            type="button"
            onClick={onPickFromShopify}
          >
            {isPicking ? "Opening library..." : "Choose from Shopify library"}
          </button>
        </div>
      </div>
      <input name="backgroundImageUrl" type="hidden" value={value} />
    </DesignGroup>
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
  max?: number;
  onChange: (value: string) => void;
}) {
  return (
    <DesignField label={label} error={error}>
      <div className="counterpulse-number-input">
        <input
          {...(typeof max === "number" ? { max } : {})}
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

function ToggleSwitch({
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
    <label className="counterpulse-switch">
      <input
        aria-label={label}
        checked={checked}
        name={name}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span aria-hidden="true" />
    </label>
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

function TimerStyleHiddenInputs({ values }: { values: CampaignDesignValues }) {
  return (
    <>
      <input name="timerFormat" type="hidden" value={values.timerFormat} />
      <input
        name="timerShowLabels"
        type="hidden"
        value={String(values.timerShowLabels)}
      />
      <input
        name="timerShowSeconds"
        type="hidden"
        value={String(values.timerShowSeconds)}
      />
      <input
        name="timerHideZeroDays"
        type="hidden"
        value={String(values.timerHideZeroDays)}
      />
      <input
        name="timerDaysLabel"
        type="hidden"
        value={values.timerDaysLabel}
      />
      <input
        name="timerHoursLabel"
        type="hidden"
        value={values.timerHoursLabel}
      />
      <input
        name="timerMinutesLabel"
        type="hidden"
        value={values.timerMinutesLabel}
      />
      <input
        name="timerSecondsLabel"
        type="hidden"
        value={values.timerSecondsLabel}
      />
      <input name="timerStyle" type="hidden" value={values.timerStyle} />
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
