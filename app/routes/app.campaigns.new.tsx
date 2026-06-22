import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import {
  ExperimentPrimaryMetric,
  ExperimentVariantStatus,
  type Prisma,
} from "@prisma/client";

import { AiCampaignBuilder } from "../components/AiCampaignBuilder";
import { CampaignForm } from "../components/CampaignForm";
import {
  createCampaign,
  toTargetingWriteData,
  updateBadgeSettingsForShop,
  updateCampaignDesignForShop,
  updateCampaignTranslationsForShop,
  updateDeliveryCutoffSettingsForShop,
  updateDiscountSyncForShop,
  updateFreeShippingSettingsForShop,
  updateLowStockSettingsForShop,
} from "../models/campaign.server";
import { getOrCreateShopByDomain } from "../models/shop.server";
import { authenticateAdmin } from "../services/admin-auth.server";
import {
  buildCampaignAiFollowUpQuestions,
  buildDefaultCampaignAiInput,
  generateCampaignSuggestion,
  hasCampaignAiFormErrors,
  parseAppliedCampaignSuggestion,
  parseCampaignAiFormData,
  shouldAskCampaignAiFollowUpQuestions,
} from "../services/ai/campaignGenerator.server";
import {
  hasCampaignFormErrors,
  parseCampaignFormData,
} from "../services/campaign-form.server";
import { loadCampaignTargetingOptions } from "../services/campaign-targeting-options.server";
import { createExperiment } from "../services/experiments";
import {
  canCreateCampaign,
  canUseFeature,
  getLockedFeatureReason,
  validateCampaignPlanAccess,
} from "../services/planLimits.server";
import {
  createFreeShippingCodeDiscount,
  getDiscountByCodeOrId,
  type ShopifyDiscountSummary,
} from "../services/shopifyDiscounts.server";
import { canUsePremiumFeature } from "../services/premiumFeatures.server";
import { getShopSettingsOrDefaults } from "../services/shopSettings.server";
import {
  buildCampaignAiInputFromTemplate,
  buildCampaignFormDefaultsFromTemplate,
  getCampaignTemplateByKey,
} from "../services/templates/templateLibrary.server";
import type {
  CampaignAiFormErrors,
  CampaignAiFollowUpQuestion,
  CampaignAiInput,
  CampaignSuggestion,
} from "../types/ai-campaign";
import {
  buildCampaignBadgeSettingsValues,
  buildCampaignDeliveryCutoffSettingsValues,
  buildCampaignTimerSettingsValues,
  buildCampaignTargetingValues,
  buildCampaignFreeShippingSettingsValues,
  buildCampaignLowStockSettingsValues,
  defaultCampaignFormValues,
  emptyCampaignTargetingOptions,
  type CampaignFormErrors,
  type CampaignFormValues,
  type CampaignTargetingOptions,
} from "../types/campaign-form";
import type { StorefrontLocale } from "../types/localization";
import { buildDefaultCampaignTranslations } from "../utils/campaign-localization";
import { applyCampaignTypeDefaultTextValues } from "../utils/campaign-type-text-defaults";

type ActionData = {
  aiErrors?: CampaignAiFormErrors;
  aiFollowUpQuestions?: CampaignAiFollowUpQuestion[];
  aiInput?: CampaignAiInput;
  aiSuggestion?: CampaignSuggestion | null;
  errors?: CampaignFormErrors;
  values?: CampaignFormValues;
};

