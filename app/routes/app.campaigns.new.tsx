import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";

import { CampaignForm } from "../components/CampaignForm";
import { createCampaign } from "../models/campaign.server";
import { getOrCreateShopByDomain } from "../models/shop.server";
import {
  hasCampaignFormErrors,
  parseCampaignFormData,
} from "../services/campaign-form.server";
import {
  canCreateCampaign,
  validateCampaignPlanAccess,
} from "../services/planLimits.server";
import { getShopSettingsOrDefaults } from "../services/shopSettings.server";
import { authenticate } from "../shopify.server";
import {
  defaultCampaignFormValues,
  type CampaignFormErrors,
  type CampaignFormValues,
} from "../types/campaign-form";
import { defaultBadgeSettingsValues } from "../types/badge";
import { defaultDeliveryCutoffSettingsValues } from "../types/delivery-cutoff";
import { defaultFreeShippingSettingsValues } from "../types/free-shipping";
import { defaultLowStockSettingsValues } from "../types/low-stock";
import { buildDefaultCampaignTranslations } from "../utils/campaign-localization";

type ActionData = {
  errors?: CampaignFormErrors;
  values?: CampaignFormValues;
};

type LoaderData = {
  defaults: CampaignFormValues;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const settings = await getShopSettingsOrDefaults(shop.id);

  return {
    defaults: {
      ...defaultCampaignFormValues,
      timezone: settings.defaultTimezone,
    },
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData | Response> => {
  const { session, redirect } = await authenticate.admin(request);
  const formData = await request.formData();
  const parsed = parseCampaignFormData(formData);

  if (hasCampaignFormErrors(parsed.errors)) {
    return {
      errors: parsed.errors,
      values: parsed.values,
    };
  }

  try {
    const shop = await getOrCreateShopByDomain(session.shop);
    const createGate = await canCreateCampaign(shop);

    if (!createGate.allowed) {
      return {
        values: parsed.values,
        errors: {
          form: createGate.reason,
        },
      };
    }

    const planErrors = await validateCampaignPlanAccess(shop, parsed.values);

    if (planErrors.length > 0) {
      return {
        values: parsed.values,
        errors: {
          form: planErrors.join(" "),
        },
      };
    }

    const campaign = await createCampaign({
      shop: { connect: { id: shop.id } },
      name: parsed.values.name,
      status: parsed.values.status,
      type: parsed.values.type,
      goal: parsed.values.goal,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      timezone: parsed.values.timezone,
      placements: {
        create: [
          {
            placementType: parsed.values.placementType,
            enabled: true,
          },
        ],
      },
      translations: {
        create: buildDefaultCampaignTranslations({
          goal: parsed.values.goal,
          type: parsed.values.type,
          overrides: {
            en: {
              headline: parsed.values.headline,
              subheadline: parsed.values.subheadline,
              ctaText: parsed.values.ctaText,
              ctaUrl: parsed.values.ctaUrl,
            },
          },
        }),
      },
      ...(parsed.values.type === "FREE_SHIPPING_GOAL" ||
      parsed.values.goal === "FREE_SHIPPING"
        ? {
            freeShippingSettings: {
              create: {
                thresholdAmount:
                  defaultFreeShippingSettingsValues.thresholdAmount,
                currencyCode: defaultFreeShippingSettingsValues.currencyCode,
                includeDiscountedSubtotal:
                  defaultFreeShippingSettingsValues.includeDiscountedSubtotal,
                emptyCartMessage:
                  defaultFreeShippingSettingsValues.emptyCartMessage,
                successMessage:
                  defaultFreeShippingSettingsValues.successMessage,
                progressStyle: defaultFreeShippingSettingsValues.progressStyle,
              },
            },
          }
        : {}),
      ...(parsed.values.type === "DELIVERY_CUTOFF" ||
      parsed.values.goal === "DELIVERY_CUTOFF"
        ? {
            deliveryCutoffSettings: {
              create: {
                afterCutoffBehavior:
                  defaultDeliveryCutoffSettingsValues.afterCutoffBehavior,
                countryRules: {},
                cutoffHour: Number(
                  defaultDeliveryCutoffSettingsValues.cutoffHour,
                ),
                cutoffMinute: Number(
                  defaultDeliveryCutoffSettingsValues.cutoffMinute,
                ),
                holidays: [],
                maxDeliveryDays: Number(
                  defaultDeliveryCutoffSettingsValues.maxDeliveryDays,
                ),
                minDeliveryDays: Number(
                  defaultDeliveryCutoffSettingsValues.minDeliveryDays,
                ),
                processingDays: Number(
                  defaultDeliveryCutoffSettingsValues.processingDays,
                ),
                workingDays: [1, 2, 3, 4, 5],
              },
            },
          }
        : {}),
      ...(parsed.values.type === "LOW_STOCK" ||
      parsed.values.goal === "LOW_STOCK_URGENCY"
        ? {
            lowStockSettings: {
              create: {
                fallbackMessage: defaultLowStockSettingsValues.fallbackMessage,
                showExactQuantity:
                  defaultLowStockSettingsValues.showExactQuantity,
                threshold: Number(defaultLowStockSettingsValues.threshold),
              },
            },
          }
        : {}),
      ...(parsed.values.type === "PRODUCT_BADGE" ||
      parsed.values.goal === "PRODUCT_BADGE"
        ? {
            badgeSettings: {
              create: {
                badgePosition: defaultBadgeSettingsValues.badgePosition,
                badgeShape: defaultBadgeSettingsValues.badgeShape,
                badgeText: defaultBadgeSettingsValues.badgeText,
              },
            },
          }
        : {}),
    });

    return redirect(`/app/campaigns/${campaign.id}`);
  } catch (error) {
    console.error("Failed to create campaign", error);

    return {
      values: parsed.values,
      errors: {
        form: "Campaign could not be created. Check the fields and try again.",
      },
    };
  }
};

export default function CreateCampaignPage() {
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const { defaults } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Create campaign">
      <CampaignForm
        mode="create"
        values={actionData?.values ?? defaults}
        errors={actionData?.errors}
      />
    </s-page>
  );
}
