import type { CampaignFormValues } from "../types/campaign-form";
import {
  campaignGoalOptions,
  formatCampaignOption,
  placementTypeOptions,
  type PlacementTypeValue,
} from "../types/campaign-options";

// Pure label formatters shared by the campaign editor's client component and
// its server-side loader/action helpers.

export function formatUnifiedCampaignTypeLabel(values: CampaignFormValues) {
  if (values.type === "PRODUCT_TIMER") return "Product timer";
  if (values.goal === "ANNOUNCEMENT") return "Announcement";

  return (
    campaignGoalOptions.find((option) => option.value === values.goal)?.label ??
    formatCampaignOption(values.type)
  );
}

export function formatPlacementSelectionLabel(placements: PlacementTypeValue[]) {
  const labels = placements.map(
    (placement) =>
      placementTypeOptions.find((option) => option.value === placement)
        ?.label ?? formatCampaignOption(placement),
  );

  return labels.length > 0 ? labels.join(" + ") : "No placement";
}
