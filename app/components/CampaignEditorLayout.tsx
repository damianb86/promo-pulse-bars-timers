import { type ReactNode, useState } from "react";

export type CampaignEditorSection = {
  key: string;
  label: string;
  description: string;
  content: ReactNode;
};

type CampaignEditorLayoutProps = {
  sections: CampaignEditorSection[];
};

export function CampaignEditorLayout({ sections }: CampaignEditorLayoutProps) {
  const [activeSectionKey, setActiveSectionKey] = useState(
    () => sections[0]?.key ?? "",
  );
  const activeSection =
    sections.find((section) => section.key === activeSectionKey) ?? sections[0];

  if (!activeSection) return null;

  return (
    <div className="counterpulse-editor-workspace">
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
          {section.content}
        </section>
      ))}
    </div>
  );
}
