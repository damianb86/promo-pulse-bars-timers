import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";
import {
  ExperimentPrimaryMetric,
  ExperimentVariantStatus,
} from "@prisma/client";

import { AiCampaignBuilder } from "../components/AiCampaignBuilder";
import { CampaignForm } from "../components/CampaignForm";
import {
  createCampaign,
  updateCampaignDesignForShop,
  updateCampaignTranslationsForShop,
} from "../models/campaign.server";
import { getOrCreateShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import {
  buildDefaultCampaignAiInput,
  generateCampaignSuggestion,
  hasCampaignAiFormErrors,
  parseAppliedCampaignSuggestion,
  parseCampaignAiFormData,
} from "../services/ai/campaignGenerator.server";
import {
  hasCampaignFormErrors,
  parseCampaignFormData,
} from "../services/campaign-form.server";
import { createExperiment } from "../services/experiments";
import {
  canCreateCampaign,
  validateCampaignPlanAccess,
} from "../services/planLimits.server";
import { canUsePremiumFeature } from "../services/premiumFeatures.server";
import { getShopSettingsOrDefaults } from "../services/shopSettings.server";
import {
  buildCampaignAiInputFromTemplate,
  buildCampaignFormDefaultsFromTemplate,
  getCampaignTemplateByKey,
} from "../services/templates/templateLibrary.server";
import type {
  CampaignAiFormErrors,
  CampaignAiInput,
  CampaignSuggestion,
} from "../types/ai-campaign";
import {
  defaultCampaignFormValues,
  type CampaignFormErrors,
  type CampaignFormValues,
} from "../types/campaign-form";
import type { StorefrontLocale } from "../types/localization";
import { defaultBadgeSettingsValues } from "../types/badge";
import { defaultDeliveryCutoffSettingsValues } from "../types/delivery-cutoff";
import { defaultFreeShippingSettingsValues } from "../types/free-shipping";
import { defaultLowStockSettingsValues } from "../types/low-stock";
import { buildDefaultCampaignTranslations } from "../utils/campaign-localization";

type ActionData = {
  aiErrors?: CampaignAiFormErrors;
  aiInput?: CampaignAiInput;
  aiSuggestion?: CampaignSuggestion | null;
  errors?: CampaignFormErrors;
  values?: CampaignFormValues;
};

type LoaderData = {
  aiInput: CampaignAiInput;
  aiLockedReason?: string;
  defaults: CampaignFormValues;
  templateSourceName?: string;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const settings = await getShopSettingsOrDefaults(shop.id);
  const aiGate = canUsePremiumFeature(shop, "AI_CAMPAIGN_BUILDER");
  const url = new URL(request.url);
  const templateKey = url.searchParams.get("templateKey");
  const templateGate = canUsePremiumFeature(shop, "CAMPAIGN_LIBRARY");
  const template =
    templateKey && templateGate.allowed
      ? await getCampaignTemplateByKey(templateKey)
      : null;

  return {
    aiInput: template
      ? buildCampaignAiInputFromTemplate(template)
      : buildDefaultCampaignAiInput({
          countryCode: settings.defaultCountry ?? "US",
          locale: settings.defaultLocale,
        }),
    aiLockedReason: aiGate.allowed ? undefined : aiGate.reason,
    defaults: template
      ? buildCampaignFormDefaultsFromTemplate(template)
      : {
          ...defaultCampaignFormValues,
          timezone: settings.defaultTimezone,
        },
    templateSourceName: template?.eventName,
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData | Response> => {
  const { session, redirect } = await authenticateAdmin(request);
  const shop = await getOrCreateShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = formData.get("_action");

  if (intent === "generateAiCampaignSuggestion") {
    const aiGate = canUsePremiumFeature(shop, "AI_CAMPAIGN_BUILDER");
    const parsedAi = parseCampaignAiFormData(formData);

    if (!aiGate.allowed) {
      return {
        aiInput: parsedAi.values,
        aiErrors: {
          form: aiGate.reason,
        },
      };
    }

    if (hasCampaignAiFormErrors(parsedAi.errors)) {
      return {
        aiInput: parsedAi.values,
        aiErrors: parsedAi.errors,
      };
    }

    try {
      return {
        aiInput: parsedAi.values,
        aiSuggestion: await generateCampaignSuggestion(parsedAi.values),
      };
    } catch (error) {
      console.error("Failed to generate AI campaign suggestion", error);

      return {
        aiInput: parsedAi.values,
        aiErrors: {
          form: "Suggestion could not be generated. Check the fields and try again.",
        },
      };
    }
  }

  const parsed = parseCampaignFormData(formData);

  if (hasCampaignFormErrors(parsed.errors)) {
    return {
      errors: parsed.errors,
      values: parsed.values,
    };
  }

  const appliedAiSuggestion = parseAppliedCampaignSuggestion(
    formData.get("aiSuggestionJson"),
  );

  try {
    const createGate = await canCreateCampaign(shop);

    if (!createGate.allowed) {
      return {
        values: parsed.values,
        errors: {
          form: createGate.reason,
        },
      };
    }

    if (appliedAiSuggestion) {
      const aiGate = canUsePremiumFeature(shop, "AI_CAMPAIGN_BUILDER");

      if (!aiGate.allowed) {
        return {
          values: parsed.values,
          errors: {
            form: aiGate.reason,
          },
        };
      }
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

    if (appliedAiSuggestion) {
      await applyAiSuggestionToCampaign({
        campaignId: campaign.id,
        formValues: parsed.values,
        shopId: shop.id,
        suggestion: appliedAiSuggestion,
      });
    }

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
  const { aiInput, aiLockedReason, defaults, templateSourceName } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Create campaign">
      <div className="counterpulse-create-workspace">
        <div className="counterpulse-create-workspace__main">
          <CampaignForm
            mode="create"
            values={actionData?.values ?? defaults}
            errors={actionData?.errors}
          />
        </div>
        <aside
          className="counterpulse-ai-drawer"
          aria-label="AI Campaign Assistant"
        >
          <AiCampaignBuilder
            errors={actionData?.aiErrors}
            lockedReason={aiLockedReason}
            suggestion={actionData?.aiSuggestion}
            templateSourceName={templateSourceName}
            values={actionData?.aiInput ?? aiInput}
          />
        </aside>
      </div>
    </s-page>
  );
}

async function applyAiSuggestionToCampaign({
  campaignId,
  formValues,
  shopId,
  suggestion,
}: {
  campaignId: string;
  formValues: CampaignFormValues;
  shopId: string;
  suggestion: CampaignSuggestion;
}) {
  await updateCampaignDesignForShop(campaignId, shopId, suggestion.design);
  await updateCampaignTranslationsForShop(
    campaignId,
    shopId,
    buildTranslationsForSavedCampaign(suggestion, formValues),
  );

  if (suggestion.variants.length < 2) return;

  await createExperiment({
    shopId,
    campaignId,
    name: "AI suggested variants",
    primaryMetric: ExperimentPrimaryMetric.CLICK_RATE,
    variants: suggestion.variants.map((variant) => ({
      name: variant.name,
      weight: variant.weight,
      status: ExperimentVariantStatus.DRAFT,
      textOverride: {
        headline: variant.headline,
        subheadline: variant.subheadline,
        ctaText: variant.ctaText,
      },
      designOverride: variant.designOverride,
      discountOverride: variant.discountOverride,
      placementOverride: variant.placementOverride,
    })),
  });
}

function buildTranslationsForSavedCampaign(
  suggestion: CampaignSuggestion,
  formValues: CampaignFormValues,
) {
  const locales = Object.keys(suggestion.translations) as StorefrontLocale[];

  return locales.map((locale) => {
    const translation = suggestion.translations[locale];

    return {
      locale,
      headline: locale === "en" ? formValues.headline : translation.headline,
      subheadline:
        locale === "en" ? formValues.subheadline : translation.subheadline,
      ctaText: locale === "en" ? formValues.ctaText : translation.ctaText,
      ctaUrl: locale === "en" ? formValues.ctaUrl : translation.ctaUrl,
      expiredText: translation.expiredText,
      freeShippingEmptyText: translation.freeShippingEmptyText,
      freeShippingProgressText: translation.freeShippingProgressText,
      freeShippingSuccessText: translation.freeShippingSuccessText,
      deliveryBeforeCutoffText: translation.deliveryBeforeCutoffText,
      deliveryAfterCutoffText: translation.deliveryAfterCutoffText,
      lowStockText: translation.lowStockText,
      badgeText: translation.badgeText,
    };
  });
}
