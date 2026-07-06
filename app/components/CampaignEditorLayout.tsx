import { type ReactNode, useEffect, useState } from "react";
import {
  CampaignControlStatusBadge,
  CampaignPublicationStatusBadge,
  type CampaignPublicationState,
} from "./CampaignControlStatusBadge";
import { CampaignTypeIcon } from "./campaign-form/fields";
import type {
  CampaignTypeValue,
  EditableCampaignStatusValue,
} from "../types/campaign-options";

export type CampaignEditorSection = {
  key: string;
  label: string;
  description: string;
  content: ReactNode;
};

type CampaignEditorLayoutProps = {
  actionBar?: {
    campaignSectionKey?: string;
    campaignTypeLabel: string;
    campaignTypeValue?: CampaignTypeValue;
    formId: string;
    isPublishing?: boolean;
    placementLabel: string;
    publicationState: CampaignPublicationState;
    publicationStatusLabel: string;
    publishDisabled?: boolean;
    publishLabel?: string;
    statusLabel: string;
    statusValue: EditableCampaignStatusValue;
    experimentRunning?: boolean;
    experimentSectionKey?: string;
    isSubmitting?: boolean;
    onPublish?: () => void;
  };
  attentionSectionKey?: string;
  sections: CampaignEditorSection[];
};

export function CampaignEditorLayout({
  actionBar,
  attentionSectionKey,
  sections,
}: CampaignEditorLayoutProps) {
  const [activeSectionKey, setActiveSectionKey] = useState(
    () => sections[0]?.key ?? "",
  );
  const activeSection =
    sections.find((section) => section.key === activeSectionKey) ?? sections[0];
  const hasAttentionSection = sections.some(
    (section) => section.key === attentionSectionKey,
  );

  useEffect(() => {
    if (!attentionSectionKey) return;
    if (!hasAttentionSection) return;

    const focusSection = window.setTimeout(() => {
      setActiveSectionKey(attentionSectionKey);
    }, 0);

    return () => window.clearTimeout(focusSection);
  }, [attentionSectionKey, hasAttentionSection]);

  if (!activeSection) return null;

  return (
    <div className="counterpulse-editor-workspace">
      {actionBar && (
        <div className="counterpulse-editor-actionbar">
          <div>
            <p className="counterpulse-kicker">Campaign controls</p>
            <div className="counterpulse-create-status">
              <span className="counterpulse-control-badge counterpulse-control-badge--type">
                {actionBar.campaignTypeValue && (
                  <CampaignTypeIcon type={actionBar.campaignTypeValue} />
                )}
                <span>{actionBar.campaignTypeLabel}</span>
              </span>
              <span className="counterpulse-control-badge counterpulse-control-badge--placement">
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="16"
                  viewBox="0 0 24 24"
                  width="16"
                >
                  <path
                    d="M12 21s-6.5-5.6-6.5-10a6.5 6.5 0 1 1 13 0c0 4.4-6.5 10-6.5 10Z"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                  <circle
                    cx="12"
                    cy="11"
                    r="2.2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                <span>{actionBar.placementLabel}</span>
              </span>
            </div>
          </div>
          <div className="counterpulse-create-actions">
            <CampaignPublicationStatusBadge
              label={actionBar.publicationStatusLabel}
              state={actionBar.publicationState}
            />
            {/* When the campaign is LIVE the control status is always ACTIVE,
                so the separate "Active" badge is redundant — show it only when
                not live (Draft, Paused, published-inactive, etc.). */}
            {actionBar.publicationState !== "live" && (
              <CampaignControlStatusBadge
                label={actionBar.statusLabel}
                status={actionBar.statusValue}
              />
            )}
            {actionBar.experimentRunning && (
              <button
                className="counterpulse-experiment-running-badge"
                type="button"
                title="An A/B experiment is running on this campaign"
                onClick={() =>
                  setActiveSectionKey(
                    actionBar.experimentSectionKey ?? "experiments",
                  )
                }
              >
                <span
                  className="counterpulse-experiment-running-badge__dot"
                  aria-hidden="true"
                />
                EXPERIMENT RUNNING
              </button>
            )}
            <button
              className="counterpulse-button-secondary"
              type="button"
              onClick={() => {
                setActiveSectionKey(actionBar.campaignSectionKey ?? "campaign");
                window.setTimeout(() => {
                  window.dispatchEvent(
                    new CustomEvent("promo-pulse:campaign-review"),
                  );
                }, 0);
              }}
            >
              Review
            </button>
            <button
              className="counterpulse-button"
              data-testid="campaign-publish-button"
              disabled={actionBar.isSubmitting || actionBar.publishDisabled}
              type="button"
              onClick={actionBar.onPublish}
            >
              {actionBar.isPublishing
                ? "Publishing..."
                : (actionBar.publishLabel ?? "Publish")}
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
            <EditorTabIcon sectionKey={section.key} />
            <span>{section.label}</span>
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

export function EditorTabIcon({ sectionKey }: { sectionKey: string }) {
  const icon = getEditorTabIconPath(sectionKey);

  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      {icon}
    </svg>
  );
}

function getEditorTabIconPath(sectionKey: string) {
  if (sectionKey === "campaign") {
    return (
      <>
        <path
          d="M5 7.5h9.5l4.5 4.5-4.5 4.5H5z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle cx="8.5" cy="12" r="1.3" fill="currentColor" />
      </>
    );
  }

  if (sectionKey === "offers") {
    return (
      <>
        <path
          d="M4.5 12.2 12.2 4H20v7.8L11.8 20z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle cx="16.6" cy="7.4" r="1.2" fill="currentColor" />
      </>
    );
  }

  if (sectionKey === "experiments") {
    return (
      <path
        d="M9 3.8v5.4l-4.2 7.3A3 3 0 0 0 7.4 21h9.2a3 3 0 0 0 2.6-4.5L15 9.2V3.8M8 3.8h8M8.2 15h7.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    );
  }

  if (sectionKey === "targeting") {
    return (
      <>
        <circle
          cx="12"
          cy="12"
          r="7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      </>
    );
  }

  if (sectionKey === "markets") {
    return (
      <>
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M4.5 12h15M12 4c2.1 2.2 3.2 4.8 3.2 8s-1.1 5.8-3.2 8c-2.1-2.2-3.2-4.8-3.2-8S9.9 6.2 12 4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </>
    );
  }

  if (sectionKey === "merchandising") {
    return (
      <path
        d="M6 8.5 12 5l6 3.5v7L12 19l-6-3.5zM12 12l6-3.5M12 12v7M12 12 6 8.5"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    );
  }

  if (sectionKey === "design") {
    return (
      <path
        d="M12 4.5a7.5 7.5 0 0 0 0 15h1.2a1.8 1.8 0 0 0 1.1-3.2l-.4-.3a1.4 1.4 0 0 1 .9-2.5H16a3.5 3.5 0 0 0 0-7 7.5 7.5 0 0 0-4-2ZM8.3 11.4h.1M10.5 8.4h.1M14 8.4h.1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    );
  }

  return (
    <path
      d="M6 4.5h12v15H6zM8.5 8h7M8.5 12h7M8.5 16h4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  );
}
