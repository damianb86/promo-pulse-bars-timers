import type {
  CampaignGoalValue,
  CampaignTypeValue,
  EditableCampaignStatusValue,
  PlacementTypeValue,
} from "./campaign-options";

export type CampaignFormValues = {
  goal: CampaignGoalValue;
  type: CampaignTypeValue;
  name: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: EditableCampaignStatusValue;
  placementType: PlacementTypeValue;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
};

export type CampaignFormErrors = Partial<
  Record<keyof CampaignFormValues, string>
> & {
  form?: string;
};

export const defaultCampaignFormValues: CampaignFormValues = {
  goal: "FLASH_SALE",
  type: "COUNTDOWN_BAR",
  name: "",
  startsAt: "",
  endsAt: "",
  timezone: "UTC",
  status: "DRAFT",
  placementType: "TOP_BAR",
  headline: "",
  subheadline: "",
  ctaText: "",
  ctaUrl: "",
};
