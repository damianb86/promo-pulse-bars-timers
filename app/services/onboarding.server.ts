import type { ShopOnboardingChecklist } from "@prisma/client";

import prisma from "../db.server";
import type {
  OnboardingChecklistField,
  OnboardingChecklistStatus,
} from "../types/onboarding";

export type OnboardingChecklistInferredState = Partial<OnboardingChecklistStatus>;

export class OnboardingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnboardingError";
  }
}

export async function getOnboardingChecklistStatus(
  shopId: string,
  inferred: OnboardingChecklistInferredState = {},
): Promise<OnboardingChecklistStatus> {
  const checklist = await getOrCreateOnboardingChecklist(shopId);
  const nextValues: Partial<OnboardingChecklistStatus> = {};

  for (const field of Object.keys(inferred) as OnboardingChecklistField[]) {
    if (inferred[field] === true && !checklist[field]) {
      nextValues[field] = true;
    }
  }

  const updatedChecklist =
    Object.keys(nextValues).length > 0
      ? await updateOnboardingChecklist(shopId, nextValues)
      : checklist;

  return toChecklistStatus(updatedChecklist);
}

export function markFirstImpressionReceived(shopId: string) {
  return updateOnboardingChecklist(shopId, {
    firstImpressionReceived: true,
  });
}

function getOrCreateOnboardingChecklist(shopId: string) {
  return prisma.shopOnboardingChecklist.upsert({
    where: { shopId },
    update: {},
    create: { shopId },
  });
}

function updateOnboardingChecklist(
  shopId: string,
  values: Partial<OnboardingChecklistStatus>,
) {
  return prisma.shopOnboardingChecklist.upsert({
    where: { shopId },
    update: values,
    create: {
      shopId,
      ...values,
    },
  });
}

function toChecklistStatus(
  checklist: Pick<
    ShopOnboardingChecklist,
    | "firstCampaignCreated"
    | "appEmbedEnabled"
    | "productBlockAdded"
    | "cartBlockAdded"
    | "firstImpressionReceived"
  >,
): OnboardingChecklistStatus {
  return {
    firstCampaignCreated: checklist.firstCampaignCreated,
    appEmbedEnabled: checklist.appEmbedEnabled,
    productBlockAdded: checklist.productBlockAdded,
    cartBlockAdded: checklist.cartBlockAdded,
    firstImpressionReceived: checklist.firstImpressionReceived,
  };
}
