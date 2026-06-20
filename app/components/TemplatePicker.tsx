import {
  campaignDesignTemplates,
  type CampaignDesignValues,
} from "../types/campaign-design";

type TemplatePickerProps = {
  value: string;
  onChange: (values: CampaignDesignValues) => void;
};

export function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  return (
    <div className="counterpulse-template-picker">
      {campaignDesignTemplates.map((template) => (
        <button
          className={
            value === template.templateKey
              ? "counterpulse-template is-active"
              : "counterpulse-template"
          }
          key={template.templateKey}
          type="button"
          onClick={() => onChange(template)}
        >
          <span
            className="counterpulse-template__swatch"
            style={{
              background:
                template.backgroundType === "GRADIENT"
                  ? `linear-gradient(${template.gradientAngle}deg, ${template.gradientStartColor}, ${template.gradientEndColor})`
                  : template.backgroundColor,
              color: template.titleColor,
              borderColor: template.accentColor,
            }}
          >
            <span style={{ background: template.timerColor }} />
          </span>
          <span>{template.label}</span>
        </button>
      ))}
    </div>
  );
}
