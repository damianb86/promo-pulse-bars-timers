import { useState, type ReactNode } from "react";

import { FieldInfoButton } from "./Notifications";
import {
  campaignDesignTemplates,
  designAlignmentOptions,
  designProgressTargetOptions,
  designProgressBarStyleOptions,
  designProgressEffectOptions,
  designBackgroundTypeOptions,
  designBannerAnimationOptions,
  designFontFamilyOptions,
  designIconOptions,
  designLayoutOptions,
  designFloatPositionOptions,
  mobileDesignLayoutValues,
  designOfferApplyBehaviorOptions,
  designOfferCodeLayoutOptions,
  designOfferCopyBehaviorOptions,
  designTimerTickAnimationOptions,
  designTimerFormatOptions,
  designTimerNumberLayoutOptions,
  designTimerStyleOptions,
  designDismissBehaviorOptions,
  type CampaignDesignErrors,
  type DesignBackgroundTypeValue,
  type CampaignDesignImageOption,
  type CampaignDesignMediaOptions,
  type CampaignDesignTemplate,
  type CampaignDesignValues,
} from "../types/campaign-design";
import {
  applyCampaignDesignTemplate,
  applyCampaignLayoutDefaults,
} from "../utils/campaign-design";
import {
  freeShippingProgressStyleOptions,
  type FreeShippingProgressStyleValue,
} from "../types/free-shipping";

type TimerTypeOption = {
  timerStyle: CampaignDesignValues["timerStyle"];
  timerFormat: CampaignDesignValues["timerFormat"];
  label: string;
  description: string;
};

// "Format" (Units/Colon) is folded into the "Type" picker as additional options
// while keeping both fields independent, so every style + format combination
// stays reachable.
const designTimerTypeOptions: TimerTypeOption[] = designTimerStyleOptions.flatMap(
  (styleOption) =>
    designTimerFormatOptions.map((formatOption) => ({
      timerStyle: styleOption.value,
      timerFormat: formatOption.value,
      label:
        formatOption.value === "UNITS"
          ? styleOption.label
          : `${styleOption.label} colon`,
      description: `${styleOption.description} ${formatOption.description}`,
    })),
);

type DesignControlsProps = {
  values: CampaignDesignValues;
  errors?: CampaignDesignErrors;
  hasOffer?: boolean;
  hasTimer?: boolean;
  mediaOptions?: CampaignDesignMediaOptions;
  isProPlan: boolean;
  device?: "desktop" | "mobile";
  progressStyle?: FreeShippingProgressStyleValue;
  structureEdited?: boolean;
  // Slots present in the hand-edited HTML. null = not overridden (don't disable
  // any card). When a Set, cards whose element is absent are disabled.
  presentSlots?: ReadonlySet<string> | null;
  onChange: (values: CampaignDesignValues) => void;
  onProgressStyleChange?: (value: FreeShippingProgressStyleValue) => void;
  onEditStructureHtml?: () => void;
  onEditStructureCss?: () => void;
  onResetStructure?: () => void;
  onAddSlot?: (slot: string) => void;
};

