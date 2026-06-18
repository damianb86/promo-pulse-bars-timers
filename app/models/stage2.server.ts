import type { CampaignRecommendationStatus, Prisma } from "@prisma/client";

import prisma from "../db.server";

export function createDiscountCodePool(
  data: Prisma.DiscountCodePoolUncheckedCreateInput,
) {
  return prisma.discountCodePool.create({ data });
}

export function listDiscountCodePoolsForShop(shopId: string) {
  return prisma.discountCodePool.findMany({
    where: { shopId },
    orderBy: [{ createdAt: "desc" }],
  });
}

export function createUniqueDiscountCode(
  data: Prisma.UniqueDiscountCodeUncheckedCreateInput,
) {
  return prisma.uniqueDiscountCode.create({ data });
}

export function listUniqueDiscountCodesForCampaign(campaignId: string) {
  return prisma.uniqueDiscountCode.findMany({
    where: { campaignId },
    orderBy: [{ createdAt: "desc" }],
  });
}

export function createExperiment(
  data: Prisma.ExperimentUncheckedCreateInput,
) {
  return prisma.experiment.create({ data });
}

export function getExperimentWithVariants(id: string, shopId: string) {
  return prisma.experiment.findFirst({
    where: { id, shopId },
    include: { variants: true },
  });
}

export function listExperimentsForCampaign(campaignId: string) {
  return prisma.experiment.findMany({
    where: { campaignId },
    include: { variants: true },
    orderBy: [{ createdAt: "desc" }],
  });
}

export function createExperimentVariant(
  data: Prisma.ExperimentVariantUncheckedCreateInput,
) {
  return prisma.experimentVariant.create({ data });
}

export function recordAttributionTouch(
  data: Prisma.AttributionTouchUncheckedCreateInput,
) {
  return prisma.attributionTouch.create({ data });
}

export function recordAttributionConversion(
  data: Prisma.AttributionConversionUncheckedCreateInput,
) {
  return prisma.attributionConversion.create({ data });
}

export function listAttributionConversionsForShop(shopId: string) {
  return prisma.attributionConversion.findMany({
    where: { shopId },
    orderBy: [{ occurredAt: "desc" }],
  });
}

export function createEmailTimer(data: Prisma.EmailTimerUncheckedCreateInput) {
  return prisma.emailTimer.create({ data });
}

export function listEmailTimersForCampaign(campaignId: string) {
  return prisma.emailTimer.findMany({
    where: { campaignId },
    orderBy: [{ createdAt: "desc" }],
  });
}

export function createAdvancedBadgeRule(
  data: Prisma.AdvancedBadgeRuleUncheckedCreateInput,
) {
  return prisma.advancedBadgeRule.create({ data });
}

export function listAdvancedBadgeRulesForCampaign(campaignId: string) {
  return prisma.advancedBadgeRule.findMany({
    where: { campaignId },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

export function createMarketCampaignRule(
  data: Prisma.MarketCampaignRuleUncheckedCreateInput,
) {
  return prisma.marketCampaignRule.create({ data });
}

export function listMarketCampaignRulesForCampaign(campaignId: string) {
  return prisma.marketCampaignRule.findMany({
    where: { campaignId },
    orderBy: [{ createdAt: "desc" }],
  });
}

export function listCampaignTemplates(
  where: Prisma.CampaignTemplateWhereInput = {},
) {
  return prisma.campaignTemplate.findMany({
    where,
    orderBy: [{ category: "asc" }, { eventName: "asc" }],
  });
}

export function createCampaignRecommendation(
  data: Prisma.CampaignRecommendationUncheckedCreateInput,
) {
  return prisma.campaignRecommendation.create({ data });
}

export function listCampaignRecommendationsForShop(
  shopId: string,
  status?: CampaignRecommendationStatus,
) {
  return prisma.campaignRecommendation.findMany({
    where: {
      shopId,
      ...(status ? { status } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export function createAgencyAccount(
  data: Prisma.AgencyAccountUncheckedCreateInput,
) {
  return prisma.agencyAccount.create({ data });
}

export function grantAgencyShopAccess(
  data: Prisma.AgencyShopAccessUncheckedCreateInput,
) {
  return prisma.agencyShopAccess.create({ data });
}
