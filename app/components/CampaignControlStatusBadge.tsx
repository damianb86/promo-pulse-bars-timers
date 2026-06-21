import type { EditableCampaignStatusValue } from "../types/campaign-options";

type CampaignControlStatusBadgeProps = {
  label: string;
  status: EditableCampaignStatusValue;
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
      {status === "ACTIVE" ? "Live" : label}
    </span>
  );
}
