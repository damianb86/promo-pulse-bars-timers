import { Prisma } from "@prisma/client";

import prisma from "../../db.server";
import { isE2ETestMode } from "../e2e-test.server";
import type { ShopifyGraphqlClient } from "../shopifyDiscounts.server";
export {
  applyMarketCampaignRule,
  findBestMarketRule,
  getMarketContext,
  type MarketContext,
} from "./marketOverrides";

export type ShopifyMarket = {
  id: string;
  name: string;
  handle: string;
  enabled: boolean;
  primary: boolean;
  countryCodes: string[];
  locale: string;
  currencyCode: string;
};

export type MarketRuleInput = {
  enabled: boolean;
  marketId: string | null;
  countryCode: string | null;
  locale: string | null;
  currencyCode: string | null;
  thresholdAmount: string | null;
  deliverySettings: Prisma.InputJsonObject;
};

type MarketNode = {
  id?: string | null;
  name?: string | null;
  handle?: string | null;
  enabled?: boolean | null;
  primary?: boolean | null;
  regions?: {
    nodes?: Array<{
      code?: string | null;
      name?: string | null;
    } | null> | null;
  } | null;
  webPresence?: {
    defaultLocale?: {
      locale?: string | null;
    } | null;
  } | null;
  currencySettings?: {
    baseCurrency?: {
      currencyCode?: string | null;
    } | null;
  } | null;
};

export async function fetchShopMarkets(
  admin?: ShopifyGraphqlClient | null,
): Promise<ShopifyMarket[]> {
  if (isE2ETestMode() || !admin) {
    return demoMarkets();
  }

  const response = await admin.graphql(
    `#graphql
      query PromoPulseMarkets($first: Int!) {
        markets(first: $first) {
          nodes {
            id
            name
            handle
            enabled
            primary
            regions(first: 50) {
              nodes {
                ... on MarketRegionCountry {
                  code
                  name
                }
              }
            }
            webPresence {
              defaultLocale {
                locale
              }
            }
            currencySettings {
              baseCurrency {
                currencyCode
              }
            }
          }
        }
      }`,
    { variables: { first: 50 } },
  );
  const body = (await response.json()) as {
    data?: { markets?: { nodes?: MarketNode[] } };
    errors?: Array<{ message?: string }>;
  };

  if (!response.ok || body.errors?.length) {
    throw new Error(
      body.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join(" ") || "Shopify markets could not be loaded.",
    );
  }

  return (body.data?.markets?.nodes ?? []).map(normalizeMarket);
}

export function normalizeMarket(value: unknown): ShopifyMarket {
  const market = readObject(value);
  const regions = readObject(market.regions);
  const countryCodes = Array.isArray(regions.nodes)
    ? regions.nodes
        .map((region) => readObject(region).code)
        .filter((code): code is string => typeof code === "string")
        .map((code) => code.toUpperCase())
    : [];
  const webPresence = readObject(market.webPresence);
  const defaultLocale = readObject(webPresence.defaultLocale);
  const currencySettings = readObject(market.currencySettings);
  const baseCurrency = readObject(currencySettings.baseCurrency);

  return {
    id: readString(market.id),
    name: readString(market.name) || readString(market.handle) || "Market",
    handle: readString(market.handle).toUpperCase(),
    enabled: market.enabled !== false,
    primary: market.primary === true,
    countryCodes,
    locale: normalizeLocale(readString(defaultLocale.locale)),
    currencyCode: normalizeCurrency(readString(baseCurrency.currencyCode)),
  };
}

export function listMarketRulesForCampaign(shopId: string, campaignId: string) {
  return prisma.marketCampaignRule.findMany({
    where: { shopId, campaignId },
    orderBy: [{ marketId: "asc" }, { countryCode: "asc" }, { locale: "asc" }],
  });
}

export async function saveMarketRule({
  campaignId,
  input,
  ruleId,
  shopId,
}: {
  campaignId: string;
  input: MarketRuleInput;
  ruleId?: string;
  shopId: string;
}) {
  await assertCampaignBelongsToShop(campaignId, shopId);

  const data = {
    enabled: input.enabled,
    marketId: input.marketId,
    countryCode: input.countryCode,
    locale: input.locale,
    currencyCode: input.currencyCode,
    thresholdAmount: input.thresholdAmount
      ? new Prisma.Decimal(input.thresholdAmount)
      : null,
    deliverySettings: input.deliverySettings,
    textOverrides: Prisma.JsonNull,
  };

  return prisma.$transaction(async (tx) => {
    await tx.campaign.updateMany({
      where: { id: campaignId, shopId },
      data: { lastSavedAt: new Date() },
    });

    if (ruleId) {
      const result = await tx.marketCampaignRule.updateMany({
        where: { id: ruleId, shopId, campaignId },
        data,
      });

      if (result.count === 0) {
        throw new Error("Market rule not found.");
      }

      return result;
    }

    return tx.marketCampaignRule.create({
      data: {
        ...data,
        shopId,
        campaignId,
      },
    });
  });
}

export function deleteMarketRule({
  campaignId,
  ruleId,
  shopId,
}: {
  campaignId: string;
  ruleId: string;
  shopId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.campaign.updateMany({
      where: { id: campaignId, shopId },
      data: { lastSavedAt: new Date() },
    });

    return tx.marketCampaignRule.deleteMany({
      where: { id: ruleId, campaignId, shopId },
    });
  });
}

function demoMarkets(): ShopifyMarket[] {
  return [
    {
      id: "gid://shopify/Market/demo-us",
      name: "United States",
      handle: "US",
      enabled: true,
      primary: true,
      countryCodes: ["US"],
      locale: "en",
      currencyCode: "USD",
    },
    {
      id: "gid://shopify/Market/demo-es",
      name: "Spain",
      handle: "ES",
      enabled: true,
      primary: false,
      countryCodes: ["ES"],
      locale: "es",
      currencyCode: "EUR",
    },
  ];
}

async function assertCampaignBelongsToShop(campaignId: string, shopId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId },
    select: { id: true },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCurrency(value: string | null | undefined) {
  const currency = readString(value).toUpperCase();

  return /^[A-Z]{3}$/.test(currency) ? currency : "";
}

function normalizeLocale(value: string | null | undefined) {
  return readString(value).replace("_", "-").toLowerCase();
}
