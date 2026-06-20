import { type ReactNode, useState } from "react";

export type CampaignEditorSection = {
  key: string;
  label: string;
  description: string;
  content: ReactNode;
};

type CampaignEditorLayoutProps = {
  actionBar?: {
    campaignSectionKey?: string;
    formId: string;
    goalLabel: string;
    placementLabel: string;
    statusLabel: string;
    submitLabel: string;
    submittingLabel?: string;
    isSubmitting?: boolean;
  };
  sections: CampaignEditorSection[];
};

export function CampaignEditorLayout({
  actionBar,
  sections,
}: CampaignEditorLayoutProps) {
  const [activeSectionKey, setActiveSectionKey] = useState(
    () => sections[0]?.key ?? "",
  );
  const activeSection =
    sections.find((section) => section.key === activeSectionKey) ?? sections[0];

  if (!activeSection) return null;

  return (
    <div className="counterpulse-editor-workspace">
      {actionBar && (
        <div className="counterpulse-editor-actionbar">
          <div>
            <p className="counterpulse-kicker">Campaign controls</p>
            <div className="counterpulse-create-status">
              <span>{actionBar.statusLabel}</span>
              <span>{actionBar.goalLabel}</span>
              <span>{actionBar.placementLabel}</span>
            </div>
          </div>
          <div className="counterpulse-create-actions">
            <button
              className="counterpulse-button-secondary"
              type="button"
              onClick={() => {
                setActiveSectionKey(actionBar.campaignSectionKey ?? "campaign");
                window.dispatchEvent(
                  new CustomEvent("counterpulse:campaign-review"),
                );
              }}
            >
              Review
            </button>
            <button
              className="counterpulse-button"
              data-testid="campaign-save-button"
              form={actionBar.formId}
              type="submit"
            >
              {actionBar.isSubmitting
                ? (actionBar.submittingLabel ?? "Saving...")
                : actionBar.submitLabel}
            </button>
          </div>
        </div>
      )}

      <div
        className="counterpulse-editor-tabs"
        aria-label="Campaign editor sections"
        role="tablist"
      >
        {sections.map((section) => (
          <button
            aria-controls={`campaign-editor-panel-${section.key}`}
            aria-selected={activeSection.key === section.key}
            className={activeSection.key === section.key ? "is-active" : ""}
            id={`campaign-editor-tab-${section.key}`}
            key={section.key}
            role="tab"
            type="button"
            aria-label={section.label}
            onClick={() => setActiveSectionKey(section.key)}
          >
            <span>{section.label}</span>
            <small>{section.description}</small>
          </button>
        ))}
      </div>

      {sections.map((section) => (
        <section
          aria-labelledby={`campaign-editor-tab-${section.key}`}
          className="counterpulse-editor-panel"
          hidden={activeSection.key !== section.key}
          id={`campaign-editor-panel-${section.key}`}
          key={section.key}
          role="tabpanel"
        >
          <div className="counterpulse-editor-panel__intro">
            <p className="counterpulse-kicker">{section.label}</p>
            <p>{section.description}</p>
          </div>
          {section.content}
        </section>
      ))}
    </div>
  );
}
