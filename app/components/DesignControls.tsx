import { useState } from "react";

import { FieldInfoButton } from "./Notifications";
import {
  campaignDesignTemplates,
  designProgressTargetOptions,
  designProgressBarStyleOptions,
  designProgressEffectOptions,
  designBannerAnimationOptions,
  designFontFamilyOptions,
  designIconOptions,
  designLayoutOptions,
  designFloatPositionOptions,
  mobileDesignLayoutValues,
  designTimerTickAnimationOptions,
  designTimerFormatOptions,
  designTimerNumberLayoutOptions,
  designTimerStyleOptions,
  designDismissBehaviorOptions,
  type CampaignDesignErrors,
  type CampaignDesignMediaOptions,
  type CampaignDesignTemplate,
  type CampaignDesignValues,
} from "../types/campaign-design";
import {
  applyCampaignDesignTemplate,
  applyCampaignLayoutDefaults,
} from "../utils/campaign-design";
import { type FreeShippingProgressStyleValue } from "../types/free-shipping";
import { CardDesignPanel } from "./design-controls/CardDesignPanel";
import {
  ColorDesignKey,
  ColorField,
  DesignField,
  DesignGroup,
  DesignPanel,
  DesignPanelFilterContext,
  ElementPanel,
  EditIcon,
  LayoutPreview,
  MissingElement,
  NumberDesignKey,
  NumberField,
  PreviewSelectDropdown,
  ProgressHiddenInputs,
  TemplatePreview,
  TimerStyleHiddenInputs,
  TimerStylePreview,
  ToggleField,
  ToggleSwitch,
  getPickerErrorMessage,
  pickAndResolveShopifyFile,
} from "./design-controls/shared";
import {
  CustomCssInfoContent,
  OfferDesignHiddenInputs,
  OfferDesignPanel,
  ProPlanBadge,
} from "./design-controls/OfferDesignPanel";

export { pickAndResolveShopifyFile } from "./design-controls/shared";

type TimerTypeOption = {
  timerStyle: CampaignDesignValues["timerStyle"];
  timerFormat: CampaignDesignValues["timerFormat"];
  label: string;
  description: string;
};

type DesignControlsPlacement =
  | "TOP_BAR"
  | "BOTTOM_BAR"
  | "PRODUCT_PAGE"
  | "CART_PAGE"
  | "CART_DRAWER"
  | "PRODUCT_BADGE"
  | string;

