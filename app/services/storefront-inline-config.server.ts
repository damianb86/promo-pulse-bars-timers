import { CampaignStatus, PlacementType, type Shop } from "@prisma/client";

import { getPublishedCampaignsForShop } from "../models/campaign.server";
import {
  ALL_FRONT_DEFAULT_PLACEMENTS_TOKEN,
  STOREFRONT_FRONT_PLACEMENTS,
  serializeStorefrontCampaignsForEmbedding,
  type StorefrontCampaignContext,
  type StorefrontCampaignSource,
} from "../utils/storefront-campaigns";
import { hasBehaviorTargetingRules } from "../types/behavior-targeting";
import { isE2ETestMode } from "./e2e-test.server";
import { isCampaignAllowedByPlan } from "./planLimits.server";
import {
  applySettingsToStorefrontContext,
  getShopSettingsOrDefaults,
  serializePublicShopSettings,
  type ShopSettingsValues,
} from "./shopSettings.server";
import { buildStorefrontPayload } from "./storefront-payload.server";
import type { ShopifyGraphqlClient } from "./shopifyDiscounts.server";

export const STOREFRONT_INLINE_CONFIG_NAMESPACE = "promo_pulse";
export const STOREFRONT_INLINE_CONFIG_KEY = "storefront_payload";

type StorefrontInlineConfigInput = {
  admin: ShopifyGraphqlClient;
  shop: Pick<Shop, "id" | "shopifyDomain" | "plan">;
};

