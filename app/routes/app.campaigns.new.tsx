import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import { type Prisma, type Shop } from "@prisma/client";

import { AiGenerateIcon } from "../components/AiGenerateIcon";
import {
  AiCampaignBuilder,
  SuggestionMiniPreview,
} from "../components/AiCampaignBuilder";
import { CampaignForm } from "../components/CampaignForm";
import {
  createCampaign,
  getCampaignForShop,
  saveCampaignAssets,
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
  parseCampaignAiReferenceImage,
  shouldAskCampaignAiFollowUpQuestions,
} from "../services/ai/campaignGenerator.server";
import {
  generateCampaignTranslationSuggestions,
  parseCampaignTranslationAiFormData,
} from "../services/ai/campaignTranslationGenerator.server";
import {
  hasCampaignFormErrors,
  parseCampaignFormData,
} from "../services/campaign-form.server";
import { buildCampaignPersistenceError } from "../services/campaign-save-errors.server";
import {
  materializeCampaignAssets,
  stripAssetPlaceholders,
} from "../services/assets/campaignAssetPipeline.server";
import { loadCampaignTargetingOptions } from "../services/campaign-targeting-options.server";
import {
  canCreateCampaign,
  canUseFeature,
  getLockedFeatureReason,
  validateCampaignPlanAccess,
} from "../services/planLimits.server";
import {
  createAutomaticFreeShippingDiscount,
  getDiscountByCodeOrId,
  updateAutomaticFreeShippingDiscount,
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
  buildCampaignCartRescueSettingsValues,
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
  assetsLockedReason?: string;
  defaults: CampaignFormValues;
  enabledLocales: string[];
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
      ? await getCampaignTemplateByKey(templateKey, shop.id)
      : null;

  return {
    aiInput: template
      ? buildCampaignAiInputFromTemplate(template, settings.enabledLocales)
      : buildDefaultCampaignAiInput({
          countryCode: settings.defaultCountry ?? "US",
          locale: settings.defaultLocale,
          locales: settings.enabledLocales,
        }),
    aiLockedReason: aiGate.allowed ? undefined : aiGate.reason,
    assetsLockedReason: getLockedFeatureReason(shop, "ai_visual_assets"),
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
    enabledLocales: settings.enabledLocales,
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
  const settings = await getShopSettingsOrDefaults(shop.id);
  const formData = await request.formData();
  const intent = formData.get("_action");

  if (intent === "generateAiCampaignSuggestion") {
    const aiGate = canUsePremiumFeature(shop, "AI_CAMPAIGN_BUILDER");
    const { image: referenceImage, error: referenceImageError } =
      parseCampaignAiReferenceImage(formData);
    // With a reference image the textual product context is optional — the image
    // carries the context the AI needs.
    const parsedAi = parseCampaignAiFormData(formData, {
      requireProductContext: !referenceImage,
    });
    const aiValues = buildDefaultCampaignAiInput({
      ...parsedAi.values,
      locales: settings.enabledLocales,
    });

    if (!aiGate.allowed) {
      return {
        aiInput: aiValues,
        aiErrors: {
          form: aiGate.reason,
        },
      };
    }

    if (referenceImageError) {
      return {
        aiInput: aiValues,
        aiErrors: {
          form: referenceImageError,
        },
      };
    }

    if (hasCampaignAiFormErrors(parsedAi.errors)) {
      return {
        aiInput: aiValues,
        aiErrors: parsedAi.errors,
      };
    }

    // Follow-up questions refine missing textual context. When an image is
    // attached we skip them and generate directly from the image.
    if (
      !referenceImage &&
      shouldAskCampaignAiFollowUpQuestions(
        aiValues,
        formData.get("aiFollowUpStatus"),
      )
    ) {
      return {
        aiInput: aiValues,
        aiFollowUpQuestions: buildCampaignAiFollowUpQuestions(aiValues),
      };
    }

    try {
      const suggestion = await generateCampaignSuggestion(aiValues, {
        referenceImage: referenceImage ?? undefined,
      });

      // Generate + upload the visual assets now (PRO + write_files validated
      // inside) so they appear in the drawer; the rewritten HTML/CSS + the
      // uploaded asset records round-trip on the suggestion and are persisted on
      // save without re-uploading.
      const assetResult = await materializeCampaignAssets({
        admin,
        shop,
        suggestion,
        referenceImage: referenceImage ?? null,
      });

      const enrichedSuggestion = {
        ...suggestion,
        structureHtml: stripAssetPlaceholders(assetResult.html),
        structureCss: stripAssetPlaceholders(assetResult.css),
        generatedAssets: assetResult.assets.map((asset) => ({
          key: asset.key,
          assetType: asset.assetType,
          source: asset.source,
          shopifyFileId: asset.shopifyFileId,
          shopifyUrl: asset.shopifyUrl,
          modelUsed: asset.modelUsed,
          promptUsed: asset.promptUsed,
        })),
        safety: {
          ...suggestion.safety,
          warnings: assetResult.error
            ? [...suggestion.safety.warnings, assetResult.error]
            : suggestion.safety.warnings,
        },
      };

      return {
        aiInput: aiValues,
        aiSuggestion: enrichedSuggestion,
      };
    } catch (error) {
      console.error("Failed to generate AI campaign suggestion", error);

      return {
        aiInput: aiValues,
        aiErrors: {
          form: "Suggestion could not be generated. Check the fields and try again.",
        },
      };
    }
  }

  if (intent === "translateCampaignTranslations") {
    const aiGate = canUsePremiumFeature(shop, "AI_CAMPAIGN_BUILDER");
    const parsedTranslationAi = parseCampaignTranslationAiFormData(
      formData,
      settings.enabledLocales,
    );

    if (!aiGate.allowed) {
      return Response.json(
        { aiTranslationError: aiGate.reason },
        { status: 403 },
      );
    }

    if (parsedTranslationAi.errors.form) {
      return Response.json(
        { aiTranslationError: parsedTranslationAi.errors.form },
        { status: 400 },
      );
    }

    try {
      const aiTranslation = await generateCampaignTranslationSuggestions(
        parsedTranslationAi.input,
      );

      return Response.json({
        aiTranslation: {
          ...aiTranslation,
          sourceLocale: parsedTranslationAi.input.sourceLocale,
        },
      });
    } catch (error) {
      console.error("Failed to translate campaign copy", error);

      return Response.json(
        {
          aiTranslationError:
            "Translations could not be generated. Check the source copy and try again.",
        },
        { status: 500 },
      );
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
  const cartRescueSettings = buildCampaignCartRescueSettingsValues(
    parsed.values,
  );
  const isFreeShippingCampaign =
    parsed.values.type === "FREE_SHIPPING_GOAL" ||
    parsed.values.goal === "FREE_SHIPPING";
  const usesFreeShippingSettings = isFreeShippingCampaign;
  const isDeliveryCutoffCampaign =
    parsed.values.type === "DELIVERY_CUTOFF" ||
    parsed.values.goal === "DELIVERY_CUTOFF";
  const isLowStockCampaign =
    parsed.values.type === "LOW_STOCK" ||
    parsed.values.goal === "LOW_STOCK_URGENCY";
  const isBadgeCampaign =
    parsed.values.type === "PRODUCT_BADGE" ||
    parsed.values.goal === "PRODUCT_BADGE";
  const freeShippingSettings = buildCampaignFreeShippingSettingsValues(
    parsed.values,
  );
  const deliveryCutoffSettings = buildCampaignDeliveryCutoffSettingsValues(
    parsed.values,
  );
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

    if (usesFreeShippingSettings && parsed.values.freeShippingAutoDiscount) {
      const discountGate = canUseFeature(shop, "discount_sync");

      if (!discountGate.allowed) {
        return {
          values: parsed.values,
          errors: {
            form: discountGate.reason,
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
          customStyle:
            placementType === "CUSTOM_SELECTOR"
              ? parsed.values.customStyle || null
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
          locales: settings.enabledLocales,
          type: parsed.values.type,
          overrides: {
            en: {
              headline: parsed.values.headline,
              subheadline: parsed.values.subheadline,
              ctaText: parsed.values.ctaText,
              ctaUrl: parsed.values.ctaUrl,
              expiredText: parsed.values.expiredText,
              badgeText: parsed.values.badgeText,
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
      ...(parsed.values.type === "CART_TIMER" ||
      parsed.values.goal === "CART_RESCUE"
        ? {
            cartRescueSettings: {
              create: {
                rescueReason: cartRescueSettings.rescueReason,
                showTimer: cartRescueSettings.showTimer,
                showButton: cartRescueSettings.showButton,
              },
            },
          }
        : {}),
      ...(usesFreeShippingSettings
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
                afterCutoffBehavior: deliveryCutoffSettings.afterCutoffBehavior,
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
        locales: settings.enabledLocales,
        shopId: shop.id,
        suggestion: appliedAiSuggestion,
      });
    }

    if (usesFreeShippingSettings && parsed.values.freeShippingAutoDiscount) {
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
      errors: buildCampaignPersistenceError(error, {
        action: "create",
        values: parsed.values,
      }),
    };
  }
};

export default function CreateCampaignPage() {
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const {
    aiInput,
    aiLockedReason,
    assetsLockedReason,
    defaults,
    enabledLocales,
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
            messageLocales={enabledLocales}
            lockedTargetingFeatures={lockedTargetingFeatures}
            targetingOptions={targetingOptions}
            values={actionData?.values ?? defaults}
            errors={actionData?.errors}
            topbarActions={
              <button
                className="counterpulse-ai-action-button counterpulse-ai-launch-button"
                type="button"
                onClick={() => setIsAiDrawerOpen(true)}
              >
                <AiGenerateIcon />
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
          <div
            className={
              actionData?.aiSuggestion
                ? "counterpulse-ai-drawer-cluster has-preview"
                : "counterpulse-ai-drawer-cluster"
            }
          >
            {actionData?.aiSuggestion && (
              <section
                aria-label="AI suggestion preview"
                className="counterpulse-ai-drawer-preview-wing"
                data-testid="ai-drawer-preview"
              >
                <SuggestionMiniPreview suggestion={actionData.aiSuggestion} />
              </section>
            )}
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
              assetsLockedReason={assetsLockedReason}
              onApplied={() => setIsAiDrawerOpen(false)}
              suggestion={actionData?.aiSuggestion}
              templateSourceName={templateSourceName}
              values={actionData?.aiInput ?? aiInput}
              locales={enabledLocales}
            />
            </aside>
          </div>
        </div>
      )}
    </s-page>
  );
}

async function applyAiSuggestionToCampaign({
  campaignId,
  formValues,
  locales,
  shopId,
  suggestion,
}: {
  campaignId: string;
  formValues: CampaignFormValues;
  locales: readonly string[];
  shopId: string;
  suggestion: CampaignSuggestion;
}) {
  // Assets were already generated + uploaded to Shopify during generation; the
  // suggestion carries the rewritten HTML/CSS (Shopify URLs) and the uploaded
  // records, so just persist them here (no re-upload).
  await updateCampaignDesignForShop(
    campaignId,
    shopId,
    suggestion.design,
    suggestion.design,
    {
      editedHtml: stripAssetPlaceholders(suggestion.structureHtml) || null,
      editedCss: stripAssetPlaceholders(suggestion.structureCss) || null,
    },
  );

  await saveCampaignAssets(
    campaignId,
    shopId,
    suggestion.input.generateVisualAssets === true,
    suggestion.generatedAssets.map((asset) => ({
      shopifyFileId: asset.shopifyFileId,
      shopifyUrl: asset.shopifyUrl,
      assetType: asset.assetType,
      source: asset.source.toUpperCase() as "GENERATED" | "EXTRACTED" | "SVG",
      modelUsed: asset.modelUsed,
      promptUsed: asset.promptUsed,
    })),
  );

  await updateCampaignTranslationsForShop(
    campaignId,
    shopId,
    buildTranslationsForSavedCampaign(suggestion, formValues, locales),
  );
  await applyAiGeneratedSettingsToCampaign({
    campaignId,
    formValues,
    shopId,
    suggestion,
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
        uniqueCodeReassignExpired:
          suggestion.discount.uniqueCodeReassignExpired,
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
  locales: readonly string[],
) {
  const activeLocales = locales.length
    ? locales
    : (Object.keys(suggestion.translations) as StorefrontLocale[]);

  return activeLocales.map((locale) => {
    const translation =
      suggestion.translations[locale] ??
      suggestion.translations.en ??
      Object.values(suggestion.translations)[0];

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
  const existingReference = values.freeShippingExistingDiscount.trim();
  let discount: ShopifyDiscountSummary | null = null;

  if (existingReference) {
    discount = await getDiscountByCodeOrId(
      admin,
      normalizeShopifyDiscountReference(existingReference),
    );

    if (!discount) {
      throw new Error(
        "The existing Shopify free shipping discount was not found.",
      );
    }

    if (!isShopifyFreeShippingDiscount(discount)) {
      throw new Error("Link an existing Shopify free shipping discount.");
    }

    return updateDiscountSyncForShop(campaignId, shopId, {
      shopifyDiscountId: discount.id,
      discountCode: discount.code || null,
      method: getDiscountSyncMethodForShopifyDiscount(discount),
      syncStartEnd: false,
      startsAt,
      endsAt,
      lastSyncedAt: new Date(),
      title: discount.title || values.freeShippingDiscountTitle,
      valueType: "FREE_SHIPPING",
      value: null,
      minimumSubtotal: thresholdAmount.toFixed(2),
      appliesOncePerCustomer: false,
      showCodeOnStorefront:
        values.freeShippingShowDiscountCode && Boolean(discount.code),
    });
  }

  const existingCampaign = await getCampaignForShop(campaignId, shopId);
  const existingAutomaticDiscountId =
    existingCampaign?.discountSync?.method === "AUTOMATIC" &&
    existingCampaign.discountSync.shopifyDiscountId?.startsWith(
      "gid://shopify/DiscountAutomaticNode/",
    )
      ? existingCampaign.discountSync.shopifyDiscountId
      : null;

  if (existingAutomaticDiscountId) {
    try {
      discount = await updateAutomaticFreeShippingDiscount(
        admin,
        existingAutomaticDiscountId,
        {
          title: values.freeShippingDiscountTitle,
          startsAt,
          endsAt,
          minimumSubtotal: thresholdAmount,
        },
      );
    } catch (error) {
      if (!isMissingShopifyDiscountError(error)) {
        throw error;
      }
    }
  }

  if (!discount) {
    discount = await createAutomaticFreeShippingDiscount(admin, {
      title: values.freeShippingDiscountTitle,
      startsAt,
      endsAt,
      minimumSubtotal: thresholdAmount,
    });
  }

  return updateDiscountSyncForShop(campaignId, shopId, {
    shopifyDiscountId: discount.id,
    discountCode: null,
    method: "AUTOMATIC",
    syncStartEnd: false,
    startsAt,
    endsAt,
    lastSyncedAt: new Date(),
    title: values.freeShippingDiscountTitle,
    valueType: "FREE_SHIPPING",
    value: null,
    minimumSubtotal: thresholdAmount.toFixed(2),
    appliesOncePerCustomer: false,
    showCodeOnStorefront: false,
  });
}

function isShopifyFreeShippingDiscount(discount: ShopifyDiscountSummary) {
  return /FreeShipping/i.test(discount.type);
}

function getDiscountSyncMethodForShopifyDiscount(
  discount: ShopifyDiscountSummary,
) {
  return /Automatic/i.test(discount.type) ? "AUTOMATIC" : "CODE";
}

function isMissingShopifyDiscountError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return /not found|could not be found|does not exist|invalid id/i.test(
    message,
  );
}

function normalizeShopifyDiscountReference(value: string) {
  const trimmed = value.trim();

  return trimmed.startsWith("gid://shopify/Discount")
    ? trimmed
    : trimmed.toUpperCase();
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