// "Format" (Units/Colon) is folded into the "Type" picker as additional options
// while keeping both fields independent, so every style + format combination
// stays reachable.
const designTimerTypeOptions: TimerTypeOption[] =
  designTimerStyleOptions.flatMap((styleOption) =>
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

// Restricts which DesignControls panels render (by title). Used by the inspector
// modal to embed just the relevant component panel.

type DesignControlsProps = {
  values: CampaignDesignValues;
  errors?: CampaignDesignErrors;
  hasOffer?: boolean;
  hasTimer?: boolean;
  mediaOptions?: CampaignDesignMediaOptions;
  isProPlan: boolean;
  device?: "desktop" | "mobile";
  placement?: DesignControlsPlacement;
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
  onRemoveSlot?: (slot: string) => void;
  // Switches the editor to the Campaign → Schedule tab (timer progress target).
  onGoToSchedule?: () => void;
  // Only render these panels (by title). Undefined = all panels.
  panelFilter?: ReadonlySet<string>;
};

export function DesignControls({
  values,
  errors = {},
  hasOffer = false,
  hasTimer = true,
  isProPlan,
  device = "desktop",
  placement,
  progressStyle,
  structureEdited = false,
  presentSlots = null,
  onChange,
  onProgressStyleChange,
  onEditStructureHtml,
  onEditStructureCss,
  onResetStructure,
  onAddSlot,
  onRemoveSlot,
  onGoToSchedule,
  panelFilter,
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
  // Whether an element is currently part of the campaign. For a hand-edited
  // structure the slot presence is authoritative; for a generated one the show*
  // flag (or icon !== NONE) is. This lets each element panel offer "remove" /
  // "add" instead of a raw show/hide checkbox.
  const isElementPresent = (slot: string, generatedFlag: boolean) =>
    presentSlots ? presentSlots.has(slot) : generatedFlag;

  // Adds an element to the campaign: raises its show* flag AND (when the HTML is
  // hand-edited) re-inserts its slot. Lowering/raising the flag keeps the
  // generated structure and the storefront gating in sync.
  const addElement = (slot: string, updates: Partial<CampaignDesignValues>) => {
    updateValues(updates);
    if (presentSlots && onAddSlot) onAddSlot(slot);
  };

  const removeElement = (
    slot: string,
    updates: Partial<CampaignDesignValues>,
  ) => {
    updateValues(updates);
    if (presentSlots && onRemoveSlot) onRemoveSlot(slot);
  };

  const iconPresent = isElementPresent("icon", values.showIcon);
  const buttonPresent = isElementPresent("cta", values.showButton);
  const closePresent = isElementPresent("close", values.showCloseButton);
  // Add/remove is only offered in the full editor. Inside the visual inspector
  // (no add/remove callbacks) each element panel just shows its settings.
  const canManageElements = Boolean(onAddSlot || onRemoveSlot);

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
  const stickyLabel =
    placement === "TOP_BAR"
      ? "Stick to top while scrolling"
      : placement === "BOTTOM_BAR"
        ? "Stick to bottom while scrolling"
        : "";
  const showStickyToggle = Boolean(stickyLabel);

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
    <DesignPanelFilterContext.Provider value={panelFilter ?? null}>
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
                    <small>{template.description}</small>
                  </span>
                </button>
              ))}
            </PreviewSelectDropdown>
            <input
              name="templateKey"
              type="hidden"
              value={values.templateKey}
            />
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
          backgroundImageError={
            backgroundImageError ?? errors.backgroundImageUrl
          }
          errors={errors}
          isBackgroundPickerBusy={isBackgroundPickerBusy}
          values={values}
          onAlignmentChange={(value) => updateValue("alignment", value)}
          onBackgroundImagePick={selectShopifyBackgroundImage}
          onBackgroundImageSettingChange={(key, value) =>
            updateValue(key, value)
          }
          onBackgroundTypeChange={(value) =>
            updateValue("backgroundType", value)
          }
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

              <div className="counterpulse-form-grid counterpulse-form-grid--wide">
                <NumberField
                  error={errors.timerNumberFontSize}
                  label="Number size"
                  max={72}
                  min={12}
                  name="timerNumberFontSize"
                  value={values.timerNumberFontSize}
                  onChange={(value) =>
                    updateNumber("timerNumberFontSize", value)
                  }
                />
                <NumberField
                  error={errors.timerLabelFontSize}
                  label="Label size"
                  max={28}
                  min={8}
                  name="timerLabelFontSize"
                  value={values.timerLabelFontSize}
                  onChange={(value) =>
                    updateNumber("timerLabelFontSize", value)
                  }
                />
                <NumberField
                  error={errors.timerGap}
                  label="Number spacing"
                  max={32}
                  min={0}
                  name="timerGap"
                  value={values.timerGap}
                  onChange={(value) => updateNumber("timerGap", value)}
                />
                <NumberField
                  error={errors.timerUnitGap}
                  label="Number-label gap"
                  max={18}
                  min={0}
                  name="timerUnitGap"
                  value={values.timerUnitGap}
                  onChange={(value) => updateNumber("timerUnitGap", value)}
                />
                <ColorField
                  error={errors.timerColor}
                  label="Number color"
                  name="timerColor"
                  value={values.timerColor}
                  onChange={(value) => updateColor("timerColor", value)}
                />
                <ColorField
                  error={errors.legendColor}
                  label="Label color"
                  name="legendColor"
                  value={values.legendColor}
                  onChange={(value) => updateColor("legendColor", value)}
                />
              </div>
              {/* "Timer size"/"Legend size" were duplicates of Number/Label size;
                the values are kept (fed as fallbacks in the CSS vars) but no
                longer separately editable. */}
              <input
                name="timerFontSize"
                type="hidden"
                value={values.timerFontSize}
              />
              <input
                name="legendFontSize"
                type="hidden"
                value={values.legendFontSize}
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
                  <NumberField
                    error={errors.timerPaddingBlock}
                    label={
                      values.timerStyle === "BOXES"
                        ? "Box vertical padding"
                        : "Group vertical padding"
                    }
                    max={32}
                    min={0}
                    name="timerPaddingBlock"
                    value={values.timerPaddingBlock}
                    onChange={(value) =>
                      updateNumber("timerPaddingBlock", value)
                    }
                  />
                  <NumberField
                    error={errors.timerPaddingInline}
                    label={
                      values.timerStyle === "BOXES"
                        ? "Box horizontal padding"
                        : "Group horizontal padding"
                    }
                    max={40}
                    min={0}
                    name="timerPaddingInline"
                    value={values.timerPaddingInline}
                    onChange={(value) =>
                      updateNumber("timerPaddingInline", value)
                    }
                  />
                  <ColorField
                    error={errors.timerSurfaceColor}
                    label={
                      values.timerStyle === "BOXES"
                        ? "Box background"
                        : "Group background"
                    }
                    name="timerSurfaceColor"
                    value={values.timerSurfaceColor}
                    onChange={(value) =>
                      updateColor("timerSurfaceColor", value)
                    }
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
                  <input
                    name="timerPaddingBlock"
                    type="hidden"
                    value={values.timerPaddingBlock}
                  />
                  <input
                    name="timerPaddingInline"
                    type="hidden"
                    value={values.timerPaddingInline}
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
                onChange={(checked) =>
                  updateValue("progressShowLabel", checked)
                }
              />
              {values.progressTarget === "TIMER" && (
                <p className="counterpulse-design-note">
                  The timer target uses the campaign’s start and end dates to
                  calculate the elapsed percentage.{" "}
                  {onGoToSchedule ? (
                    <button
                      className="counterpulse-inline-link"
                      type="button"
                      onClick={onGoToSchedule}
                    >
                      Set the start &amp; end date in Campaign schedule
                    </button>
                  ) : (
                    "Set a fixed start and end date in the Campaign schedule."
                  )}
                </p>
              )}
            </div>
          </DesignPanel>
        ) : (
          <ProgressHiddenInputs values={values} />
        )}

        <ElementPanel
          title="Icon"
          present={iconPresent}
          canManage={canManageElements}
          emptyText="This campaign has no icon."
          addLabel="Add icon"
          removeLabel="Remove icon"
          onAdd={() =>
            addElement("icon", {
              icon: values.icon !== "NONE" ? values.icon : "FIRE",
              showIcon: true,
            })
          }
          onRemove={() =>
            removeElement("icon", {
              icon: "NONE",
              showIcon: false,
              customIconUrl: "",
            })
          }
        >
          <div className="counterpulse-form-grid counterpulse-form-grid--wide">
            <DesignField label="Icon" error={errors.icon}>
              <select
                name="icon"
                value={values.icon === "NONE" ? "FIRE" : values.icon}
                onChange={(event) =>
                  updateIcon(event.target.value as CampaignDesignValues["icon"])
                }
              >
                {designIconOptions
                  .filter((option) => option.value !== "NONE")
                  .map((option) => (
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
            <input name="showIcon" type="hidden" value="true" />
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
          </div>
        </ElementPanel>
        {canManageElements && !iconPresent && (
          <>
            <input name="icon" type="hidden" value="NONE" />
            <input name="showIcon" type="hidden" value="false" />
            <input name="customIconUrl" type="hidden" value="" />
            <input
              name="iconSize"
              type="hidden"
              value={String(values.iconSize)}
            />
            <input
              name="accentColor"
              type="hidden"
              value={values.accentColor}
            />
          </>
        )}

        <ElementPanel
          title="Button"
          present={buttonPresent}
          canManage={canManageElements}
          emptyText="This campaign has no call-to-action button."
          addLabel="Add button"
          removeLabel="Remove button"
          onAdd={() => addElement("cta", { showButton: true })}
          onRemove={() => removeElement("cta", { showButton: false })}
        >
          <div className="counterpulse-form-grid counterpulse-form-grid--wide">
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
              error={errors.buttonHoverColor}
              label="Button (hover)"
              name="buttonHoverColor"
              value={values.buttonHoverColor}
              onChange={(value) => updateColor("buttonHoverColor", value)}
            />
            <ColorField
              error={errors.buttonTextHoverColor}
              label="Button text (hover)"
              name="buttonTextHoverColor"
              value={values.buttonTextHoverColor}
              onChange={(value) => updateColor("buttonTextHoverColor", value)}
            />
          </div>
          <input name="showButton" type="hidden" value="true" />
        </ElementPanel>
        {canManageElements && !buttonPresent && (
          <>
            <input name="showButton" type="hidden" value="false" />
            <input
              name="buttonColor"
              type="hidden"
              value={values.buttonColor}
            />
            <input
              name="buttonTextColor"
              type="hidden"
              value={values.buttonTextColor}
            />
            <input
              name="buttonHoverColor"
              type="hidden"
              value={values.buttonHoverColor}
            />
            <input
              name="buttonTextHoverColor"
              type="hidden"
              value={values.buttonTextHoverColor}
            />
          </>
        )}

        <ElementPanel
          title="Close button"
          present={closePresent}
          canManage={canManageElements}
          emptyText="Shoppers can’t dismiss this campaign."
          addLabel="Add close button"
          removeLabel="Remove close button"
          onAdd={() => addElement("close", { showCloseButton: true })}
          onRemove={() => removeElement("close", { showCloseButton: false })}
        >
          <div className="counterpulse-form-grid counterpulse-form-grid--wide">
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
                  event.target.value as CampaignDesignValues["dismissBehavior"],
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
          <input name="showCloseButton" type="hidden" value="true" />
        </ElementPanel>
        {canManageElements && !closePresent && (
          <>
            <input name="showCloseButton" type="hidden" value="false" />
            <input
              name="closeButtonColor"
              type="hidden"
              value={values.closeButtonColor}
            />
            <input
              name="closeButtonSize"
              type="hidden"
              value={String(values.closeButtonSize)}
            />
            <input
              name="dismissBehavior"
              type="hidden"
              value={values.dismissBehavior}
            />
          </>
        )}

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

        <DesignPanel title="Position">
          {/* Show-on-mobile was removed: campaigns always render on mobile. */}
          <input name="mobileEnabled" type="hidden" value="true" />
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
            {showStickyToggle && (
              <ToggleField
                checked={values.positionSticky}
                label={stickyLabel}
                name="positionStickyToggle"
                onChange={(checked) => updateValue("positionSticky", checked)}
              />
            )}
            <ToggleField
              checked={values.fullWidth}
              label="Full width"
              name="fullWidth"
              onChange={updateFullWidth}
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
                &quot;auto&quot;. The defaults (top, left and right at 0, bottom
                auto) keep the banner full-width across the top of the page.
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
        </DesignPanel>

        <DesignPanel title="Motion">
          <div className="counterpulse-form-grid counterpulse-form-grid--wide">
            <DesignField
              label="Entrance effect"
              error={errors.entranceAnimation}
            >
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
              label="Entrance/Close duration ms"
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
            <NumberField
              error={errors.timerTickDurationMs}
              label="Timer change duration ms"
              max={1500}
              min={0}
              name="timerTickDurationMs"
              value={values.timerTickDurationMs}
              onChange={(value) => updateNumber("timerTickDurationMs", value)}
            />
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
    </DesignPanelFilterContext.Provider>
  );
}
