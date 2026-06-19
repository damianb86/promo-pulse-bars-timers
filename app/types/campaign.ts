import type { Prisma } from "@prisma/client";

export const campaignDetailsInclude = {
  placements: true,
  targeting: true,
  design: true,
  timerSettings: true,
  freeShippingSettings: true,
  deliveryCutoffSettings: true,
  lowStockSettings: true,
  badgeSettings: true,
  discountSync: true,
  marketCampaignRules: true,
  translations: true,
  experiments: {
    include: {
      variants: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }],
  },
} satisfies Prisma.CampaignInclude;

export const campaignDuplicateInclude = {
  placements: true,
  targeting: true,
  design: true,
  timerSettings: true,
  freeShippingSettings: true,
  deliveryCutoffSettings: true,
  lowStockSettings: true,
  badgeSettings: true,
  discountSync: true,
  marketCampaignRules: true,
  translations: true,
} satisfies Prisma.CampaignInclude;

export type CampaignWithDetails = Prisma.CampaignGetPayload<{
  include: typeof campaignDetailsInclude;
}>;

export type CampaignDuplicateSource = Prisma.CampaignGetPayload<{
  include: typeof campaignDuplicateInclude;
}>;

export type CreateCampaignInput = Prisma.CampaignCreateInput;
export type UpdateCampaignInput = Prisma.CampaignUpdateInput;

export type TargetDevice = "desktop" | "mobile" | "tablet";

export type CampaignTargetingRules = {
  countries: string[];
  markets: string[];
  locales: string[];
  productIds: string[];
  collectionIds: string[];
  productTags: string[];
  customerTags: string[];
  urlContains: string[];
  utmSources: string[];
  devices: TargetDevice[];
  excludeProductIds: string[];
  excludeCollectionIds: string[];
};

export type DeliveryCountryRule = {
  cutoffHour?: number;
  cutoffMinute?: number;
  processingDays?: number;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
};

export type DeliveryCountryRules = Record<string, DeliveryCountryRule>;

export function createEmptyTargetingRules(): CampaignTargetingRules {
  return {
    countries: [],
    markets: [],
    locales: [],
    productIds: [],
    collectionIds: [],
    productTags: [],
    customerTags: [],
    urlContains: [],
    utmSources: [],
    devices: [],
    excludeProductIds: [],
    excludeCollectionIds: [],
  };
}
