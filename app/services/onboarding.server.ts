import type { ShopOnboardingChecklist } from "@prisma/client";

import prisma from "../db.server";
import type {
  OnboardingChecklistField,
  OnboardingChecklistStatus,
} from "../types/onboarding";

export type OnboardingChecklistInferredState = Partial<
  Pick<
    OnboardingChecklistStatus,
    "firstCampaignCreated" | "firstImpressionReceived"
  >
>;

export class OnboardingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnboardingError";
  }
}

const manualChecklistFields = new Set<OnboardingChecklistField>([
  "appEmbedEnabled",
  "productBlockAdded",
  "cartBlockAdded",
]);

export async function getOnboardingChecklistStatus(
  shopId: string,
  inferred: OnboardingChecklistInferredState = {},
): Promise<OnboardingChecklistStatus> {
  const checklist = await getOrCreateOnboardingChecklist(shopId);
  const nextValues: Partial<OnboardingChecklistStatus> = {};

  if (inferred.firstCampaignCreated && !checklist.firstCampaignCreated) {
    nextValues.firstCampaignCreated = true;
  }

  if (inferred.firstImpressionReceived && !checklist.firstImpressionReceived) {
    nextValues.firstImpressionReceived = true;
  }

  const updatedChecklist =
    Object.keys(nextValues).length > 0
      ? await updateOnboardingChecklist(shopId, nextValues)
      : checklist;

  return toChecklistStatus(updatedChecklist);
}

export async function updateManualOnboardingChecklistField(
  shopId: string,
  field: OnboardingChecklistField,
  value: boolean,
) {
  if (!manualChecklistFields.has(field)) {
    throw new OnboardingError(
      "This onboarding step cannot be changed manually.",
    );
  }

  return updateOnboardingChecklist(shopId, { [field]: value });
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
