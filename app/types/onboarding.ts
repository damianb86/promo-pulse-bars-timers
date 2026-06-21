export type OnboardingChecklistField =
  | "firstCampaignCreated"
  | "appEmbedEnabled"
  | "productBlockAdded"
  | "cartBlockAdded"
  | "firstImpressionReceived";

export type OnboardingChecklistStatus = Record<
  OnboardingChecklistField,
  boolean
>;
