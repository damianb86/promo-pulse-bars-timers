import { validateActivationCandidate } from "./campaign-rules";
import {
  campaignGoalOptions,
  campaignEditableStatusOptions,
  campaignStatusOptions,
  campaignTypeOptions,
  getDefaultPlacementForCampaignType,
  placementTypeOptions,
  type CampaignGoalValue,
  type CampaignTypeValue,
  type EditableCampaignStatusValue,
  type PlacementTypeValue,
} from "../types/campaign-options";
import {
  defaultCampaignFormValues,
  type CampaignFormErrors,
  type CampaignFormValues,
} from "../types/campaign-form";

export type ParsedCampaignForm = {
  values: CampaignFormValues;
  errors: CampaignFormErrors;
  startsAt: Date | null;
  endsAt: Date | null;
};

const campaignGoals = new Set(
  campaignGoalOptions.map((option) => option.value),
);
const campaignTypes = new Set(
  campaignTypeOptions.map((option) => option.value),
);
const campaignCreateStatuses = new Set(
  campaignStatusOptions.map((option) => option.value),
);
const campaignEditableStatuses = new Set(
  campaignEditableStatusOptions.map((option) => option.value),
);
const placementTypes = new Set(
  placementTypeOptions.map((option) => option.value),
);

export function parseCampaignFormData(
  formData: FormData,
  options: { allowInactiveStatuses?: boolean } = {},
): ParsedCampaignForm {
  const type = readOption(
    formData,
    "type",
    campaignTypes,
    defaultCampaignFormValues.type,
  ) as CampaignTypeValue;

  const values: CampaignFormValues = {
    goal: readOption(
      formData,
      "goal",
      campaignGoals,
      defaultCampaignFormValues.goal,
    ) as CampaignGoalValue,
    type,
    name: readString(formData, "name"),
    startsAt: readString(formData, "startsAt"),
    endsAt: readString(formData, "endsAt"),
    timezone: readString(formData, "timezone") || "UTC",
    status: readOption(
      formData,
      "status",
      options.allowInactiveStatuses
        ? campaignEditableStatuses
        : campaignCreateStatuses,
      defaultCampaignFormValues.status,
    ) as EditableCampaignStatusValue,
    placementType: readOption(
      formData,
      "placementType",
      placementTypes,
      getDefaultPlacementForCampaignType(type),
    ) as PlacementTypeValue,
    headline: readString(formData, "headline"),
    subheadline: readString(formData, "subheadline"),
    ctaText: readString(formData, "ctaText"),
    ctaUrl: readString(formData, "ctaUrl"),
  };

  const errors: CampaignFormErrors = {};
  const startsAt = parseOptionalDate(values.startsAt, "startsAt", errors);
  const endsAt = parseOptionalDate(values.endsAt, "endsAt", errors);

  if (values.name.trim().length === 0) {
    errors.name = "Campaign name is required.";
  }

  if (values.timezone.trim().length === 0) {
    errors.timezone = "Timezone is required.";
  }

  if (startsAt && endsAt && startsAt > endsAt) {
    errors.endsAt = "End date must be after start date.";
  }

  if (values.ctaUrl && !isValidCtaUrl(values.ctaUrl)) {
    errors.ctaUrl = "CTA URL must be a valid absolute URL or storefront path.";
  }

  if (values.status === "ACTIVE") {
    for (const error of validateActivationCandidate({
      placements: [{ enabled: true }],
      translations: [{ headline: values.headline }],
    })) {
      if (error.includes("headline")) {
        errors.headline = error;
      } else {
        errors.placementType = error;
      }
    }
  }

  return {
    values,
    errors,
    startsAt,
    endsAt,
  };
}

export function hasCampaignFormErrors(errors: CampaignFormErrors) {
  return Object.keys(errors).length > 0;
}

function readString(formData: FormData, key: keyof CampaignFormValues) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOption(
  formData: FormData,
  key: keyof CampaignFormValues,
  allowedValues: Set<string>,
  fallback: string,
) {
  const value = readString(formData, key);
  return allowedValues.has(value) ? value : fallback;
}

function parseOptionalDate(
  value: string,
  key: keyof CampaignFormValues,
  errors: CampaignFormErrors,
) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    errors[key] = "Enter a valid date and time.";
    return null;
  }

  return date;
}

function isValidCtaUrl(value: string) {
  if (value.startsWith("/")) return true;

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}
