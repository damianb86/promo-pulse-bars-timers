import type {
  CampaignGoalValue,
  CampaignTypeValue,
  EditableCampaignStatusValue,
  PlacementTypeValue,
} from "./campaign-options";
import {
  createEmptyTargetingRules,
  type CampaignTargetingRules,
} from "./campaign";

export const productSelectionOptions = [
  "ALL_PRODUCTS",
  "SPECIFIC_PRODUCTS",
  "COLLECTIONS",
  "TAGS",
  "CUSTOM_POSITION",
] as const;

export const countrySelectionOptions = [
  "ALL_WORLD",
  "SPECIFIC_COUNTRIES",
] as const;

export type ProductSelectionValue = (typeof productSelectionOptions)[number];
export type CountrySelectionValue = (typeof countrySelectionOptions)[number];

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
  productSelection: ProductSelectionValue;
  productIds: string;
  excludeProductIds: string;
  collectionIds: string;
  productTags: string;
  customSelector: string;
  countrySelection: CountrySelectionValue;
  countries: string;
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
  productSelection: "ALL_PRODUCTS",
  productIds: "",
  excludeProductIds: "",
  collectionIds: "",
  productTags: "",
  customSelector: "",
  countrySelection: "ALL_WORLD",
  countries: "",
};

export function buildCampaignTargetingValues(
  values: CampaignFormValues,
): CampaignTargetingRules {
  const targeting = createEmptyTargetingRules();

  if (values.productSelection === "SPECIFIC_PRODUCTS") {
    targeting.productIds = splitCampaignList(values.productIds);
  }

  if (values.productSelection === "COLLECTIONS") {
    targeting.collectionIds = splitCampaignList(values.collectionIds);
  }

  if (values.productSelection === "TAGS") {
    targeting.productTags = splitCampaignList(values.productTags);
  }

  if (values.productSelection === "ALL_PRODUCTS") {
    targeting.excludeProductIds = splitCampaignList(values.excludeProductIds);
  }

  if (values.countrySelection === "SPECIFIC_COUNTRIES") {
    targeting.countries = splitCampaignList(values.countries).map((country) =>
      country.toUpperCase(),
    );
  }

  return targeting;
}

export function splitCampaignList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
