import {
  defaultShopSettingsValues,
  type PublicShopSettings,
} from "./shopSettings.server";
import type { StorefrontCampaignResponseItem } from "../utils/storefront-campaigns";

export type StorefrontPayloadBody = {
  campaigns?: StorefrontCampaignResponseItem[];
  // Index of campaign IDs by placement; full campaign data lives in `campaigns`.
  placements?: Record<string, string[]>;
  settings?: Partial<PublicShopSettings>;
  badges?: true;
};

export function buildStorefrontPayload(
  campaigns: StorefrontCampaignResponseItem[],
  settings: PublicShopSettings | null,
  options: { hasBadgeCampaigns?: boolean } = {},
): StorefrontPayloadBody {
  // Drop null/undefined/empty-string fields so the payload only carries
  // meaningful data; the storefront applies the same defaults the backend
  // omits (it already reads every field through `|| fallback`, `safeColor`,
  // `clamp`, and `!== false` guards). false/0/arrays are preserved because the
  // theme distinguishes them from "absent".
  const compactCampaigns = campaigns.map((campaign) =>
    compactStorefrontValue(campaign),
  );
  const placements = compactCampaigns.reduce<Record<string, string[]>>(
    (groups, campaign) => {
      // A campaign is emitted once but can target several placements; index its
      // id under every placement it renders in.
      const descriptors = Array.isArray(campaign.placements)
        ? campaign.placements
        : [];

      for (const descriptor of descriptors) {
        const placement = (descriptor as { placement?: string }).placement;

        if (!placement) continue;

        groups[placement] ??= [];
        if (!groups[placement].includes(campaign.id)) {
          groups[placement].push(campaign.id);
        }
      }

      return groups;
    },
    {},
  );
  const settingsPayload = compactSettingsPayload(settings);

  return {
    ...(compactCampaigns.length > 0 ? { campaigns: compactCampaigns } : {}),
    // `placements` only indexes campaigns by placement; it carries IDs (not the
    // full objects, which already live in `campaigns`) to keep the payload small.
    ...(Object.keys(placements).length > 0 ? { placements } : {}),
    ...(settingsPayload ? { settings: settingsPayload } : {}),
    ...(options.hasBadgeCampaigns ? { badges: true as const } : {}),
  };
}

function compactSettingsPayload(settings: PublicShopSettings | null) {
  if (!settings) return null;

  const output = Object.entries(settings).reduce<Record<string, unknown>>(
    (values, [key, value]) => {
      if (isEmptyStorefrontValue(value)) return values;
      if (isDefaultSettingValue(key, value)) return values;

      values[key] = value;
      return values;
    },
    {},
  );

  return Object.keys(output).length > 0 ? output : null;
}

function isDefaultSettingValue(key: string, value: unknown) {
  const defaultValue =
    defaultShopSettingsValues[key as keyof typeof defaultShopSettingsValues];

  if (Array.isArray(value) && Array.isArray(defaultValue)) {
    return arraysEqual(value, defaultValue);
  }

  if (isPlainObject(value) && isPlainObject(defaultValue)) {
    return JSON.stringify(value) === JSON.stringify(defaultValue);
  }

  return value === defaultValue;
}

function arraysEqual(first: unknown[], second: unknown[]) {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

function compactStorefrontValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => compactStorefrontValue(item)) as unknown as T;
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      if (entry === null || entry === undefined || entry === "") continue;
      const compactedEntry = compactStorefrontValue(entry);

      if (isEmptyStorefrontValue(compactedEntry)) continue;

      result[key] = compactedEntry;
    }

    return result as T;
  }

  return value;
}

function isEmptyStorefrontValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (isPlainObject(value) && Object.keys(value).length === 0)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