type LoaderData = {
  aiInput: CampaignAiInput;
  aiLockedReason?: string;
  defaults: CampaignFormValues;
  targetingOptions: CampaignTargetingOptions;
  lockedTargetingFeatures: {
    advanced: string;
    basic: string;
    geo: string;
    recurringTimers: string;
    scheduling: string;
  };
  templateSourceName?: string;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<LoaderData> => {
  const { admin, session } = await authenticateAdmin(request);
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
          ...applyCampaignTypeDefaultTextValues(defaultCampaignFormValues, {
            overwrite: true,
          }),
          startsAt: "",
          endsAt: toDateTimeLocalValue(
            new Date(Date.now() + 24 * 60 * 60 * 1000),
          ),
          timezone: settings.defaultTimezone,
        },
    lockedTargetingFeatures: {
      advanced: getLockedFeatureReason(shop, "advanced_targeting"),
      basic: getLockedFeatureReason(shop, "basic_targeting"),
      geo: getLockedFeatureReason(shop, "geo_market_targeting"),
      recurringTimers: getLockedFeatureReason(shop, "recurring_timers"),
      scheduling: getLockedFeatureReason(shop, "scheduling"),
    },
    targetingOptions: await loadTargetingOptions(admin),
    templateSourceName: template?.eventName,
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData | Response> => {
  const { admin, session, redirect } = await authenticateAdmin(request);
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

    if (
      shouldAskCampaignAiFollowUpQuestions(
        parsedAi.values,
        formData.get("aiFollowUpStatus"),
      )
    ) {
      return {
        aiInput: parsedAi.values,
        aiFollowUpQuestions: buildCampaignAiFollowUpQuestions(parsedAi.values),
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
  const targeting = buildCampaignTargetingValues(parsed.values);
  const timerSettings = buildCampaignTimerSettingsValues(parsed.values);
  const isFreeShippingCampaign =
    parsed.values.type === "FREE_SHIPPING_GOAL" ||
    parsed.values.goal === "FREE_SHIPPING";
  const isDeliveryCutoffCampaign =
    parsed.values.type === "DELIVERY_CUTOFF" ||
    parsed.values.goal === "DELIVERY_CUTOFF";
  const isLowStockCampaign =
    parsed.values.type === "LOW_STOCK" ||
    parsed.values.goal === "LOW_STOCK_URGENCY";
  const isBadgeCampaign =
    parsed.values.type === "PRODUCT_BADGE" ||
    parsed.values.goal === "PRODUCT_BADGE";
  const freeShippingSettings =
    buildCampaignFreeShippingSettingsValues(parsed.values);
  const deliveryCutoffSettings =
    buildCampaignDeliveryCutoffSettingsValues(parsed.values);
  const lowStockSettings = buildCampaignLowStockSettingsValues(parsed.values);
  const badgeSettings = buildCampaignBadgeSettingsValues(parsed.values);

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

    const planErrors = await validateCampaignPlanAccess(shop, {
      ...parsed.values,
      targeting,
      timerSettings,
    });

    if (planErrors.length > 0) {
      return {
        values: parsed.values,
        errors: {
          form: planErrors.join(" "),
        },
      };
    }

    if (isFreeShippingCampaign && parsed.values.freeShippingAutoDiscount) {
      const discountGate = canUseFeature(shop, "discount_sync");

      if (!discountGate.allowed) {
        return {
          values: parsed.values,
          errors: {
            freeShippingDiscountCode: discountGate.reason,
          },
        };
      }
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
        create: parsed.values.placementTypes.map((placementType) => ({
          placementType,
          customSelector:
            placementType === "CUSTOM_SELECTOR"
              ? parsed.values.customSelector || null
              : null,
          enabled: true,
        })),
      },
      targeting: {
        create: toTargetingWriteData(targeting),
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
              expiredText: parsed.values.expiredText,
            },
          },
        }),
      },
      timerSettings: {
        create: {
          mode: timerSettings.mode,
          durationMinutes: timerSettings.durationMinutes,
          recurringDays: timerSettings.recurringDays,
          resetBehavior: timerSettings.resetBehavior,
          expiredBehavior: timerSettings.expiredBehavior,
        },
      },
      ...(isFreeShippingCampaign
        ? {
            freeShippingSettings: {
              create: {
                thresholdAmount: Number(
                  freeShippingSettings.thresholdAmount,
                ).toFixed(2),
                currencyCode: freeShippingSettings.currencyCode,
                includeDiscountedSubtotal:
                  freeShippingSettings.includeDiscountedSubtotal,
                emptyCartMessage: freeShippingSettings.emptyCartMessage,
                successMessage: freeShippingSettings.successMessage,
                progressStyle: freeShippingSettings.progressStyle,
              },
            },
          }
        : {}),
      ...(isDeliveryCutoffCampaign
        ? {
            deliveryCutoffSettings: {
              create: {
                afterCutoffBehavior:
                  deliveryCutoffSettings.afterCutoffBehavior,
                countryRules: deliveryCutoffSettings.countryRules,
                cutoffHour: deliveryCutoffSettings.cutoffHour,
                cutoffMinute: deliveryCutoffSettings.cutoffMinute,
                holidays: deliveryCutoffSettings.holidays,
                maxDeliveryDays: deliveryCutoffSettings.maxDeliveryDays,
                minDeliveryDays: deliveryCutoffSettings.minDeliveryDays,
                processingDays: deliveryCutoffSettings.processingDays,
                workingDays: deliveryCutoffSettings.workingDays,
              },
            },
          }
        : {}),
      ...(isLowStockCampaign
        ? {
            lowStockSettings: {
              create: {
                fallbackMessage: lowStockSettings.fallbackMessage,
                showExactQuantity: lowStockSettings.showExactQuantity,
                threshold: lowStockSettings.threshold,
              },
            },
          }
        : {}),
      ...(isBadgeCampaign
        ? {
            badgeSettings: {
              create: {
                badgePosition: badgeSettings.badgePosition,
                badgeShape: badgeSettings.badgeShape,
                badgeText: badgeSettings.badgeText,
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

    if (isFreeShippingCampaign && parsed.values.freeShippingAutoDiscount) {
      await createOrLinkFreeShippingDiscountForCampaign({
        admin,
        campaignId: campaign.id,
        shopId: shop.id,
        values: parsed.values,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
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
  const {
    aiInput,
    aiLockedReason,
    defaults,
    lockedTargetingFeatures,
    targetingOptions,
    templateSourceName,
  } = useLoaderData<typeof loader>();
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(
    Boolean(
      actionData?.aiErrors ||
      actionData?.aiFollowUpQuestions ||
      actionData?.aiSuggestion,
    ),
  );

  useEffect(() => {
    if (
      actionData?.aiErrors ||
      actionData?.aiFollowUpQuestions ||
      actionData?.aiSuggestion
    ) {
      const openAiDrawer = window.setTimeout(() => {
        setIsAiDrawerOpen(true);
      }, 0);

      return () => window.clearTimeout(openAiDrawer);
    }

    return undefined;
  }, [
    actionData?.aiErrors,
    actionData?.aiFollowUpQuestions,
    actionData?.aiSuggestion,
  ]);

  return (
    <s-page inlineSize="large" heading="Create campaign">
      <div className="counterpulse-create-workspace">
        <div className="counterpulse-create-workspace__main">
          <CampaignForm
            key={JSON.stringify(actionData?.values ?? defaults)}
            mode="create"
            lockedTargetingFeatures={lockedTargetingFeatures}
            targetingOptions={targetingOptions}
            values={actionData?.values ?? defaults}
            errors={actionData?.errors}
            topbarActions={
              <button
                className="counterpulse-ai-launch-button"
                type="button"
                onClick={() => setIsAiDrawerOpen(true)}
              >
                <AiSparkIcon />
                <span>AI campaign</span>
              </button>
            }
          />
        </div>
      </div>
      {isAiDrawerOpen && (
        <div className="counterpulse-ai-drawer-shell">
          <button
            aria-label="Close AI campaign drawer"
            className="counterpulse-ai-drawer-backdrop"
            type="button"
            onClick={() => setIsAiDrawerOpen(false)}
          />
          <aside
            aria-label="AI Campaign Assistant"
            className="counterpulse-ai-drawer"
          >
            <div className="counterpulse-ai-drawer__header">
              <div>
                <p className="counterpulse-kicker">AI campaign assistant</p>
                <h2>Generate a campaign draft</h2>
              </div>
              <button
                aria-label="Close AI campaign drawer"
                className="counterpulse-ai-drawer__close"
                type="button"
                onClick={() => setIsAiDrawerOpen(false)}
              >
                x
              </button>
            </div>
            <AiCampaignBuilder
              errors={actionData?.aiErrors}
              followUpQuestions={actionData?.aiFollowUpQuestions}
              lockedReason={aiLockedReason}
              onApplied={() => setIsAiDrawerOpen(false)}
              suggestion={actionData?.aiSuggestion}
              templateSourceName={templateSourceName}
              values={actionData?.aiInput ?? aiInput}
            />
          </aside>
        </div>
      )}
    </s-page>
  );
}

function AiSparkIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 2.5 13.6 8l5.6 1.6-5.6 1.6L12 16.7l-1.6-5.5-5.6-1.6L10.4 8 12 2.5Z" />
      <path d="M18.5 14.2 19.4 17l2.9.9-2.9.9-.9 2.8-.9-2.8-2.8-.9 2.8-.9.9-2.8Z" />
      <path d="M5.3 15.4 6 17.5l2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z" />
    </svg>
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
  await applyAiGeneratedSettingsToCampaign({
    campaignId,
    formValues,
    shopId,
    suggestion,
  });

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

async function applyAiGeneratedSettingsToCampaign({
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
  const tasks: Promise<unknown>[] = [];

  if (
    formValues.type === "FREE_SHIPPING_GOAL" ||
    formValues.goal === "FREE_SHIPPING"
  ) {
    tasks.push(
      updateFreeShippingSettingsForShop(campaignId, shopId, {
        thresholdAmount: suggestion.freeShipping.thresholdAmount,
        currencyCode: suggestion.freeShipping.currencyCode,
        includeDiscountedSubtotal:
          suggestion.freeShipping.includeDiscountedSubtotal,
        emptyCartMessage: suggestion.freeShipping.emptyCartMessage,
        successMessage: suggestion.freeShipping.successMessage,
        progressStyle: suggestion.freeShipping.progressStyle,
        thresholdRules: null,
      }),
    );
  }

  if (
    formValues.type === "DELIVERY_CUTOFF" ||
    formValues.goal === "DELIVERY_CUTOFF"
  ) {
    tasks.push(
      updateDeliveryCutoffSettingsForShop(campaignId, shopId, {
        timezone: formValues.timezone,
        cutoffHour: Number(suggestion.deliveryCutoff.cutoffHour),
        cutoffMinute: Number(suggestion.deliveryCutoff.cutoffMinute),
        processingDays: Number(suggestion.deliveryCutoff.processingDays),
        minDeliveryDays: Number(suggestion.deliveryCutoff.minDeliveryDays),
        maxDeliveryDays: Number(suggestion.deliveryCutoff.maxDeliveryDays),
        workingDays: suggestion.deliveryCutoff.workingDays,
        holidays: suggestion.deliveryCutoff.holidays,
        countryRules: suggestion.deliveryCutoff
          .countryRules as Prisma.InputJsonValue,
        afterCutoffBehavior: suggestion.deliveryCutoff.afterCutoffBehavior,
      }),
    );
  }

  if (
    formValues.type === "LOW_STOCK" ||
    formValues.goal === "LOW_STOCK_URGENCY"
  ) {
    tasks.push(
      updateLowStockSettingsForShop(campaignId, shopId, {
        threshold: Number(suggestion.lowStock.threshold),
        showExactQuantity: suggestion.lowStock.showExactQuantity,
        fallbackMessage: suggestion.lowStock.fallbackMessage,
      }),
    );
  }

  if (
    formValues.type === "PRODUCT_BADGE" ||
    formValues.goal === "PRODUCT_BADGE"
  ) {
    tasks.push(
      updateBadgeSettingsForShop(campaignId, shopId, {
        badgeText: suggestion.badge.badgeText,
        badgeShape: suggestion.badge.badgeShape,
        badgePosition: suggestion.badge.badgePosition,
      }),
    );
  }

  if (suggestion.discount.mode !== "NONE") {
    tasks.push(
      updateDiscountSyncForShop(campaignId, shopId, {
        shopifyDiscountId: null,
        discountCode: suggestion.discount.discountCode || null,
        method:
          suggestion.discount.mode === "UNIQUE_CODES" ? "UNIQUE_CODE" : "CODE",
        syncStartEnd: false,
        title: suggestion.discount.title || null,
        valueType: suggestion.discount.valueType,
        value:
          suggestion.discount.valueType === "FREE_SHIPPING"
            ? null
            : suggestion.discount.value || null,
        minimumSubtotal: suggestion.discount.minimumSubtotal || null,
        appliesOncePerCustomer: suggestion.discount.appliesOncePerCustomer,
        uniqueCodePrefix: suggestion.discount.uniqueCodePrefix,
        uniqueCodeExpiresMinutes: Number(
          suggestion.discount.uniqueCodeExpiresMinutes,
        ),
        uniqueCodeAutoApply: suggestion.discount.uniqueCodeAutoApply,
        uniqueCodeStartsAt: null,
        uniqueCodeEndsAt: null,
      }),
    );
  }

  await Promise.all(tasks);
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

async function createOrLinkFreeShippingDiscountForCampaign({
  admin,
  campaignId,
  shopId,
  values,
  startsAt,
  endsAt,
}: {
  admin: Awaited<ReturnType<typeof authenticateAdmin>>["admin"];
  campaignId: string;
  shopId: string;
  values: CampaignFormValues;
  startsAt: Date | null;
  endsAt: Date | null;
}) {
  const thresholdAmount = Number(values.freeShippingThresholdAmount);
  const discountCode = values.freeShippingDiscountCode.trim().toUpperCase();
  let discount: ShopifyDiscountSummary | null = null;

  try {
    discount = await createFreeShippingCodeDiscount(admin, {
      title: values.freeShippingDiscountTitle,
      code: discountCode,
      startsAt,
      endsAt,
      minimumSubtotal: thresholdAmount,
      appliesOncePerCustomer:
        values.freeShippingDiscountAppliesOncePerCustomer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!/already|exists|taken|code/i.test(message)) {
      throw error;
    }

    discount = await getDiscountByCodeOrId(admin, discountCode);

    if (!discount) {
      throw error;
    }
  }

  return updateDiscountSyncForShop(campaignId, shopId, {
    shopifyDiscountId: discount.id,
    discountCode: discount.code ?? discountCode,
    method: "CODE",
    syncStartEnd: false,
    startsAt,
    endsAt,
    lastSyncedAt: new Date(),
    title: values.freeShippingDiscountTitle,
    valueType: "FREE_SHIPPING",
    value: null,
    minimumSubtotal: thresholdAmount.toFixed(2),
    appliesOncePerCustomer:
      values.freeShippingDiscountAppliesOncePerCustomer,
    showCodeOnStorefront: values.freeShippingShowDiscountCode,
  });
}

function toDateTimeLocalValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  return localDate.toISOString().slice(0, 16);
}

async function loadTargetingOptions(
  admin: Awaited<ReturnType<typeof authenticateAdmin>>["admin"],
) {
  try {
    return await loadCampaignTargetingOptions(admin);
  } catch (error) {
    console.error("Failed to load campaign targeting options", error);
    return emptyCampaignTargetingOptions;
  }
}
