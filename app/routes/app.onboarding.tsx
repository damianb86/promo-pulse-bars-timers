import { AnalyticsEventType } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";

import {
  OnboardingWizard,
  type OnboardingWizardActionData,
} from "../components/OnboardingWizard";
import prisma from "../db.server";
import { getOrCreateShopByDomain } from "../models/shop.server";
import {
  createStarterCampaignFromGoal,
  getOnboardingChecklistStatus,
  getOnboardingGoalLockReasons,
  OnboardingError,
  updateManualOnboardingChecklistField,
} from "../services/onboarding.server";
import { getEffectiveShopPlan } from "../services/planLimits.server";
import { getShopSettingsOrDefaults } from "../services/shopSettings.server";
import { authenticate } from "../shopify.server";
import { campaignDesignTemplates } from "../types/campaign-design";
import type {
  OnboardingChecklistField,
  OnboardingGoalValue,
  OnboardingLocationValue,
} from "../types/onboarding";
import {
  onboardingGoalOptions,
  onboardingLocationOptions,
} from "../types/onboarding";
import { buildThemeEditorUrl } from "../utils/onboarding";

type LoaderData = {
  hasCampaigns: boolean;
  shopifyDomain: string;
  currentPlan: string;
  checklist: Awaited<ReturnType<typeof getOnboardingChecklistStatus>>;
  goalLockReasons: ReturnType<typeof getOnboardingGoalLockReasons>;
  themeEditorUrl: string;
};

const allowedGoals = new Set(onboardingGoalOptions.map((goal) => goal.value));
const allowedLocations = new Set(
  onboardingLocationOptions.map((location) => location.value),
);
const allowedTemplates = new Set(
  campaignDesignTemplates.map((template) => template.templateKey),
);

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const [campaignCount, impressionCount] = await Promise.all([
    prisma.campaign.count({ where: { shopId: shop.id } }),
    prisma.analyticsEvent.count({
      where: {
        shopId: shop.id,
        eventType: AnalyticsEventType.IMPRESSION,
      },
    }),
  ]);
  const checklist = await getOnboardingChecklistStatus(shop.id, {
    firstCampaignCreated: campaignCount > 0,
    firstImpressionReceived: impressionCount > 0,
  });

  return {
    hasCampaigns: campaignCount > 0,
    shopifyDomain: shop.shopifyDomain,
    currentPlan: getEffectiveShopPlan(shop),
    checklist,
    goalLockReasons: getOnboardingGoalLockReasons(shop),
    themeEditorUrl: buildThemeEditorUrl(shop.shopifyDomain),
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<OnboardingWizardActionData> => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "updateChecklist") {
    return updateChecklistAction(shop.id, formData);
  }

  if (intent !== "createStarterCampaign") {
    return { error: "Unsupported onboarding action." };
  }

  const values = readStarterCampaignValues(formData);

  try {
    const settings = await getShopSettingsOrDefaults(shop.id);
    const campaign = await createStarterCampaignFromGoal(shop, {
      ...values,
      timezone: settings.defaultTimezone,
    });
    const placementType = campaign.placements[0]?.placementType;
    const checklist = await getOnboardingChecklistStatus(shop.id, {
      firstCampaignCreated: true,
    });

    return {
      success: true,
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignEditUrl: `/app/campaigns/${campaign.id}`,
      checklist,
      instructions: buildSetupInstructions(placementType),
      placementType,
      themeEditorUrl: buildThemeEditorUrl(shop.shopifyDomain, placementType),
    };
  } catch (error) {
    if (error instanceof OnboardingError) {
      return { error: error.message, values };
    }

    console.error("Failed to create Promo Pulse starter campaign", error);

    return {
      error:
        "Starter campaign could not be created. Check the setup and try again.",
      values,
    };
  }
};

export default function OnboardingPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | OnboardingWizardActionData
    | undefined;

  return (
    <s-page heading="Guided setup">
      <OnboardingWizard {...loaderData} actionData={actionData} />
    </s-page>
  );
}

async function updateChecklistAction(shopId: string, formData: FormData) {
  const field = String(formData.get("field") ?? "") as OnboardingChecklistField;
  const value = String(formData.get("value")) === "true";

  try {
    await updateManualOnboardingChecklistField(shopId, field, value);

    return {
      notice: value
        ? "Checklist step marked done."
        : "Checklist step reopened.",
      checklist: await getOnboardingChecklistStatus(shopId),
    };
  } catch (error) {
    if (error instanceof OnboardingError) {
      return { error: error.message };
    }

    console.error("Failed to update onboarding checklist", error);
    return { error: "Checklist could not be updated." };
  }
}

function readStarterCampaignValues(formData: FormData) {
  return {
    goal: readOption(
      formData,
      "goal",
      allowedGoals,
      "FLASH_SALE",
    ) as OnboardingGoalValue,
    location: readOption(
      formData,
      "location",
      allowedLocations,
      "TOP_BAR",
    ) as OnboardingLocationValue,
    templateKey: readOption(
      formData,
      "templateKey",
      allowedTemplates,
      "clean-minimal",
    ),
    headline: readString(formData, "headline"),
    subheadline: readString(formData, "subheadline"),
    ctaText: readString(formData, "ctaText"),
    ctaUrl: readString(formData, "ctaUrl"),
  };
}

function readOption(
  formData: FormData,
  key: string,
  allowedValues: Set<string>,
  fallback: string,
) {
  const value = readString(formData, key);

  return allowedValues.has(value) ? value : fallback;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function buildSetupInstructions(placementType: string | undefined) {
  const instructions = [
    "Open Theme Editor and enable the Promo Pulse app embed.",
  ];

  if (placementType === "PRODUCT_PAGE") {
    instructions.push(
      "Add the Promo Pulse product block to the product template.",
    );
  }

  if (placementType === "CART_PAGE" || placementType === "CART_DRAWER") {
    instructions.push("Add the Promo Pulse cart block to the cart template.");
  }

  instructions.push("Visit the storefront to confirm the first impression.");

  return instructions;
}
