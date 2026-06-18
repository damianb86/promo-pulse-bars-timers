import { Prisma, Stage2RuleStatus } from "@prisma/client";

import prisma from "../../db.server";

export type AdvancedBadgeRuleInput = {
  priority: number;
  status: Stage2RuleStatus;
  conditions: Prisma.InputJsonObject;
  design: Prisma.InputJsonObject;
};

export function listAdvancedBadgeRulesForCampaign(
  shopId: string,
  campaignId: string,
) {
  return prisma.advancedBadgeRule.findMany({
    where: { shopId, campaignId },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

export async function saveAdvancedBadgeRule({
  campaignId,
  input,
  ruleId,
  shopId,
}: {
  campaignId: string;
  input: AdvancedBadgeRuleInput;
  ruleId?: string;
  shopId: string;
}) {
  await assertCampaignBelongsToShop(campaignId, shopId);

  if (ruleId) {
    return prisma.advancedBadgeRule.updateMany({
      where: { id: ruleId, shopId, campaignId },
      data: {
        priority: input.priority,
        status: input.status,
        conditions: input.conditions,
        design: input.design,
      },
    });
  }

  return prisma.advancedBadgeRule.create({
    data: {
      shopId,
      campaignId,
      priority: input.priority,
      status: input.status,
      conditions: input.conditions,
      design: input.design,
    },
  });
}

export async function deleteAdvancedBadgeRule({
  campaignId,
  ruleId,
  shopId,
}: {
  campaignId: string;
  ruleId: string;
  shopId: string;
}) {
  return prisma.advancedBadgeRule.deleteMany({
    where: { id: ruleId, campaignId, shopId },
  });
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