export function DesignControls({
  values,
  errors = {},
  hasOffer = false,
  hasTimer = true,
  isProPlan,
  device = "desktop",
  progressStyle,
  structureEdited = false,
  presentSlots = null,
  onChange,
  onProgressStyleChange,
  onEditStructureHtml,
  onEditStructureCss,
  onResetStructure,
  onAddSlot,
}: DesignControlsProps) {
  // Builds the missing-element list for a panel: for each [slot,label,present],
  // includes an entry (with an Add button) when the slot is absent from the
  // hand-edited HTML. Empty when there is no override (presentSlots null).
  const missingElements = (
    entries: Array<[slot: string, label: string, present?: boolean]>,
  ): MissingElement[] => {
    if (!presentSlots || !onAddSlot) return [];
    return entries
      .filter(([slot, , present]) =>
        present === undefined ? !presentSlots.has(slot) : !present,
      )
      .map(([slot, label]) => ({
        label,
        onAdd: () => onAddSlot(slot),
      }));
  };
  const timerPresent = presentSlots
    ? presentSlots.has("timer") || presentSlots.has("timer-inline")
    : true;
  // The Progress panel shows for free-shipping campaigns (existing) and whenever
  // the HTML has a progress slot (e.g. a timer-target progress bar).
  const showProgressPanel =
    Boolean(progressStyle && onProgressStyleChange) ||
    (presentSlots ? presentSlots.has("progress") : false);
  const [customIconError, setCustomIconError] = useState<string | null>(null);
  const [backgroundImageError, setBackgroundImageError] = useState<
    string | null
  >(null);
  const [isBackgroundPickerBusy, setIsBackgroundPickerBusy] = useState(false);
  const [isIconPickerBusy, setIsIconPickerBusy] = useState(false);
  const [openTemplateDropdown, setOpenTemplateDropdown] = useState<
    "layout" | "preset" | null
  >(null);
  const isMobileSurface = device === "mobile";
  const mobileLayoutSet = new Set<CampaignDesignValues["layout"]>(
    mobileDesignLayoutValues,
  );
  // Desktop editing offers the desktop layouts; the mobile design surface
  // offers the mobile-tuned layouts. Both render responsively. The currently
  // selected layout is always kept available so an existing value never
  // disappears from the picker.
  const visibleLayoutOptions = designLayoutOptions.filter((option) => {
    const isMobileLayout = mobileLayoutSet.has(option.value);
    return (
      option.value === values.layout ||
      (isMobileSurface ? isMobileLayout : !isMobileLayout)
    );
  });
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

  const updateValues = (updates: Partial<CampaignDesignValues>) => {
    onChange({ ...values, ...updates });
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
    onChange(applyCampaignLayoutDefaults({ ...values, layout }));
    setOpenTemplateDropdown(null);
    // Layout changes the structural HTML, so drop any custom HTML override and
    // regenerate it from the new layout. Other settings keep their override.
    onResetStructure?.();
  };

  const selectTemplate = (template: CampaignDesignTemplate) => {
    onChange(applyCampaignDesignTemplate(template.templateKey, values));
    setOpenTemplateDropdown(null);
    onResetStructure?.();
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
            {visibleLayoutOptions.map((option) => (
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

        {(onEditStructureHtml || onEditStructureCss) && (
          <DesignGroup label="HTML & CSS">
            <div className="counterpulse-structure-html-row">
              {onEditStructureHtml && (
                <button
                  className="counterpulse-button-secondary"
                  type="button"
                  onClick={onEditStructureHtml}
                >
                  View / edit HTML
                </button>
              )}
              {onEditStructureCss && (
                <button
                  className="counterpulse-button-secondary"
                  type="button"
                  onClick={onEditStructureCss}
                >
                  View / edit CSS
                </button>
              )}
            </div>
            <p className="counterpulse-design-note">
              {structureEdited
                ? "Custom HTML/CSS is in use. Changing the layout or preset above resets it."
                : "Structure & styles are generated from the design settings."}
            </p>
          </DesignGroup>
        )}
      </DesignPanel>

      <CardDesignPanel
        backgroundImageError={backgroundImageError ?? errors.backgroundImageUrl}
        errors={errors}
        isBackgroundPickerBusy={isBackgroundPickerBusy}
        values={values}
        onAlignmentChange={(value) => updateValue("alignment", value)}
        onBackgroundImagePick={selectShopifyBackgroundImage}
        onBackgroundTypeChange={(value) => updateValue("backgroundType", value)}
        onColorChange={updateColor}
        onNumberChange={updateNumber}
      />

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

      <DesignPanel
        title="Timer Style"
        missingElements={missingElements([["timer", "timer", timerPresent]])}
      >
        {hasTimer ? (
          <>
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
              <div className="counterpulse-timer-style-picker counterpulse-timer-style-picker--combined">
                {designTimerTypeOptions.map((option) => {
                  const isActive =
                    values.timerStyle === option.timerStyle &&
                    values.timerFormat === option.timerFormat;

                  return (
                    <button
                      aria-pressed={isActive}
                      className={
                        isActive
                          ? "counterpulse-timer-style-option is-active"
                          : "counterpulse-timer-style-option"
                      }
                      key={`${option.timerStyle}-${option.timerFormat}`}
                      type="button"
                      title={option.description}
                      onClick={() =>
                        updateValues({
                          timerStyle: option.timerStyle,
                          timerFormat: option.timerFormat,
                        })
                      }
                    >
                      <TimerStylePreview
                        timerStyle={option.timerStyle}
                        timerFormat={option.timerFormat}
                      />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <input
                name="timerStyle"
                type="hidden"
                value={values.timerStyle}
              />
              <input
                name="timerFormat"
                type="hidden"
                value={values.timerFormat}
              />

              {values.timerFormat !== "COLON" && (
                <>
                  <span className="counterpulse-design-sublabel">
                    Number layout
                  </span>
                  <div className="counterpulse-segmented counterpulse-segmented--compact counterpulse-segmented--fit">
                    {designTimerNumberLayoutOptions.map((option) => (
                      <button
                        className={
                          values.timerNumberLayout === option.value
                            ? "is-active"
                            : ""
                        }
                        key={option.value}
                        type="button"
                        title={option.description}
                        onClick={() =>
                          updateValue("timerNumberLayout", option.value)
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {errors.timerNumberLayout && (
                    <span className="counterpulse-form-error">
                      {errors.timerNumberLayout}
                    </span>
                  )}
                </>
              )}
              <input
                name="timerNumberLayout"
                type="hidden"
                value={values.timerNumberLayout}
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

      {showProgressPanel ? (
        <DesignPanel
          title="Progress"
          missingElements={missingElements([["progress", "progress bar"]])}
        >
          <div className="counterpulse-form-grid counterpulse-form-grid--wide">
            <ToggleField
              checked={values.showProgressBar}
              label="Show progress bar"
              name="showProgressBar"
              onChange={(checked) => updateValue("showProgressBar", checked)}
            />
            <DesignGroup label="Tracks">
              <select
                aria-label="Progress target"
                name="progressTarget"
                value={values.progressTarget}
                onChange={(event) =>
                  updateValue("progressTarget", event.currentTarget.value)
                }
              >
                {designProgressTargetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </DesignGroup>
            <DesignGroup label="Style">
              <select
                aria-label="Progress bar style"
                name="progressBarStyle"
                value={values.progressBarStyle}
                onChange={(event) =>
                  updateValue("progressBarStyle", event.currentTarget.value)
                }
              >
                {designProgressBarStyleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </DesignGroup>
            {values.progressBarStyle === "STEPS" && (
              <NumberField
                label="Steps"
                max={12}
                min={2}
                name="progressSteps"
                value={values.progressSteps}
                onChange={(value) => updateNumber("progressSteps", value)}
              />
            )}
            <NumberField
              label="Height"
              max={48}
              min={2}
              name="progressHeight"
              value={values.progressHeight}
              onChange={(value) => updateNumber("progressHeight", value)}
            />
            <NumberField
              label="Corner radius"
              max={999}
              min={0}
              name="progressRadius"
              value={values.progressRadius}
              onChange={(value) => updateNumber("progressRadius", value)}
            />
            <ColorField
              label="Track color"
              name="progressTrackColor"
              value={values.progressTrackColor}
              onChange={(value) => updateColor("progressTrackColor", value)}
            />
            <ColorField
              label="Fill color"
              name="progressFillColor"
              value={values.progressFillColor}
              onChange={(value) => updateColor("progressFillColor", value)}
            />
            <ColorField
              label="Label color"
              name="progressTextColor"
              value={values.progressTextColor}
              onChange={(value) => updateColor("progressTextColor", value)}
            />
            <DesignGroup label="Effect">
              <select
                aria-label="Progress effect"
                name="progressEffect"
                value={values.progressEffect}
                onChange={(event) =>
                  updateValue("progressEffect", event.currentTarget.value)
                }
              >
                {designProgressEffectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </DesignGroup>
            <ToggleField
              checked={values.progressShowLabel}
              label="Show percentage label"
              name="progressShowLabel"
              onChange={(checked) => updateValue("progressShowLabel", checked)}
            />
            {progressStyle && onProgressStyleChange && (
              <DesignGroup label="Free-shipping progress text">
                <select
                  aria-label="Free shipping progress style"
                  value={progressStyle}
                  onChange={(event) =>
                    onProgressStyleChange(
                      event.currentTarget
                        .value as FreeShippingProgressStyleValue,
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
            )}
            {values.progressTarget === "TIMER" && (
              <p className="counterpulse-design-note">
                The timer target needs a fixed start and end date on the campaign
                so the elapsed percentage can be calculated.
              </p>
            )}
          </div>
        </DesignPanel>
      ) : (
        <ProgressHiddenInputs values={values} />
      )}

      <DesignPanel
        title="Elements"
        missingElements={missingElements([
          ["icon", "icon"],
          ["close", "close button"],
        ])}
      >
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
          <NumberField
            error={errors.closeButtonSize}
            label="Close icon size"
            max={44}
            min={12}
            name="closeButtonSize"
            value={values.closeButtonSize}
            onChange={(value) => updateNumber("closeButtonSize", value)}
          />
        </div>
      </DesignPanel>

      {hasOffer ? (
        <OfferDesignPanel
          errors={errors}
          values={values}
          missingElements={missingElements([["offer", "discount code"]])}
          onColorChange={updateColor}

          onNumberChange={updateNumber}
          onValueChange={updateValue}
        />
      ) : (
        <OfferDesignHiddenInputs values={values} />
      )}

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
            label="Show on mobile"
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
        {values.positionMode === "OVERLAY" ? (
          <div className="counterpulse-float-config">
            <DesignField
              label="Float positioning"
              error={errors.floatPosition}
            >
              <select
                name="floatPosition"
                value={values.floatPosition}
                onChange={(event) =>
                  updateValue(
                    "floatPosition",
                    event.target
                      .value as CampaignDesignValues["floatPosition"],
                  )
                }
              >
                {designFloatPositionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </DesignField>
            <div className="counterpulse-form-grid counterpulse-form-grid--wide">
              <DesignField label="Top" error={errors.floatOffsetTop}>
                <input
                  name="floatOffsetTop"
                  value={values.floatOffsetTop}
                  placeholder="0 / auto"
                  onChange={(event) =>
                    updateValue("floatOffsetTop", event.target.value)
                  }
                />
              </DesignField>
              <DesignField label="Bottom" error={errors.floatOffsetBottom}>
                <input
                  name="floatOffsetBottom"
                  value={values.floatOffsetBottom}
                  placeholder="0 / auto"
                  onChange={(event) =>
                    updateValue("floatOffsetBottom", event.target.value)
                  }
                />
              </DesignField>
              <DesignField label="Left" error={errors.floatOffsetLeft}>
                <input
                  name="floatOffsetLeft"
                  value={values.floatOffsetLeft}
                  placeholder="0 / auto"
                  onChange={(event) =>
                    updateValue("floatOffsetLeft", event.target.value)
                  }
                />
              </DesignField>
              <DesignField label="Right" error={errors.floatOffsetRight}>
                <input
                  name="floatOffsetRight"
                  value={values.floatOffsetRight}
                  placeholder="0 / auto"
                  onChange={(event) =>
                    updateValue("floatOffsetRight", event.target.value)
                  }
                />
              </DesignField>
            </div>
            <p className="counterpulse-field-hint">
              Enter a number (px), a CSS length like 24px / 10% / 1rem, or
              "auto". The defaults (top, left and right at 0, bottom auto) keep
              the banner full-width across the top of the page.
            </p>
          </div>
        ) : (
          <>
            <input
              name="floatPosition"
              type="hidden"
              value={values.floatPosition}
            />
            <input
              name="floatOffsetTop"
              type="hidden"
              value={values.floatOffsetTop}
            />
            <input
              name="floatOffsetBottom"
              type="hidden"
              value={values.floatOffsetBottom}
            />
            <input
              name="floatOffsetLeft"
              type="hidden"
              value={values.floatOffsetLeft}
            />
            <input
              name="floatOffsetRight"
              type="hidden"
              value={values.floatOffsetRight}
            />
          </>
        )}
        {values.showCloseButton && (
          <DesignField
            label="When a shopper closes it"
            error={errors.dismissBehavior}
          >
            <select
              name="dismissBehavior"
              value={values.dismissBehavior}
              onChange={(event) =>
                updateValue(
                  "dismissBehavior",
                  event.target
                    .value as CampaignDesignValues["dismissBehavior"],
                )
              }
            >
              {designDismissBehaviorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </DesignField>
        )}
        {!values.showCloseButton && (
          <input
            name="dismissBehavior"
            type="hidden"
            value={values.dismissBehavior}
          />
        )}
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

function OfferDesignPanel({
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

function OfferDesignHiddenInputs({ values }: { values: CampaignDesignValues }) {
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

function CardDesignPanel({
  values,
  errors,
  backgroundImageError,
  isBackgroundPickerBusy,
  onBackgroundTypeChange,
  onBackgroundImagePick,
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
  onNumberChange: (key: NumberDesignKey, value: string) => void;
  onColorChange: (key: ColorDesignKey, value: string) => void;
  onAlignmentChange: (value: CampaignDesignValues["alignment"]) => void;
}) {
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
              onChange={onAlignmentChange}
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

function CardSectionHeader({
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

function CardBackgroundOption({
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

function CardBackgroundVisual({
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

function CardColorField({
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

function CardNumberField({
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

function CardSelectField({
  name,
  label,
  description,
  icon,
  value,
  error,
  onChange,
}: {
  name: "alignment";
  label: string;
  description: string;
  icon: ReactNode;
  value: CampaignDesignValues["alignment"];
  error?: string;
  onChange: (value: CampaignDesignValues["alignment"]) => void;
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
        <select
          name={name}
          value={value}
          onChange={(event) =>
            onChange(event.target.value as CampaignDesignValues["alignment"])
          }
        >
          {designAlignmentOptions.map((option) => (
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

function CardImagePicker({
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

function getBackgroundTypeDetail(type: DesignBackgroundTypeValue) {
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

type CardControlIconKind =
  | "align"
  | "borderSize"
  | "duration"
  | "eyedropper"
  | "gap"
  | "horizontalPadding"
  | "iconSize"
  | "image"
  | "maxWidth"
  | "radius"
  | "timer"
  | "typography"
  | "verticalPadding";

function CardControlIcon({ kind }: { kind: CardControlIconKind }) {
  const common = {
    "aria-hidden": true,
    focusable: false,
    viewBox: "0 0 24 24",
  };

  if (kind === "image") {
    return (
      <svg {...common}>
        <rect
          x="4"
          y="5"
          width="16"
          height="14"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="m7 16 3.5-4 2.5 3 2-2.3L18 16"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      </svg>
    );
  }

  if (kind === "eyedropper") {
    return (
      <svg {...common}>
        <path
          d="m14.5 5.5 4 4M13 7l4 4-7.8 7.8H5.2V14.8L13 7Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "radius") {
    return (
      <svg {...common}>
        <path
          d="M6 15v-3a6 6 0 0 1 6-6h3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "borderSize") {
    return (
      <svg {...common}>
        <path
          d="M7 8h10M9 12h6M10.5 16h3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "align") {
    return (
      <svg {...common}>
        <path
          d="M5 7h11M5 12h14M5 17h8M16 9l3 3-3 3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "verticalPadding") {
    return (
      <svg {...common}>
        <path
          d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "horizontalPadding") {
    return (
      <svg {...common}>
        <path
          d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "gap") {
    return (
      <svg {...common}>
        <rect
          x="5"
          y="5"
          width="5"
          height="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="14"
          y="14"
          width="5"
          height="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "typography") {
    return (
      <svg {...common}>
        <path
          d="M5 6h14M12 6v12M9 18h6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "timer") {
    return (
      <svg {...common}>
        <circle
          cx="12"
          cy="12"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M12 8v4l2.5 2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "duration") {
    return (
      <svg {...common}>
        <path
          d="M5 12h4l2-6 2 12 2-6h4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (kind === "iconSize") {
    return (
      <svg {...common}>
        <path
          d="M7 7h10v10H7zM4 10V4h6M20 14v6h-6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4M8 12h8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

// Submits the progress design fields as hidden inputs when the Progress panel is
// not shown, so saving never resets them to defaults.
function ProgressHiddenInputs({ values }: { values: CampaignDesignValues }) {
  return (
    <>
      <input
        name="showProgressBar"
        type="hidden"
        value={String(values.showProgressBar)}
      />
      <input name="progressTarget" type="hidden" value={values.progressTarget} />
      <input
        name="progressBarStyle"
        type="hidden"
        value={values.progressBarStyle}
      />
      <input name="progressSteps" type="hidden" value={values.progressSteps} />
      <input name="progressHeight" type="hidden" value={values.progressHeight} />
      <input name="progressRadius" type="hidden" value={values.progressRadius} />
      <input
        name="progressTrackColor"
        type="hidden"
        value={values.progressTrackColor}
      />
      <input
        name="progressFillColor"
        type="hidden"
        value={values.progressFillColor}
      />
      <input
        name="progressTextColor"
        type="hidden"
        value={values.progressTextColor}
      />
      <input name="progressEffect" type="hidden" value={values.progressEffect} />
      <input
        name="progressShowLabel"
        type="hidden"
        value={String(values.progressShowLabel)}
      />
    </>
  );
}

type MissingElement = { label: string; onAdd: () => void };

function DesignPanel({
  title,
  children,
  missingElements,
}: {
  title: string;
  children: ReactNode;
  // Structural elements this panel configures that are NOT present in the
  // hand-edited HTML. When non-empty the panel is disabled and offers to add
  // each missing element back.
  missingElements?: MissingElement[] | null;
}) {
  const missing = missingElements ?? [];
  const isDisabled = missing.length > 0;
  return (
    <section
      className={
        isDisabled
          ? "counterpulse-design-card counterpulse-design-card--disabled"
          : "counterpulse-design-card"
      }
    >
      <h3>
        <DesignSectionIcon title={title} />
        <span>{title}</span>
      </h3>
      {isDisabled && (
        <div className="counterpulse-design-card__missing" role="note">
          <p>
            {missing.length > 1 ? "These elements aren’t" : "The "}
            {missing.length === 1 && <strong>{missing[0].label}</strong>}
            {missing.length === 1
              ? " element isn’t"
              : ` (${missing.map((m) => m.label).join(", ")})`}{" "}
            in your campaign HTML, so these settings have no effect. Add{" "}
            {missing.length > 1 ? "them" : "it"} to the HTML to use these
            controls.
          </p>
          <div className="counterpulse-design-card__missing-actions">
            {missing.map((element) => (
              <button
                key={element.label}
                className="counterpulse-button-secondary"
                type="button"
                onClick={element.onAdd}
              >
                Add {element.label} to HTML
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="counterpulse-design-card__body">{children}</div>
    </section>
  );
}

const designSectionIconPaths: Record<string, ReactNode> = {
  Template: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  Typography: (
    <>
      <path d="M5 18 10 6l5 12" />
      <path d="M6.7 14h6.6" />
      <path d="M16 18h3.5" />
    </>
  ),
  "Timer Style": (
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 9.5V13l2.4 1.6" />
      <path d="M9.5 3h5" />
    </>
  ),
  Card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
    </>
  ),
  Progress: (
    <>
      <rect x="3" y="9.5" width="18" height="5" rx="2.5" />
      <path d="M3 12h11" />
    </>
  ),
  Elements: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <circle cx="17" cy="7" r="4" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
      <path d="M3 17h8" />
    </>
  ),
  Behavior: (
    <>
      <path d="M5 4l5.5 15 2.2-6.3 6.3-2.2z" />
      <path d="M13.5 13.5 19 19" />
    </>
  ),
  Motion: (
    <>
      <path d="M3 8h10" />
      <path d="M3 12h7" />
      <path d="M3 16h12" />
      <path d="M16 6l5 6-5 6" />
    </>
  ),
  Advanced: (
    <>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 17h2" />
      <path d="M10 17h10" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  "Offer code": (
    <>
      <path d="M4 12.2 12.2 4H20v7.8L11.8 20z" />
      <circle cx="16.5" cy="7.5" r="1.2" />
    </>
  ),
  Default: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </>
  ),
};

function DesignSectionIcon({ title }: { title: string }) {
  const paths = designSectionIconPaths[title] ?? designSectionIconPaths.Default;

  return (
    <svg
      className="counterpulse-design-card__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
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
    <div className="counterpulse-form-field counterpulse-design-control-field">
      <span className="counterpulse-card-field__label">
        <span className="counterpulse-design-field-title">{label}</span>
      </span>
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
    <label className="counterpulse-form-field counterpulse-design-control-field">
      <span className="counterpulse-card-field__label">
        <span className="counterpulse-design-field-title">{label}</span>
      </span>
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
      <span className="counterpulse-card-color-control counterpulse-design-color-control">
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
      <span className="counterpulse-card-number-control counterpulse-design-number-control">
        <span
          className="counterpulse-card-number-control__icon"
          aria-hidden="true"
        >
          <CardControlIcon kind={getNumberFieldIcon(name)} />
        </span>
        <input
          {...(typeof max === "number" ? { max } : {})}
          min={min}
          name={name}
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="counterpulse-card-number-control__unit">
          {getNumberFieldUnit(name)}
        </span>
      </span>
    </DesignField>
  );
}

function getNumberFieldIcon(name: NumberDesignKey): CardControlIconKind {
  if (
    name === "titleFontSize" ||
    name === "subheadingFontSize" ||
    name === "legendFontSize" ||
    name === "offerCodeFontSize"
  ) {
    return "typography";
  }

  if (name === "timerFontSize") return "timer";
  if (name === "timerSurfaceRadius" || name === "offerCodeBorderRadius") {
    return "radius";
  }
  if (name === "timerSurfaceBorderSize") return "borderSize";
  if (name === "animationDurationMs") return "duration";
  if (name === "iconSize") return "iconSize";
  if (name === "contentGap" || name === "offerCodeGap") return "gap";
  if (name === "contentMaxWidth") return "maxWidth";
  if (name === "paddingBlock" || name === "offerCodePaddingBlock") {
    return "verticalPadding";
  }
  if (name === "paddingInline" || name === "offerCodePaddingInline") {
    return "horizontalPadding";
  }

  return "maxWidth";
}

function getNumberFieldUnit(name: NumberDesignKey) {
  if (name === "animationDurationMs") return "ms";

  return "px";
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
  timerFormat = "UNITS",
}: {
  timerStyle: CampaignDesignValues["timerStyle"];
  timerFormat?: CampaignDesignValues["timerFormat"];
}) {
  const isColonBoxes = timerFormat === "COLON" && timerStyle === "BOXES";

  return (
    <span
      className={[
        "counterpulse-timer-style-preview",
        `counterpulse-timer-style-preview--${timerStyle.toLowerCase()}`,
        `counterpulse-timer-style-preview--${timerFormat.toLowerCase()}`,
        isColonBoxes ? "counterpulse-timer-style-preview--colon-boxes" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {isColonBoxes ? (
        <>
          <span>01</span>
          <em>:</em>
          <span>58</span>
          <em>:</em>
          <span>26</span>
        </>
      ) : timerFormat === "COLON" ? (
        <span>01:58:26</span>
      ) : (
        <>
          <span>01</span>
          <span>58</span>
          <span>26</span>
        </>
      )}
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