type CurrentAppInstallationResponse = {
  data?: {
    currentAppInstallation?: {
      id?: string | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

type MetafieldsSetResponse = {
  data?: {
    metafieldsSet?: {
      userErrors?: Array<{ field?: string[] | null; message?: string | null }>;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

const inlineDevices = ["desktop", "mobile", "tablet"] as const;
const inlineConfigMetafieldType = "json";

export async function syncStorefrontInlineConfig(
  input: StorefrontInlineConfigInput,
) {
  if (isE2ETestMode()) return;

  try {
    await publishStorefrontInlineConfig(input);
  } catch (error) {
    console.error("Failed to sync Promo Pulse storefront inline config", error);
  }
}

export async function publishStorefrontInlineConfig({
  admin,
  shop,
}: StorefrontInlineConfigInput) {
  const ownerId = await loadCurrentAppInstallationId(admin);
  const payload = await buildStorefrontInlineConfig(shop);
  const response = await admin.graphql(
    `#graphql
      mutation PromoPulseStorefrontInlineConfigSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        metafields: [
          {
            ownerId,
            namespace: STOREFRONT_INLINE_CONFIG_NAMESPACE,
            key: STOREFRONT_INLINE_CONFIG_KEY,
            type: inlineConfigMetafieldType,
            value: JSON.stringify(payload),
          },
        ],
      },
    },
  );
  const body = (await response.json()) as MetafieldsSetResponse;
  const userErrors = body.data?.metafieldsSet?.userErrors ?? [];

  if (!response.ok || body.errors?.length || userErrors.length) {
    throw new Error(
      [
        ...((body.errors ?? [])
          .map((error) => error.message)
          .filter(Boolean) as string[]),
        ...userErrors.map(
          (error) => error.message ?? "Unknown metafield error.",
        ),
      ].join(" "),
    );
  }
}

export async function buildStorefrontInlineConfig(
  shop: Pick<Shop, "id" | "shopifyDomain" | "plan">,
) {
  const settings = await getShopSettingsOrDefaults(shop.id);
  const publicSettings = serializePublicShopSettings(settings);
  const publishedCampaigns = await getPublishedCampaignsForShop(shop.id);
  const activeCampaigns = publishedCampaigns.filter(
    (campaign) => campaign.status === CampaignStatus.ACTIVE,
  );
  const planAllowedCampaigns = activeCampaigns.filter((campaign) =>
    isCampaignAllowedByPlan(shop, campaign),
  );
  const inlineCampaigns = planAllowedCampaigns.filter(
    (campaign) => !requiresServerResolvedPayload(campaign),
  );
  const hasRuntimeOnlyCampaigns =
    inlineCampaigns.length !== planAllowedCampaigns.length;
  const locales = normalizeInlineLocales(settings);
  const payloads = Object.fromEntries(
    locales.flatMap((locale) =>
      inlineDevices.map((device) => {
        const context = buildInlineContext({
          device,
          locale,
          settings,
          shopDomain: shop.shopifyDomain,
        });
        const campaigns = serializeStorefrontCampaignsForEmbedding(
          inlineCampaigns,
          context,
        );

        return [
          `${locale}:${device}`,
          buildStorefrontPayload(campaigns, publicSettings, {
            hasBadgeCampaigns:
              hasStorefrontBadgeCampaigns(planAllowedCampaigns),
          }),
        ];
      }),
    ),
  );

  return {
    __promoPulseBundle: true,
    __promoPulseGeneratedAt: new Date().toISOString(),
    __promoPulseDefaultLocale: settings.defaultLocale,
    __promoPulseDefaultDevice: "desktop",
    __promoPulseRequiresRuntimeFetch: hasRuntimeOnlyCampaigns,
    context: {
      shop: shop.shopifyDomain,
    },
    payloads,
  };
}

async function loadCurrentAppInstallationId(admin: ShopifyGraphqlClient) {
  const response = await admin.graphql(
    `#graphql
      query PromoPulseCurrentAppInstallation {
        currentAppInstallation {
          id
        }
      }`,
  );
  const body = (await response.json()) as CurrentAppInstallationResponse;
  const id = body.data?.currentAppInstallation?.id;

  if (!response.ok || body.errors?.length || !id) {
    throw new Error(
      body.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join(" ") || "Current app installation id is unavailable.",
    );
  }

  return id;
}

function buildInlineContext({
  device,
  locale,
  settings,
  shopDomain,
}: {
  device: string;
  locale: string;
  settings: ShopSettingsValues;
  shopDomain: string;
}): StorefrontCampaignContext {
  return applySettingsToStorefrontContext(
    {
      shop: shopDomain,
      path: "/",
      locale,
      country: "",
      market: "",
      productId: "",
      collectionIds: [],
      productTags: [],
      customerTags: [],
      device,
      utmSource: "",
      cartSubtotal: null,
      currency: settings.defaultCurrency,
      placement: ALL_FRONT_DEFAULT_PLACEMENTS_TOKEN,
      placements: [...STOREFRONT_FRONT_PLACEMENTS],
      campaignId: "",
      visitorId: "",
      sessionId: "",
      doNotTrack: false,
      consentGranted: null,
      behaviorProfile: null,
    },
    settings,
  );
}

function normalizeInlineLocales(settings: ShopSettingsValues) {
  const locales = Array.from(
    new Set(
      [settings.defaultLocale, ...settings.enabledLocales].filter(Boolean),
    ),
  );

  return locales.length > 0 ? locales : ["en"];
}

function requiresServerResolvedPayload(campaign: StorefrontCampaignSource) {
  return (
    hasBehaviorTargetingRules(campaign.targeting?.behaviorRules) ||
    campaign.marketCampaignRules.length > 0 ||
    campaign.experiments.some((experiment) => {
      if (experiment.status !== "RUNNING") return false;

      const now = new Date();
      return (
        (!experiment.startsAt || experiment.startsAt <= now) &&
        (!experiment.endsAt || experiment.endsAt >= now)
      );
    })
  );
}

function hasStorefrontBadgeCampaigns(campaigns: StorefrontCampaignSource[]) {
  return campaigns.some((campaign) =>
    campaign.placements.some(
      (placement) =>
        placement.enabled &&
        (placement.placementType === PlacementType.PRODUCT_PAGE_BADGE ||
          placement.placementType === PlacementType.COLLECTION_CARD),
    ),
  );
}
