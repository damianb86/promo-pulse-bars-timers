import type { EditableCampaignStatusValue } from "../types/campaign-options";

type CampaignControlStatusBadgeProps = {
  label: string;
  status: EditableCampaignStatusValue;
};

export type CampaignPublicationState =
  | "live"
  | "not-published"
  | "published-inactive"
  | "saved-unpublished"
  | "unsaved";

type CampaignPublicationStatusBadgeProps = {
  label: string;
  state: CampaignPublicationState;
};

export function CampaignControlStatusBadge({
  label,
  status,
}: CampaignControlStatusBadgeProps) {
  return (
    <span
      className={[
        "counterpulse-control-status-badge",
        `counterpulse-control-status-badge--${status.toLowerCase()}`,
      ].join(" ")}
    >
      {label.toUpperCase()}
    </span>
  );
}

export function CampaignPublicationStatusBadge({
  label,
  state,
}: CampaignPublicationStatusBadgeProps) {
  return (
    <span
      className={[
        "counterpulse-publication-status-badge",
        `counterpulse-publication-status-badge--${state}`,
      ].join(" ")}
    >
      {label.toUpperCase()}
    </span>
  );
}
