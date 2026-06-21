import type { MarketCampaignRule } from "@prisma/client";

import type {
  StorefrontCampaignContext,
  StorefrontCampaignResponseItem,
} from "../../utils/storefront-campaigns";

export type MarketContext = {
  marketId: string;
  countryCode: string;
  locale: string;
  currencyCode: string;
};

export function getMarketContext(
  context: Pick<
    StorefrontCampaignContext,
    "market" | "country" | "locale" | "currency"
  >,
): MarketContext {
  return {
    marketId: normalizeMarketId(context.market),
    countryCode: normalizeCountry(context.country),
    locale: normalizeLocale(context.locale),
    currencyCode: normalizeCurrency(context.currency),
  };
}

export function applyMarketCampaignRule(
  campaign: StorefrontCampaignResponseItem,
  rules: MarketCampaignRule[],
  context: StorefrontCampaignContext,
): StorefrontCampaignResponseItem | null {
  const rule = findBestMarketRule(rules, getMarketContext(context));

  if (!rule) return campaign;
  if (!rule.enabled) return null;

  const deliverySettings = readObject(rule.deliverySettings);

  return {
    ...campaign,
    freeShipping: campaign.freeShipping
      ? {
          ...campaign.freeShipping,
          thresholdAmount:
            formatAmount(rule.thresholdAmount?.toString()) ??
            campaign.freeShipping.thresholdAmount,
          currencyCode:
            normalizeCurrency(rule.currencyCode ?? "") ||
            campaign.freeShipping.currencyCode,
        }
      : campaign.freeShipping,
    deliveryCutoff: campaign.deliveryCutoff
      ? {
          ...campaign.deliveryCutoff,
          ...deliverySettings,
        }
      : campaign.deliveryCutoff,
  };
}

export function findBestMarketRule(
  rules: MarketCampaignRule[],
  context: MarketContext,
) {
  const rankedRules = rules
    .map((rule) => ({
      rule,
      score: scoreMarketRule(rule, context),
    }))
    .filter((item) => item.score >= 0)
    .sort((first, second) => second.score - first.score);

  return rankedRules[0]?.rule ?? null;
}

function scoreMarketRule(rule: MarketCampaignRule, context: MarketContext) {
  let score = 0;
  let hasConstraint = false;

  if (rule.marketId) {
    hasConstraint = true;
    if (normalizeMarketId(rule.marketId) !== context.marketId) return -1;
    score += 8;
  }

  if (rule.countryCode) {
    hasConstraint = true;
    if (normalizeCountry(rule.countryCode) !== context.countryCode) return -1;
    score += 4;
  }

  if (rule.locale) {
    hasConstraint = true;
    if (!localeMatches(rule.locale, context.locale)) return -1;
    score += 2;
  }

  if (rule.currencyCode) {
    hasConstraint = true;
    if (normalizeCurrency(rule.currencyCode) !== context.currencyCode) {
      return -1;
    }
    score += 1;
  }

  return hasConstraint ? score : -1;
}

function localeMatches(ruleLocale: string, contextLocale: string) {
  const normalizedRuleLocale = normalizeLocale(ruleLocale);
  const normalizedContextLocale = normalizeLocale(contextLocale);

  return (
    normalizedRuleLocale === normalizedContextLocale ||
    normalizedRuleLocale === normalizedContextLocale.split("-")[0]
  );
}

function formatAmount(value: string | null | undefined) {
  if (!value) return null;

  const number = Number(value);

  return Number.isFinite(number) ? number.toFixed(2) : value;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMarketId(value: string | null | undefined) {
  return readString(value).toUpperCase();
}

function normalizeCountry(value: string | null | undefined) {
  return readString(value).toUpperCase().slice(0, 2);
}

function normalizeCurrency(value: string | null | undefined) {
  const currency = readString(value).toUpperCase();

  return /^[A-Z]{3}$/.test(currency) ? currency : "";
}

function normalizeLocale(value: string | null | undefined) {
  return readString(value).replace("_", "-").toLowerCase();
}
