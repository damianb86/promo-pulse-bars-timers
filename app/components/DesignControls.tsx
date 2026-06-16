import type { ReactNode } from "react";

import {
  designAlignmentOptions,
  designIconOptions,
  type CampaignDesignErrors,
  type CampaignDesignValues,
} from "../types/campaign-design";
import { TemplatePicker } from "./TemplatePicker";

type DesignControlsProps = {
  values: CampaignDesignValues;
  errors?: CampaignDesignErrors;
  isProPlan: boolean;
  onChange: (values: CampaignDesignValues) => void;
};

const colorFields: Array<{
  key: keyof Pick<
    CampaignDesignValues,
    | "backgroundColor"
    | "textColor"
    | "accentColor"
    | "buttonColor"
    | "buttonTextColor"
  >;
  label: string;
}> = [
  { key: "backgroundColor", label: "Background" },
  { key: "textColor", label: "Text" },
  { key: "accentColor", label: "Accent" },
  { key: "buttonColor", label: "Button" },
  { key: "buttonTextColor", label: "Button text" },
];

export function DesignControls({
  values,
  errors = {},
  isProPlan,
  onChange,
}: DesignControlsProps) {
  return (
    <div className="counterpulse-design-controls">
      <TemplatePicker
        value={values.templateKey}
        onChange={(template) =>
          onChange({
            ...values,
            ...template,
            customCss: values.customCss,
          })
        }
      />

      <input name="templateKey" type="hidden" value={values.templateKey} />

      <div className="counterpulse-form-grid">
        {colorFields.map((field) => (
          <DesignField
            error={errors[field.key]}
            key={field.key}
            label={field.label}
          >
            <div className="counterpulse-color-input">
              <input
                aria-label={`${field.label} color picker`}
                type="color"
                value={String(values[field.key])}
                onChange={(event) =>
                  onChange({
                    ...values,
                    [field.key]: event.target.value.toUpperCase(),
                  })
                }
              />
              <input
                name={field.key}
                value={String(values[field.key])}
                onChange={(event) =>
                  onChange({
                    ...values,
                    [field.key]: event.target.value.toUpperCase(),
                  })
                }
              />
            </div>
          </DesignField>
        ))}

        <DesignField label="Font size" error={errors.fontSize}>
          <input
            max={24}
            min={10}
            name="fontSize"
            type="number"
            value={values.fontSize}
            onChange={(event) =>
              onChange({ ...values, fontSize: Number(event.target.value) })
            }
          />
        </DesignField>

        <DesignField label="Border radius" error={errors.borderRadius}>
          <input
            max={24}
            min={0}
            name="borderRadius"
            type="number"
            value={values.borderRadius}
            onChange={(event) =>
              onChange({ ...values, borderRadius: Number(event.target.value) })
            }
          />
        </DesignField>

        <DesignField label="Alignment" error={errors.alignment}>
          <select
            name="alignment"
            value={values.alignment}
            onChange={(event) =>
              onChange({
                ...values,
                alignment: event.target
                  .value as CampaignDesignValues["alignment"],
              })
            }
          >
            {designAlignmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </DesignField>

        <DesignField label="Icon" error={errors.icon}>
          <select
            name="icon"
            value={values.icon}
            onChange={(event) =>
              onChange({
                ...values,
                icon: event.target.value as CampaignDesignValues["icon"],
              })
            }
          >
            {designIconOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </DesignField>
      </div>

      <div className="counterpulse-toggle-grid">
        <ToggleField
          checked={values.positionSticky}
          label="Sticky position"
          name="positionSticky"
          onChange={(checked) =>
            onChange({ ...values, positionSticky: checked })
          }
        />
        <ToggleField
          checked={values.mobileEnabled}
          label="Mobile enabled"
          name="mobileEnabled"
          onChange={(checked) =>
            onChange({ ...values, mobileEnabled: checked })
          }
        />
        <ToggleField
          checked={values.showCloseButton}
          label="Show close button"
          name="showCloseButton"
          onChange={(checked) =>
            onChange({ ...values, showCloseButton: checked })
          }
        />
        <ToggleField
          checked={values.showIcon}
          label="Show icon"
          name="showIcon"
          onChange={(checked) => onChange({ ...values, showIcon: checked })}
        />
      </div>

      <DesignField
        label={isProPlan ? "Custom CSS" : "Custom CSS (Pro plan)"}
        error={errors.customCss}
      >
        <textarea
          disabled={!isProPlan}
          name="customCss"
          rows={4}
          value={values.customCss}
          onChange={(event) =>
            onChange({ ...values, customCss: event.target.value })
          }
        />
      </DesignField>
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
