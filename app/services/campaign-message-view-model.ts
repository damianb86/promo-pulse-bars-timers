import type { StorefrontCampaignResponseItem } from "../utils/storefront-campaigns";

// Shared plumbing for the checkout and post-purchase campaign view models.
// Domain rules (message kinds, priorities) stay in each surface's module.

export const campaignSurfaceModes = [
  "AUTO_ELIGIBLE",
  "SPECIFIC_CAMPAIGN",
] as const;

export type CampaignSurfaceMode = (typeof campaignSurfaceModes)[number];

export type CampaignSurfaceTimer = {
  endsAt: string;
  remainingSeconds: number;
};

export function normalizeCampaignSurfaceMode(
  value: string | null | undefined,
): CampaignSurfaceMode {
  return value === "SPECIFIC_CAMPAIGN" ? "SPECIFIC_CAMPAIGN" : "AUTO_ELIGIBLE";
}

export function buildTimer(
  endsAt: string | null,
  now: Date,
  showTimer: boolean | undefined,
): CampaignSurfaceTimer | null {
  const endDate = getFutureDate(endsAt, now);
  if (!showTimer || !endDate) return null;

  return {
    endsAt: endDate.toISOString(),
    remainingSeconds: Math.max(
      0,
      Math.floor((endDate.getTime() - now.getTime()) / 1000),
    ),
  };
}

export function getFutureDate(value: string | null, now: Date) {
  if (!value) return null;

  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date <= now) return null;

  return date;
}

export function readDiscountCode(campaign: StorefrontCampaignResponseItem) {
  return readText(campaign.discount?.discountCode);
}

export function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readTextWithoutPlaceholders(value: unknown) {
  const normalized = readText(value);

  return /\{\{\s*[^}]+\s*\}\}/.test(normalized) ? "" : normalized;
}

export function formatCutoffTime(hour: unknown, minute: unknown, locale: string) {
  const parsedHour = Number(hour);
  const parsedMinute = Number(minute);

  if (
    !Number.isInteger(parsedHour) ||
    !Number.isInteger(parsedMinute) ||
    parsedHour < 0 ||
    parsedHour > 23 ||
    parsedMinute < 0 ||
    parsedMinute > 59
  ) {
    return "";
  }

  try {
    const date = new Date(Date.UTC(2026, 0, 1, parsedHour, parsedMinute, 0));

    return new Intl.DateTimeFormat(locale || "en", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return `${String(parsedHour).padStart(2, "0")}:${String(
      parsedMinute,
    ).padStart(2, "0")}`;
  }
}

// Builds each campaign's view model, then picks the highest-priority one
// (lower priority value wins; original order breaks ties).
export function selectTopViewModel<ViewModel>(
  campaigns: StorefrontCampaignResponseItem[],
  build: (campaign: StorefrontCampaignResponseItem) => ViewModel | null,
  priorityOf: (viewModel: ViewModel) => number,
): ViewModel | null {
  const ranked = campaigns
    .map((campaign, index) => ({ index, viewModel: build(campaign) }))
    .filter(
      (item): item is { index: number; viewModel: ViewModel } =>
        item.viewModel !== null,
    )
    .sort((left, right) => {
      const priority =
        priorityOf(left.viewModel) - priorityOf(right.viewModel);

      return priority || left.index - right.index;
    });

  return ranked[0]?.viewModel ?? null;
}
