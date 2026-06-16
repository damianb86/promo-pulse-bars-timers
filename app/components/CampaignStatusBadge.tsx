type CampaignStatusValue = "ACTIVE" | "PAUSED" | "DRAFT" | "EXPIRED";

type CampaignStatusBadgeProps = {
  status: CampaignStatusValue;
};

const statusLabels: Record<CampaignStatusValue, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  DRAFT: "Draft",
  EXPIRED: "Expired",
};

const statusTones: Record<
  CampaignStatusValue,
  "success" | "warning" | "info" | "critical"
> = {
  ACTIVE: "success",
  PAUSED: "warning",
  DRAFT: "info",
  EXPIRED: "critical",
};

export function CampaignStatusBadge({ status }: CampaignStatusBadgeProps) {
  return <s-badge tone={statusTones[status]}>{statusLabels[status]}</s-badge>;
}
