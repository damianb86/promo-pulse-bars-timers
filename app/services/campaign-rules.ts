import type { CampaignStatusValue } from "../types/campaign-options";

export type ActivationCandidate = {
  placements: Array<{ enabled: boolean }>;
  translations: Array<{ headline: string | null }>;
};

export function validateActivationCandidate(candidate: ActivationCandidate) {
  const errors: string[] = [];

  if (!candidate.placements.some((placement) => placement.enabled)) {
    errors.push("An active campaign needs at least one enabled placement.");
  }

  if (
    !candidate.translations.some(
      (translation) => translation.headline?.trim().length,
    )
  ) {
    errors.push("An active campaign needs a basic headline translation.");
  }

  return errors;
}

export function assertCanActivateCampaign(candidate: ActivationCandidate) {
  const errors = validateActivationCandidate(candidate);

  if (errors.length > 0) {
    throw new CampaignRuleError(errors);
  }
}

export function getCampaignStatusAfterTransition(
  currentStatus: CampaignStatusValue,
  transition: "activate" | "pause" | "expire",
): CampaignStatusValue {
  if (transition === "activate") return "ACTIVE";
  if (transition === "pause") return "PAUSED";
  if (currentStatus === "EXPIRED") return "EXPIRED";
  return "EXPIRED";
}

export function buildDuplicateCampaignName(name: string) {
  const trimmedName = name.trim();
  const baseName = trimmedName.length > 0 ? trimmedName : "Untitled campaign";

  return `${baseName} copy`;
}

export class CampaignRuleError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join(" "));
    this.name = "CampaignRuleError";
  }
}
